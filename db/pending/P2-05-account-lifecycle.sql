-- P2-05: Account lifecycle (active / suspended / deactivated) and an audit
-- log that platform admins can browse.
--
-- Needs P2-03 and P2-04 first (uses audit_log, is_platform_admin, require_*).
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-account-lifecycle.test.ts.
--
-- A suspended or deactivated person can still sign in, but only sees a notice
-- (the user's choice for P2-05). To make that more than a screen rule, their
-- roles stop counting in the database: has_role() and is_platform_admin()
-- return false for them, so no role-based rule lets them read or change data.
-- Nothing is deleted.
--
-- Error codes the app understands:
--   LBR02  a reason is required
--   LBR03  user not found
--   LBR20  you can't change your own account's status
--   42501  not a platform administrator

-- 1. Account status ----------------------------------------------------------
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'deactivated');

-- No row means active. A row is written the first time an account's status changes.
CREATE TABLE public.account_states (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status     public.account_status NOT NULL DEFAULT 'active',
  reason     text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_states FROM PUBLIC, anon, authenticated;
-- The reason is internal (it's in the audit log for admins), so users can read
-- only the status and when it changed.
GRANT SELECT (user_id, status, changed_at) ON public.account_states TO authenticated;
GRANT ALL ON public.account_states TO service_role;

CREATE POLICY "Users can read their own account status"
  ON public.account_states FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_account_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.account_states
    WHERE user_id = p_user_id AND status <> 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated;

-- 2. Roles only count for active accounts -------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND public.is_account_active(_user_id)
    AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    );
$$;

-- P2-06 (MFA) will add: and the session is MFA-verified.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'
    );
$$;

CREATE POLICY "Platform admins can read account statuses"
  ON public.account_states FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- 3. Change an account's status ------------------------------------------------
-- Returns true if the status changed, false if it already had that status.
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id uuid,
  p_status  public.account_status,
  p_reason  text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_old    public.account_status;
BEGIN
  PERFORM public.require_platform_admin();
  v_reason := public.require_reason(p_reason);

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t change your own account''s status' USING ERRCODE = 'LBR20';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'LBR03';
  END IF;

  SELECT status INTO v_old FROM public.account_states WHERE user_id = p_user_id FOR UPDATE;
  v_old := coalesce(v_old, 'active');
  IF v_old = p_status THEN
    RETURN false;
  END IF;

  INSERT INTO public.account_states (user_id, status, reason, changed_by, changed_at)
  VALUES (p_user_id, p_status, v_reason, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = EXCLUDED.status, reason = EXCLUDED.reason,
        changed_by = EXCLUDED.changed_by, changed_at = EXCLUDED.changed_at;

  INSERT INTO public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, before, after, reason)
  VALUES (
    auth.uid(), 'platform_admin',
    CASE p_status WHEN 'active' THEN 'account.reactivate'
                  WHEN 'suspended' THEN 'account.suspend'
                  ELSE 'account.deactivate' END,
    'user', p_user_id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), v_reason
  );
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, public.account_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, public.account_status, text) TO authenticated;

-- 4. Browse the audit log ------------------------------------------------------
-- Newest first, 50 at a time. Filter by action group ('role.', 'account.',
-- 'profile.') and/or by a person (as the one acting or the one affected).
-- Page with p_before_id = the last id already shown.
CREATE OR REPLACE FUNCTION public.admin_audit_log(
  p_action_prefix text   DEFAULT NULL,
  p_user_id       uuid   DEFAULT NULL,
  p_before_id     bigint DEFAULT NULL,
  p_limit         integer DEFAULT 50
)
RETURNS TABLE (
  id           bigint,
  occurred_at  timestamptz,
  action       text,
  actor_email  text,
  actor_role   text,
  entity_type  text,
  entity_id    text,
  target_email text,
  before       jsonb,
  after        jsonb,
  reason       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();

  RETURN QUERY
  SELECT a.id, a.occurred_at, a.action, actor.email::text, a.actor_role,
         a.entity_type, a.entity_id, target.email::text, a.before, a.after, a.reason
  FROM public.audit_log a
  LEFT JOIN auth.users actor ON actor.id = a.actor_user_id
  LEFT JOIN auth.users target ON a.entity_type = 'user' AND target.id::text = a.entity_id
  WHERE (p_action_prefix IS NULL OR left(a.action, length(p_action_prefix)) = p_action_prefix)
    AND (p_user_id IS NULL OR a.actor_user_id = p_user_id OR a.entity_id = p_user_id::text)
    AND (p_before_id IS NULL OR a.id < p_before_id)
  ORDER BY a.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_audit_log(text, uuid, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_log(text, uuid, bigint, integer) TO authenticated;
