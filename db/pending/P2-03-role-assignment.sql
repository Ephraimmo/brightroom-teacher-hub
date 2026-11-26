-- P2-03: Role assignment by platform administrators, with an audit log.
--
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-role-assignment.test.ts.
--
-- Adds:
--   audit_log            append-only record of sensitive actions
--   is_platform_admin()  the check every admin-only rule uses
--   admin_find_user()    look up ONE user by exact email (platform admins only)
--   admin_grant_role()   give a user a role, with a reason (platform admins only)
--   admin_revoke_role()  remove a role, with a reason (platform admins only)
--
-- Nobody can change user_roles directly: the table still only allows each
-- user to read their own rows. These functions are the only way in.
--
-- Error codes the app understands (custom SQLSTATEs):
--   LBR01  you can't remove your own platform administrator role
--   LBR02  a reason is required
--   LBR03  user not found
--   42501  not a platform administrator

-- 1. Who is a platform administrator --------------------------------------
-- P2-06 (MFA) will add: and the session is MFA-verified (auth.jwt() ->> 'aal' = 'aal2').
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'platform_admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- 2. Audit log --------------------------------------------------------------
CREATE TABLE public.audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_user_id  uuid,
  actor_role     text,
  institution_id uuid,
  action         text NOT NULL,          -- 'role.grant', 'role.revoke', ...
  entity_type    text NOT NULL,          -- 'user', 'learner', ...
  entity_id      text NOT NULL,
  before         jsonb,
  after          jsonb,
  reason         text,
  ip             inet
);
CREATE INDEX audit_log_institution_idx ON public.audit_log (institution_id, occurred_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;

CREATE POLICY "Platform admins can read the audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Append-only for everyone, including the service role and table owner.
CREATE OR REPLACE FUNCTION public.audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_is_append_only();
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_is_append_only();

-- 3. Shared checks ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_platform_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can do this' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_platform_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_reason(p_reason text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = 'LBR02';
  END IF;
  RETURN btrim(p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.require_reason(text) FROM PUBLIC, anon, authenticated;

-- 4. Find one user by exact email ---------------------------------------------
-- Exact match only: admins can't list or browse every account.
CREATE OR REPLACE FUNCTION public.admin_find_user(p_email text)
RETURNS TABLE (user_id uuid, email text, full_name text, roles public.app_role[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, ''),
    COALESCE(
      array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL),
      ARRAY[]::public.app_role[]
    )
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE lower(u.email) = lower(btrim(p_email))
  GROUP BY u.id, u.email, p.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_find_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_user(text) TO authenticated;

-- 5. Grant a role ---------------------------------------------------------------
-- Returns true if the role was added, false if the user already had it.
CREATE OR REPLACE FUNCTION public.admin_grant_role(
  p_user_id uuid,
  p_role public.app_role,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_added integer;
BEGIN
  PERFORM public.require_platform_admin();
  v_reason := public.require_reason(p_reason);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'LBR03';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;

  IF v_added = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, after, reason)
  VALUES (auth.uid(), 'platform_admin', 'role.grant', 'user', p_user_id::text,
          jsonb_build_object('role', p_role), v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_grant_role(uuid, public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.app_role, text) TO authenticated;

-- 6. Revoke a role --------------------------------------------------------------
-- Returns true if the role was removed, false if the user didn't have it.
-- An admin can't remove their own platform_admin role, so the platform can
-- never be left without an administrator by accident.
CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  p_user_id uuid,
  p_role public.app_role,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_removed integer;
BEGIN
  PERFORM public.require_platform_admin();
  v_reason := public.require_reason(p_reason);

  IF p_user_id = auth.uid() AND p_role = 'platform_admin' THEN
    RAISE EXCEPTION 'You can''t remove your own platform administrator role' USING ERRCODE = 'LBR01';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, before, reason)
  VALUES (auth.uid(), 'platform_admin', 'role.revoke', 'user', p_user_id::text,
          jsonb_build_object('role', p_role), v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role, text) TO authenticated;
