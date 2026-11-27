-- P3-01: School registration and tenancy.
--
-- Needs P2-03 .. P2-06 first.
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-schools.test.ts.
--
-- Tenancy rule: every school-owned row carries institution_id, and every
-- policy checks has_institution_role() / is_institution_member() for THAT
-- institution. One school can never read another school's data.
--
-- People join a school through an invitation for their email address. They
-- accept it in the app after signing in with that (confirmed) email. Emails
-- with links come with notifications later; until then the admin tells the
-- person to sign up with the invited address.
--
-- School admins must use MFA (aal2) for their admin powers, like platform admins.
--
-- Error codes the app understands:
--   LBR30  a school detail is invalid (HINT names the field)
--   LBR35  this invitation can't be used (expired, revoked, used, or not yours)
--   LBR36  that person is already an active member with that role
--   23505  EMIS number already registered to another school

-- 1. Types --------------------------------------------------------------------
CREATE TYPE public.institution_type AS ENUM ('school', 'tutoring_centre', 'independent_teacher', 'online_academy');
CREATE TYPE public.institution_status AS ENUM ('pending', 'active', 'suspended', 'closed');
CREATE TYPE public.membership_role AS ENUM ('school_admin', 'teacher');
CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended', 'removed');

-- 2. Schools ------------------------------------------------------------------
CREATE TABLE public.institutions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 150),
  type           public.institution_type NOT NULL DEFAULT 'school',
  status         public.institution_status NOT NULL DEFAULT 'pending',
  emis_number    text UNIQUE CHECK (emis_number IS NULL OR emis_number ~ '^[0-9]{6,12}$'),
  province       text CHECK (province IS NULL OR province IN (
                   'EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC')),
  district       text,
  address        text,
  contact_email  text CHECK (contact_email IS NULL OR contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone  text CHECK (contact_phone IS NULL OR contact_phone ~ '^\+27[0-9]{9}$'),
  timezone       text NOT NULL DEFAULT 'Africa/Johannesburg',
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX institutions_status_idx ON public.institutions (status);

CREATE TABLE public.institution_memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           public.membership_role NOT NULL,
  status         public.membership_status NOT NULL DEFAULT 'invited',
  title          text CHECK (title IS NULL OR char_length(title) <= 80),
  invited_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id, role)
);
CREATE INDEX institution_memberships_user_idx ON public.institution_memberships (user_id, status);

CREATE TABLE public.invitations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  email          text NOT NULL CHECK (email = lower(btrim(email))),
  role           public.membership_role NOT NULL,
  title          text,
  invited_by     uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at    timestamptz,
  accepted_by    uuid,
  revoked_at     timestamptz
);
CREATE UNIQUE INDEX invitations_one_open_idx ON public.invitations (institution_id, email, role)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- 3. Access helpers -------------------------------------------------------------
-- Active member of an active school with one of these roles. School admin
-- powers also need an MFA-verified session.
CREATE OR REPLACE FUNCTION public.has_institution_role(
  p_institution_id uuid,
  p_roles public.membership_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_account_active(auth.uid()) AND EXISTS (
    SELECT 1
    FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.institution_id = p_institution_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND i.status = 'active'
      AND m.role = ANY (p_roles)
      AND (m.role <> 'school_admin' OR public.is_mfa_verified())
  );
$$;
REVOKE ALL ON FUNCTION public.has_institution_role(uuid, public.membership_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_institution_role(uuid, public.membership_role[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.has_institution_role(p_institution_id, ARRAY['school_admin']::public.membership_role[]);
$$;
REVOKE ALL ON FUNCTION public.is_school_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;

-- Any active member (teacher or admin, MFA not needed just to see the school's name).
CREATE OR REPLACE FUNCTION public.is_institution_member(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_account_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.institution_id = p_institution_id AND m.user_id = auth.uid()
      AND m.status = 'active' AND i.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_institution_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_institution_member(uuid) TO authenticated;

-- 4. Who can read what ------------------------------------------------------------
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institutions, public.institution_memberships, public.invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.institutions, public.institution_memberships, public.invitations TO authenticated;
GRANT ALL ON public.institutions, public.institution_memberships, public.invitations TO service_role;

CREATE POLICY "Platform admins and members can read their school"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_institution_member(id));

CREATE POLICY "People read their own memberships; admins read their school's"
  ON public.institution_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin() OR public.is_school_admin(institution_id));

CREATE POLICY "Admins read their school's invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_school_admin(institution_id));

-- 5. All of a person's roles, for the app's menus ---------------------------------
-- Global roles from user_roles plus school roles from active memberships of
-- active schools. Nothing for suspended or deactivated accounts.
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r FROM (
    SELECT role AS r FROM public.user_roles WHERE user_id = auth.uid()
    UNION
    SELECT m.role::text::public.app_role
    FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.user_id = auth.uid() AND m.status = 'active' AND i.status = 'active'
  ) roles
  WHERE public.is_account_active(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.my_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;

-- The schools the signed-in person works in.
CREATE OR REPLACE FUNCTION public.my_institutions()
RETURNS TABLE (institution_id uuid, name text, role public.membership_role, title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.name, m.role, m.title
  FROM public.institution_memberships m
  JOIN public.institutions i ON i.id = m.institution_id
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND i.status = 'active'
    AND public.is_account_active(auth.uid())
  ORDER BY i.name, m.role;
$$;
REVOKE ALL ON FUNCTION public.my_institutions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_institutions() TO authenticated;

-- 6. Shared validation -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_valid_email(p_email text, p_field text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE v text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = 'LBR30', HINT = p_field;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.require_valid_email(text, text) FROM PUBLIC, anon, authenticated;

-- 7. Register a school (platform admins) -----------------------------------------------
-- Creates the school (active) and an invitation for its first school admin.
CREATE OR REPLACE FUNCTION public.admin_register_institution(
  p_name             text,
  p_type             public.institution_type,
  p_province         text,
  p_emis_number      text,
  p_contact_email    text,
  p_contact_phone    text,
  p_first_admin_email text,
  p_reason           text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_name   text := btrim(coalesce(p_name, ''));
  v_emis   text := nullif(btrim(coalesce(p_emis_number, '')), '');
  v_email  text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_phone  text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_admin  text;
  v_id     uuid;
BEGIN
  PERFORM public.require_platform_admin();
  v_reason := public.require_reason(p_reason);

  IF char_length(v_name) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = 'LBR30', HINT = 'name';
  END IF;
  IF p_province IS NULL OR p_province NOT IN ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC') THEN
    RAISE EXCEPTION 'Invalid province' USING ERRCODE = 'LBR30', HINT = 'province';
  END IF;
  IF v_emis IS NOT NULL AND v_emis !~ '^[0-9]{6,12}$' THEN
    RAISE EXCEPTION 'Invalid EMIS number' USING ERRCODE = 'LBR30', HINT = 'emis_number';
  END IF;
  IF v_email IS NOT NULL THEN v_email := public.require_valid_email(v_email, 'contact_email'); END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^\+27[0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid phone' USING ERRCODE = 'LBR30', HINT = 'contact_phone';
  END IF;
  v_admin := public.require_valid_email(p_first_admin_email, 'first_admin_email');

  INSERT INTO public.institutions (name, type, status, emis_number, province, contact_email, contact_phone, created_by)
  VALUES (v_name, coalesce(p_type, 'school'), 'active', v_emis, p_province, v_email, v_phone, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.invitations (institution_id, email, role, invited_by)
  VALUES (v_id, v_admin, 'school_admin', auth.uid());

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after, reason)
  VALUES (auth.uid(), 'platform_admin', v_id, 'institution.register', 'institution', v_id::text,
          jsonb_build_object('name', v_name, 'first_admin_invited', true), v_reason);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_register_institution(text, public.institution_type, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_register_institution(text, public.institution_type, text, text, text, text, text, text) TO authenticated;

-- 8. Suspend, close or reactivate a school (platform admins) ------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_institution_status(
  p_institution_id uuid,
  p_status public.institution_status,
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
  v_old public.institution_status;
BEGIN
  PERFORM public.require_platform_admin();
  v_reason := public.require_reason(p_reason);
  SELECT status INTO v_old FROM public.institutions WHERE id = p_institution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found' USING ERRCODE = 'LBR03';
  END IF;
  IF v_old = p_status THEN RETURN false; END IF;

  UPDATE public.institutions SET status = p_status, updated_at = now() WHERE id = p_institution_id;
  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, before, after, reason)
  VALUES (auth.uid(), 'platform_admin', p_institution_id, 'institution.status', 'institution', p_institution_id::text,
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_institution_status(uuid, public.institution_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_institution_status(uuid, public.institution_status, text) TO authenticated;

-- 9. Invitations ---------------------------------------------------------------------------
-- Invite someone to a school (platform admins, or that school's admins).
-- Re-inviting the same email for the same role renews the open invitation.
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_institution_id uuid,
  p_email text,
  p_role public.membership_role,
  p_title text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_id uuid;
  v_actor_role text;
BEGIN
  IF public.is_platform_admin() THEN
    v_actor_role := 'platform_admin';
  ELSIF public.is_school_admin(p_institution_id) THEN
    v_actor_role := 'school_admin';
  ELSE
    RAISE EXCEPTION 'Only this school''s administrators can invite people' USING ERRCODE = '42501';
  END IF;
  v_email := public.require_valid_email(p_email, 'email');
  IF p_title IS NOT NULL AND char_length(p_title) > 80 THEN
    RAISE EXCEPTION 'Title too long' USING ERRCODE = 'LBR30', HINT = 'title';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.institution_memberships m JOIN auth.users u ON u.id = m.user_id
    WHERE m.institution_id = p_institution_id AND m.role = p_role AND m.status = 'active'
      AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Already a member' USING ERRCODE = 'LBR36';
  END IF;

  UPDATE public.invitations
    SET expires_at = now() + interval '14 days', title = coalesce(p_title, title), invited_by = auth.uid()
    WHERE institution_id = p_institution_id AND email = v_email AND role = p_role
      AND accepted_at IS NULL AND revoked_at IS NULL
    RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.invitations (institution_id, email, role, title, invited_by)
    VALUES (p_institution_id, v_email, p_role, p_title, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor_role, p_institution_id, 'invitation.create', 'invitation', v_id::text,
          jsonb_build_object('role', p_role));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, public.membership_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.membership_role, text) TO authenticated;

-- Open invitations for the signed-in person's confirmed email.
CREATE OR REPLACE FUNCTION public.my_invitations()
RETURNS TABLE (id uuid, institution_name text, role public.membership_role, title text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT inv.id, i.name, inv.role, inv.title, inv.expires_at
  FROM public.invitations inv
  JOIN public.institutions i ON i.id = inv.institution_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE inv.email = lower(u.email)
    AND u.email_confirmed_at IS NOT NULL
    AND inv.accepted_at IS NULL AND inv.revoked_at IS NULL AND inv.expires_at > now()
    AND i.status = 'active'
    AND public.is_account_active(auth.uid())
  ORDER BY inv.created_at;
$$;
REVOKE ALL ON FUNCTION public.my_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_membership uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  SELECT inv.* INTO v_inv
  FROM public.invitations inv
  JOIN public.institutions i ON i.id = inv.institution_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE inv.id = p_invitation_id
    AND inv.email = lower(u.email)
    AND u.email_confirmed_at IS NOT NULL
    AND inv.accepted_at IS NULL AND inv.revoked_at IS NULL AND inv.expires_at > now()
    AND i.status = 'active'
    AND public.is_account_active(auth.uid())
  FOR UPDATE OF inv;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invitation can''t be used' USING ERRCODE = 'LBR35';
  END IF;

  INSERT INTO public.institution_memberships (institution_id, user_id, role, status, title, invited_by)
  VALUES (v_inv.institution_id, auth.uid(), v_inv.role, 'active', v_inv.title, v_inv.invited_by)
  ON CONFLICT (institution_id, user_id, role) DO UPDATE
    SET status = 'active', title = coalesce(EXCLUDED.title, institution_memberships.title), updated_at = now()
  RETURNING id INTO v_membership;

  UPDATE public.invitations SET accepted_at = now(), accepted_by = auth.uid() WHERE id = v_inv.id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), 'self', v_inv.institution_id, 'invitation.accept', 'user', auth.uid()::text,
          jsonb_build_object('role', v_inv.role));
  RETURN v_membership;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- 10. School admins can read their school's audit entries ------------------------------------
CREATE POLICY "School admins can read their school's audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (institution_id IS NOT NULL AND public.is_school_admin(institution_id));
