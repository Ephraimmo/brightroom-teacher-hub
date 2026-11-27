-- P3-03: Teacher (staff) management within a school.
--
-- Needs P2-03 .. P3-02 first.
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-staff.test.ts.
--
-- School admins (or platform admins) manage ONLY their own school's staff:
-- invite (create_invitation from P3-01), cancel invitations, edit title and
-- the grades a teacher teaches, suspend, reactivate or remove. Removing keeps
-- the membership row (history) but ends the access. Every change is audited
-- against the school.
--
-- Error codes the app understands:
--   LBR50  you can't change your own membership
--   LBR51  the school must keep at least one active school admin
--   LBR52  a grade isn't offered by this school
--   LBR03  not found (or not in a school you manage)
--   LBR02  a reason is required

-- 1. Grades a teacher teaches -------------------------------------------------------
CREATE TABLE public.membership_grades (
  membership_id uuid NOT NULL REFERENCES public.institution_memberships(id) ON DELETE CASCADE,
  grade_code    text NOT NULL REFERENCES public.grade_levels(code),
  PRIMARY KEY (membership_id, grade_code)
);
ALTER TABLE public.membership_grades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_grades FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.membership_grades TO authenticated;
GRANT ALL ON public.membership_grades TO service_role;
CREATE POLICY "Staff read their own grades; admins read their school's"
  ON public.membership_grades FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.institution_memberships m
    WHERE m.id = membership_id
      AND (m.user_id = auth.uid() OR public.is_platform_admin() OR public.is_school_admin(m.institution_id))
  ));

-- 2. The staff list ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.school_staff(p_institution_id uuid)
RETURNS TABLE (
  membership_id uuid, user_id uuid, email text, full_name text,
  role public.membership_role, status public.membership_status, title text,
  grades text[], joined_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_school_admin(p_institution_id);
  RETURN QUERY
  SELECT m.id, m.user_id, u.email::text, coalesce(p.display_name, p.full_name, ''),
         m.role, m.status, m.title,
         coalesce((SELECT array_agg(g.grade_code ORDER BY gl.sort_order)
                   FROM public.membership_grades g JOIN public.grade_levels gl ON gl.code = g.grade_code
                   WHERE g.membership_id = m.id), ARRAY[]::text[]),
         m.created_at
  FROM public.institution_memberships m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.institution_id = p_institution_id
  ORDER BY (m.status = 'removed'), m.role, coalesce(p.full_name, u.email);
END;
$$;
REVOKE ALL ON FUNCTION public.school_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_staff(uuid) TO authenticated;

-- Open (not accepted, not cancelled, not expired) invitations of a school.
CREATE OR REPLACE FUNCTION public.school_open_invitations(p_institution_id uuid)
RETURNS TABLE (id uuid, email text, role public.membership_role, title text, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_school_admin(p_institution_id);
  RETURN QUERY
  SELECT inv.id, inv.email, inv.role, inv.title, inv.expires_at, inv.created_at
  FROM public.invitations inv
  WHERE inv.institution_id = p_institution_id
    AND inv.accepted_at IS NULL AND inv.revoked_at IS NULL AND inv.expires_at > now()
  ORDER BY inv.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.school_open_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_open_invitations(uuid) TO authenticated;

-- 3. Cancel an invitation ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_actor text;
BEGIN
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'LBR03';
  END IF;
  v_actor := public.require_school_admin(v_inv.institution_id);
  IF v_inv.accepted_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL THEN
    RETURN false;
  END IF;
  UPDATE public.invitations SET revoked_at = now() WHERE id = p_invitation_id;
  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, before)
  VALUES (auth.uid(), v_actor, v_inv.institution_id, 'invitation.revoke', 'invitation', p_invitation_id::text,
          jsonb_build_object('role', v_inv.role));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- 4. Shared: load a membership the caller manages ---------------------------------------------
CREATE OR REPLACE FUNCTION public.managed_membership(p_membership_id uuid)
RETURNS public.institution_memberships
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.institution_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_m FROM public.institution_memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_platform_admin() OR public.is_school_admin(v_m.institution_id)) THEN
    -- The same answer whether it doesn't exist or belongs to another school.
    RAISE EXCEPTION 'Staff member not found' USING ERRCODE = 'LBR03';
  END IF;
  RETURN v_m;
END;
$$;
REVOKE ALL ON FUNCTION public.managed_membership(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.actor_role_for(p_institution_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN public.is_platform_admin() THEN 'platform_admin' ELSE 'school_admin' END;
$$;
REVOKE ALL ON FUNCTION public.actor_role_for(uuid) FROM PUBLIC, anon, authenticated;

-- 5. Edit title and grades -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_staff_member(
  p_membership_id uuid,
  p_title text,
  p_grades text[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.institution_memberships%ROWTYPE := public.managed_membership(p_membership_id);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
BEGIN
  IF v_title IS NOT NULL AND char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title too long' USING ERRCODE = 'LBR30', HINT = 'title';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_grades, ARRAY[]::text[])) c
    WHERE c NOT IN (SELECT grade_code FROM public.institution_grades WHERE institution_id = v_m.institution_id)
  ) THEN
    RAISE EXCEPTION 'Grade not offered by this school' USING ERRCODE = 'LBR52', HINT = 'grades';
  END IF;

  UPDATE public.institution_memberships SET title = v_title, updated_at = now() WHERE id = v_m.id;
  DELETE FROM public.membership_grades WHERE membership_id = v_m.id;
  INSERT INTO public.membership_grades (membership_id, grade_code)
  SELECT DISTINCT v_m.id, c FROM unnest(coalesce(p_grades, ARRAY[]::text[])) c;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), public.actor_role_for(v_m.institution_id), v_m.institution_id, 'staff.update', 'user', v_m.user_id::text,
          jsonb_build_object('role', v_m.role, 'title', v_title, 'grades', to_jsonb(coalesce(p_grades, ARRAY[]::text[]))));
END;
$$;
REVOKE ALL ON FUNCTION public.update_staff_member(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_member(uuid, text, text[]) TO authenticated;

-- 6. Suspend, reactivate or remove ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_staff_status(
  p_membership_id uuid,
  p_status public.membership_status,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.institution_memberships%ROWTYPE := public.managed_membership(p_membership_id);
  v_reason text := public.require_reason(p_reason);
BEGIN
  IF p_status NOT IN ('active', 'suspended', 'removed') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = 'LBR30', HINT = 'status';
  END IF;
  IF v_m.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t change your own membership' USING ERRCODE = 'LBR50';
  END IF;
  IF v_m.status = p_status THEN RETURN false; END IF;
  IF v_m.role = 'school_admin' AND v_m.status = 'active' AND p_status <> 'active' AND NOT EXISTS (
    SELECT 1 FROM public.institution_memberships
    WHERE institution_id = v_m.institution_id AND role = 'school_admin' AND status = 'active' AND id <> v_m.id
  ) THEN
    RAISE EXCEPTION 'The school needs at least one active administrator' USING ERRCODE = 'LBR51';
  END IF;

  UPDATE public.institution_memberships SET status = p_status, updated_at = now() WHERE id = v_m.id;
  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, before, after, reason)
  VALUES (auth.uid(), public.actor_role_for(v_m.institution_id), v_m.institution_id,
          CASE p_status WHEN 'active' THEN 'staff.reactivate' WHEN 'suspended' THEN 'staff.suspend' ELSE 'staff.remove' END,
          'user', v_m.user_id::text,
          jsonb_build_object('role', v_m.role, 'status', v_m.status),
          jsonb_build_object('role', v_m.role, 'status', p_status), v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_staff_status(uuid, public.membership_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_status(uuid, public.membership_status, text) TO authenticated;

-- 7. A school admin's own audit trail (for School -> Staff) -----------------------------------------
CREATE OR REPLACE FUNCTION public.school_audit_log(
  p_institution_id uuid,
  p_before_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id bigint, occurred_at timestamptz, action text, actor_email text, actor_role text,
  entity_type text, entity_id text, target_email text, before jsonb, after jsonb, reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_school_admin(p_institution_id);
  RETURN QUERY
  SELECT a.id, a.occurred_at, a.action, actor.email::text, a.actor_role,
         a.entity_type, a.entity_id, target.email::text, a.before, a.after, a.reason
  FROM public.audit_log a
  LEFT JOIN auth.users actor ON actor.id = a.actor_user_id
  LEFT JOIN auth.users target ON a.entity_type = 'user' AND target.id::text = a.entity_id
  WHERE a.institution_id = p_institution_id
    AND (p_before_id IS NULL OR a.id < p_before_id)
  ORDER BY a.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100));
END;
$$;
REVOKE ALL ON FUNCTION public.school_audit_log(uuid, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_audit_log(uuid, bigint, integer) TO authenticated;
