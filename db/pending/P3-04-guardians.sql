-- P3-04: Parent and guardian management.
--
-- Needs P2-03 .. P3-03 first.
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-guardians.test.ts.
--
-- A school keeps a record for each parent or guardian: name, relationship,
-- contact details and contact choices. If it has an email, the parent can
-- create an account with that (confirmed) email and claim the record, which
-- gives them the parent role. Learners are linked to these records in P3-05.
--
-- Sensitive data: only the school's admins (and platform admins) and the
-- parent themself can read a record; teachers can't. No ID numbers are kept.
-- The audit log lists which fields changed, never contact details.
-- Records are archived, never deleted.
--
-- Error codes the app understands:
--   LBR60  a detail is invalid (HINT names the field)
--   LBR61  this email is already on another parent record at this school
--   LBR62  the record can't be claimed (not yours, archived or already linked)
--   LBR03  not found (or not in a school you manage)

CREATE TYPE public.guardian_relation AS ENUM ('mother', 'father', 'guardian', 'grandparent', 'foster_parent', 'other');
CREATE TYPE public.guardian_status AS ENUM ('active', 'archived');

CREATE TABLE public.guardians (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name         text NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name          text NOT NULL CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 80),
  relationship       public.guardian_relation NOT NULL,
  email              text CHECK (email IS NULL OR (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone              text CHECK (phone IS NULL OR phone ~ '^\+27[678][0-9]{8}$'),
  preferred_language text NOT NULL DEFAULT 'en'
                     CHECK (preferred_language IN ('en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr')),
  contact_email      boolean NOT NULL DEFAULT true,
  contact_sms        boolean NOT NULL DEFAULT false,
  contact_whatsapp   boolean NOT NULL DEFAULT false,
  status             public.guardian_status NOT NULL DEFAULT 'active',
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CHECK (email IS NOT NULL OR NOT contact_email),
  CHECK (phone IS NOT NULL OR (NOT contact_sms AND NOT contact_whatsapp))
);
CREATE UNIQUE INDEX guardians_email_per_school_idx ON public.guardians (institution_id, email)
  WHERE email IS NOT NULL AND status = 'active';
CREATE INDEX guardians_user_idx ON public.guardians (user_id);
CREATE INDEX guardians_name_idx ON public.guardians (institution_id, last_name, first_name);

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardians FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;

CREATE POLICY "Parents read their own records; school admins read their school's"
  ON public.guardians FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_account_active(auth.uid()))
    OR public.is_platform_admin()
    OR public.is_school_admin(institution_id)
  );

-- 1. Validation shared by add and update --------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_guardian_details(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_language text,
  p_contact_email boolean, p_contact_sms boolean, p_contact_whatsapp boolean
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF char_length(btrim(coalesce(p_first_name, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid first name' USING ERRCODE = 'LBR60', HINT = 'first_name';
  END IF;
  IF char_length(btrim(coalesce(p_last_name, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid last name' USING ERRCODE = 'LBR60', HINT = 'last_name';
  END IF;
  IF p_email IS NOT NULL AND p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = 'LBR60', HINT = 'email';
  END IF;
  IF p_phone IS NOT NULL AND p_phone !~ '^\+27[678][0-9]{8}$' THEN
    RAISE EXCEPTION 'Invalid mobile' USING ERRCODE = 'LBR60', HINT = 'phone';
  END IF;
  IF p_email IS NULL AND p_phone IS NULL THEN
    RAISE EXCEPTION 'Email or mobile needed' USING ERRCODE = 'LBR60', HINT = 'email';
  END IF;
  IF coalesce(p_language, '') NOT IN ('en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr') THEN
    RAISE EXCEPTION 'Invalid language' USING ERRCODE = 'LBR60', HINT = 'language';
  END IF;
  IF p_contact_email AND p_email IS NULL THEN
    RAISE EXCEPTION 'Email contact needs an email' USING ERRCODE = 'LBR60', HINT = 'contact';
  END IF;
  IF (p_contact_sms OR p_contact_whatsapp) AND p_phone IS NULL THEN
    RAISE EXCEPTION 'SMS and WhatsApp need a mobile' USING ERRCODE = 'LBR60', HINT = 'contact';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_guardian_details(text, text, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- 2. Add a parent or guardian ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_guardian(
  p_institution_id uuid,
  p_first_name text,
  p_last_name text,
  p_relationship public.guardian_relation,
  p_email text,
  p_phone text,
  p_language text,
  p_contact_email boolean,
  p_contact_sms boolean,
  p_contact_whatsapp boolean
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.require_school_admin(p_institution_id);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_id uuid;
BEGIN
  PERFORM public.check_guardian_details(p_first_name, p_last_name, v_email, v_phone, p_language,
    coalesce(p_contact_email, false), coalesce(p_contact_sms, false), coalesce(p_contact_whatsapp, false));
  IF p_relationship IS NULL THEN
    RAISE EXCEPTION 'Choose a relationship' USING ERRCODE = 'LBR60', HINT = 'relationship';
  END IF;
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.guardians WHERE institution_id = p_institution_id AND email = v_email AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Email already on a parent record' USING ERRCODE = 'LBR61', HINT = 'email';
  END IF;

  INSERT INTO public.guardians (institution_id, first_name, last_name, relationship, email, phone,
    preferred_language, contact_email, contact_sms, contact_whatsapp, created_by)
  VALUES (p_institution_id, btrim(p_first_name), btrim(p_last_name), p_relationship, v_email, v_phone,
    p_language, coalesce(p_contact_email, false), coalesce(p_contact_sms, false), coalesce(p_contact_whatsapp, false), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, p_institution_id, 'guardian.add', 'guardian', v_id::text,
          jsonb_build_object('relationship', p_relationship, 'has_email', v_email IS NOT NULL, 'has_phone', v_phone IS NOT NULL));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_guardian(uuid, text, text, public.guardian_relation, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_guardian(uuid, text, text, public.guardian_relation, text, text, text, boolean, boolean, boolean) TO authenticated;

-- 3. Load a record the caller manages --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.managed_guardian(p_guardian_id uuid)
RETURNS public.guardians
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g public.guardians%ROWTYPE;
BEGIN
  SELECT * INTO v_g FROM public.guardians WHERE id = p_guardian_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.is_platform_admin() OR public.is_school_admin(v_g.institution_id)) THEN
    RAISE EXCEPTION 'Parent record not found' USING ERRCODE = 'LBR03';
  END IF;
  RETURN v_g;
END;
$$;
REVOKE ALL ON FUNCTION public.managed_guardian(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Update a record ---------------------------------------------------------------------------
-- An email can't be changed once a parent account has claimed the record
-- (the account's own email is what proves who they are).
CREATE OR REPLACE FUNCTION public.update_guardian(
  p_guardian_id uuid,
  p_first_name text,
  p_last_name text,
  p_relationship public.guardian_relation,
  p_email text,
  p_phone text,
  p_language text,
  p_contact_email boolean,
  p_contact_sms boolean,
  p_contact_whatsapp boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g public.guardians%ROWTYPE := public.managed_guardian(p_guardian_id);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_changed text[] := ARRAY[]::text[];
BEGIN
  PERFORM public.check_guardian_details(p_first_name, p_last_name, v_email, v_phone, p_language,
    coalesce(p_contact_email, false), coalesce(p_contact_sms, false), coalesce(p_contact_whatsapp, false));
  IF p_relationship IS NULL THEN
    RAISE EXCEPTION 'Choose a relationship' USING ERRCODE = 'LBR60', HINT = 'relationship';
  END IF;
  IF v_g.user_id IS NOT NULL AND v_email IS DISTINCT FROM v_g.email THEN
    RAISE EXCEPTION 'Email is fixed once the parent has an account' USING ERRCODE = 'LBR60', HINT = 'email';
  END IF;
  IF v_email IS NOT NULL AND v_email IS DISTINCT FROM v_g.email AND EXISTS (
    SELECT 1 FROM public.guardians
    WHERE institution_id = v_g.institution_id AND email = v_email AND status = 'active' AND id <> v_g.id
  ) THEN
    RAISE EXCEPTION 'Email already on a parent record' USING ERRCODE = 'LBR61', HINT = 'email';
  END IF;

  IF v_g.first_name IS DISTINCT FROM btrim(p_first_name) THEN v_changed := array_append(v_changed, 'first_name'); END IF;
  IF v_g.last_name IS DISTINCT FROM btrim(p_last_name) THEN v_changed := array_append(v_changed, 'last_name'); END IF;
  IF v_g.relationship IS DISTINCT FROM p_relationship THEN v_changed := array_append(v_changed, 'relationship'); END IF;
  IF v_g.email IS DISTINCT FROM v_email THEN v_changed := array_append(v_changed, 'email'); END IF;
  IF v_g.phone IS DISTINCT FROM v_phone THEN v_changed := array_append(v_changed, 'phone'); END IF;
  IF v_g.preferred_language IS DISTINCT FROM p_language THEN v_changed := array_append(v_changed, 'preferred_language'); END IF;
  IF v_g.contact_email IS DISTINCT FROM coalesce(p_contact_email, false) THEN v_changed := array_append(v_changed, 'contact_email'); END IF;
  IF v_g.contact_sms IS DISTINCT FROM coalesce(p_contact_sms, false) THEN v_changed := array_append(v_changed, 'contact_sms'); END IF;
  IF v_g.contact_whatsapp IS DISTINCT FROM coalesce(p_contact_whatsapp, false) THEN v_changed := array_append(v_changed, 'contact_whatsapp'); END IF;
  IF cardinality(v_changed) = 0 THEN RETURN false; END IF;

  UPDATE public.guardians SET
    first_name = btrim(p_first_name), last_name = btrim(p_last_name), relationship = p_relationship,
    email = v_email, phone = v_phone, preferred_language = p_language,
    contact_email = coalesce(p_contact_email, false), contact_sms = coalesce(p_contact_sms, false),
    contact_whatsapp = coalesce(p_contact_whatsapp, false), updated_at = now()
  WHERE id = v_g.id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), public.actor_role_for(v_g.institution_id), v_g.institution_id, 'guardian.update', 'guardian',
          v_g.id::text, jsonb_build_object('fields', to_jsonb(v_changed)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.update_guardian(uuid, text, text, public.guardian_relation, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_guardian(uuid, text, text, public.guardian_relation, text, text, text, boolean, boolean, boolean) TO authenticated;

-- 5. Archive or restore ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_guardian_status(
  p_guardian_id uuid,
  p_status public.guardian_status,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g public.guardians%ROWTYPE := public.managed_guardian(p_guardian_id);
  v_reason text := public.require_reason(p_reason);
BEGIN
  IF v_g.status = p_status THEN RETURN false; END IF;
  IF p_status = 'active' AND v_g.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.guardians
    WHERE institution_id = v_g.institution_id AND email = v_g.email AND status = 'active' AND id <> v_g.id
  ) THEN
    RAISE EXCEPTION 'Email already on a parent record' USING ERRCODE = 'LBR61', HINT = 'email';
  END IF;
  UPDATE public.guardians SET status = p_status, updated_at = now() WHERE id = v_g.id;
  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, before, after, reason)
  VALUES (auth.uid(), public.actor_role_for(v_g.institution_id), v_g.institution_id,
          CASE p_status WHEN 'archived' THEN 'guardian.archive' ELSE 'guardian.restore' END,
          'guardian', v_g.id::text, jsonb_build_object('status', v_g.status), jsonb_build_object('status', p_status), v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_guardian_status(uuid, public.guardian_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_guardian_status(uuid, public.guardian_status, text) TO authenticated;

-- 6. A school's parent list -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.school_guardians(p_institution_id uuid)
RETURNS TABLE (
  id uuid, first_name text, last_name text, relationship public.guardian_relation,
  email text, phone text, preferred_language text,
  contact_email boolean, contact_sms boolean, contact_whatsapp boolean,
  status public.guardian_status, has_account boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_school_admin(p_institution_id);
  RETURN QUERY
  SELECT g.id, g.first_name, g.last_name, g.relationship, g.email, g.phone, g.preferred_language,
         g.contact_email, g.contact_sms, g.contact_whatsapp, g.status, g.user_id IS NOT NULL
  FROM public.guardians g
  WHERE g.institution_id = p_institution_id
  ORDER BY (g.status = 'archived'), g.last_name, g.first_name;
END;
$$;
REVOKE ALL ON FUNCTION public.school_guardians(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_guardians(uuid) TO authenticated;

-- 7. Parents claim their record ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_guardian_invitations()
RETURNS TABLE (id uuid, institution_name text, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, i.name, g.first_name, g.last_name
  FROM public.guardians g
  JOIN public.institutions i ON i.id = g.institution_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE g.email = lower(u.email) AND u.email_confirmed_at IS NOT NULL
    AND g.user_id IS NULL AND g.status = 'active' AND i.status = 'active'
    AND public.is_account_active(auth.uid())
  ORDER BY i.name;
$$;
REVOKE ALL ON FUNCTION public.my_guardian_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_guardian_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_guardian_record(p_guardian_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_g public.guardians%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT g.* INTO v_g
  FROM public.guardians g
  JOIN public.institutions i ON i.id = g.institution_id
  JOIN auth.users u ON u.id = auth.uid()
  WHERE g.id = p_guardian_id AND g.email = lower(u.email) AND u.email_confirmed_at IS NOT NULL
    AND g.user_id IS NULL AND g.status = 'active' AND i.status = 'active'
    AND public.is_account_active(auth.uid())
  FOR UPDATE OF g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This parent record can''t be claimed' USING ERRCODE = 'LBR62';
  END IF;
  UPDATE public.guardians SET user_id = auth.uid(), updated_at = now() WHERE id = v_g.id;
  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'self', v_g.institution_id, 'guardian.claim', 'guardian', v_g.id::text);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_guardian_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guardian_record(uuid) TO authenticated;

-- 8. The parent role comes from a claimed, active record ---------------------------------------------
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
    UNION
    SELECT 'parent'::public.app_role
    FROM public.guardians g
    JOIN public.institutions i ON i.id = g.institution_id
    WHERE g.user_id = auth.uid() AND g.status = 'active' AND i.status = 'active'
  ) roles
  WHERE public.is_account_active(auth.uid());
$$;
