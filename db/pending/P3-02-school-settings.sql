-- P3-02: School settings, academic years, terms and grades.
--
-- Needs P2-03 .. P3-01 first.
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-school-settings.test.ts.
--
-- The school's academic years and terms drive the year/term filters on class
-- and report pages: academic_periods() lists them and marks the current one.
--
-- Error codes the app understands:
--   LBR40  a setting is invalid (HINT names the field)
--   LBR41  dates overlap another year or term
--   LBR42  a term falls outside its academic year
--   42501  not this school's administrator

-- 1. Who may change a school ------------------------------------------------------
-- Returns the actor's role for the audit log, or refuses.
CREATE OR REPLACE FUNCTION public.require_school_admin(p_institution_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin() THEN RETURN 'platform_admin'; END IF;
  IF public.is_school_admin(p_institution_id) THEN RETURN 'school_admin'; END IF;
  RAISE EXCEPTION 'Only this school''s administrators can do this' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.require_school_admin(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Grades -------------------------------------------------------------------------
CREATE TABLE public.grade_levels (
  code       text PRIMARY KEY,
  label      text NOT NULL,
  phase      text NOT NULL,
  sort_order smallint NOT NULL
);
INSERT INTO public.grade_levels (code, label, phase, sort_order) VALUES
  ('G00', 'Grade R', 'foundation', 0),
  ('G01', 'Grade 1', 'foundation', 1),
  ('G02', 'Grade 2', 'foundation', 2),
  ('G03', 'Grade 3', 'foundation', 3),
  ('G04', 'Grade 4', 'intermediate', 4),
  ('G05', 'Grade 5', 'intermediate', 5),
  ('G06', 'Grade 6', 'intermediate', 6),
  ('G07', 'Grade 7', 'senior', 7),
  ('G08', 'Grade 8', 'senior', 8),
  ('G09', 'Grade 9', 'senior', 9),
  ('G10', 'Grade 10', 'fet', 10),
  ('G11', 'Grade 11', 'fet', 11),
  ('G12', 'Grade 12', 'fet', 12),
  ('MATRIC_REWRITE', 'Matric rewrite', 'adult', 13),
  ('MATRIC_UPGRADE', 'Matric upgrade', 'adult', 14),
  ('EXAM_PREP', 'Exam preparation', 'adult', 15);
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grade_levels FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.grade_levels TO authenticated;
CREATE POLICY "Everyone signed in can read grade levels"
  ON public.grade_levels FOR SELECT TO authenticated USING (true);

CREATE TABLE public.institution_grades (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  grade_code     text NOT NULL REFERENCES public.grade_levels(code),
  PRIMARY KEY (institution_id, grade_code)
);

-- 3. Academic years and terms -----------------------------------------------------------
CREATE TABLE public.academic_years (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  label          text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 20),
  starts_on      date NOT NULL,
  ends_on        date NOT NULL,
  is_current     boolean NOT NULL DEFAULT false,
  CHECK (ends_on > starts_on),
  UNIQUE (institution_id, label)
);
CREATE UNIQUE INDEX academic_years_one_current_idx ON public.academic_years (institution_id) WHERE is_current;

CREATE TABLE public.terms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  number           smallint NOT NULL CHECK (number BETWEEN 1 AND 4),
  starts_on        date NOT NULL,
  ends_on          date NOT NULL,
  CHECK (ends_on > starts_on),
  UNIQUE (academic_year_id, number)
);

-- 4. Who can read ---------------------------------------------------------------------
ALTER TABLE public.institution_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institution_grades, public.academic_years, public.terms FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.institution_grades, public.academic_years, public.terms TO authenticated;
GRANT ALL ON public.institution_grades, public.academic_years, public.terms, public.grade_levels TO service_role;

CREATE POLICY "Members read their school's grades"
  ON public.institution_grades FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_institution_member(institution_id));
CREATE POLICY "Members read their school's academic years"
  ON public.academic_years FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_institution_member(institution_id));
CREATE POLICY "Members read their school's terms"
  ON public.terms FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_institution_member(institution_id));

-- 5. School details ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_institution_profile(
  p_institution_id uuid,
  p_name text,
  p_emis_number text,
  p_province text,
  p_district text,
  p_address text,
  p_contact_email text,
  p_contact_phone text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.require_school_admin(p_institution_id);
  v_name  text := btrim(coalesce(p_name, ''));
  v_emis  text := nullif(btrim(coalesce(p_emis_number, '')), '');
  v_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_old   public.institutions%ROWTYPE;
  v_changed text[] := ARRAY[]::text[];
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = 'LBR40', HINT = 'name';
  END IF;
  IF v_emis IS NOT NULL AND v_emis !~ '^[0-9]{6,12}$' THEN
    RAISE EXCEPTION 'Invalid EMIS number' USING ERRCODE = 'LBR40', HINT = 'emis_number';
  END IF;
  IF p_province IS NULL OR p_province NOT IN ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC') THEN
    RAISE EXCEPTION 'Invalid province' USING ERRCODE = 'LBR40', HINT = 'province';
  END IF;
  IF v_email IS NOT NULL AND lower(v_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = 'LBR40', HINT = 'contact_email';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^\+27[0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid phone' USING ERRCODE = 'LBR40', HINT = 'contact_phone';
  END IF;
  IF char_length(coalesce(p_district, '')) > 100 OR char_length(coalesce(p_address, '')) > 300 THEN
    RAISE EXCEPTION 'Too long' USING ERRCODE = 'LBR40', HINT = 'address';
  END IF;

  SELECT * INTO v_old FROM public.institutions WHERE id = p_institution_id FOR UPDATE;
  IF v_old.name IS DISTINCT FROM v_name THEN v_changed := array_append(v_changed, 'name'); END IF;
  IF v_old.emis_number IS DISTINCT FROM v_emis THEN v_changed := array_append(v_changed, 'emis_number'); END IF;
  IF v_old.province IS DISTINCT FROM p_province THEN v_changed := array_append(v_changed, 'province'); END IF;
  IF v_old.district IS DISTINCT FROM nullif(btrim(coalesce(p_district, '')), '') THEN v_changed := array_append(v_changed, 'district'); END IF;
  IF v_old.address IS DISTINCT FROM nullif(btrim(coalesce(p_address, '')), '') THEN v_changed := array_append(v_changed, 'address'); END IF;
  IF v_old.contact_email IS DISTINCT FROM lower(v_email) THEN v_changed := array_append(v_changed, 'contact_email'); END IF;
  IF v_old.contact_phone IS DISTINCT FROM v_phone THEN v_changed := array_append(v_changed, 'contact_phone'); END IF;
  IF cardinality(v_changed) = 0 THEN RETURN false; END IF;

  UPDATE public.institutions SET
    name = v_name, emis_number = v_emis, province = p_province,
    district = nullif(btrim(coalesce(p_district, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    contact_email = lower(v_email), contact_phone = v_phone, updated_at = now()
  WHERE id = p_institution_id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, p_institution_id, 'school.profile_update', 'institution', p_institution_id::text,
          jsonb_build_object('fields', to_jsonb(v_changed)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.update_institution_profile(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_institution_profile(uuid, text, text, text, text, text, text, text) TO authenticated;

-- 6. School policies -------------------------------------------------------------------------
-- Only known switches, each true or false, are stored in institutions.settings.policies.
CREATE OR REPLACE FUNCTION public.update_institution_policies(p_institution_id uuid, p_policies jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.require_school_admin(p_institution_id);
  v_key text;
  v_allowed text[] := ARRAY['lesson_recording', 'ai_assistance', 'parent_messaging', 'learner_messaging'];
BEGIN
  IF p_policies IS NULL OR jsonb_typeof(p_policies) <> 'object' THEN
    RAISE EXCEPTION 'Invalid policies' USING ERRCODE = 'LBR40', HINT = 'policies';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_policies) LOOP
    IF NOT v_key = ANY (v_allowed) OR jsonb_typeof(p_policies -> v_key) <> 'boolean' THEN
      RAISE EXCEPTION 'Unknown policy %', v_key USING ERRCODE = 'LBR40', HINT = 'policies';
    END IF;
  END LOOP;

  UPDATE public.institutions
  SET settings = jsonb_set(settings, '{policies}', coalesce(settings -> 'policies', '{}'::jsonb) || p_policies),
      updated_at = now()
  WHERE id = p_institution_id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, p_institution_id, 'school.policies_update', 'institution', p_institution_id::text, p_policies);
END;
$$;
REVOKE ALL ON FUNCTION public.update_institution_policies(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_institution_policies(uuid, jsonb) TO authenticated;

-- 7. Grades offered -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_institution_grades(p_institution_id uuid, p_codes text[])
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.require_school_admin(p_institution_id);
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_codes, ARRAY[]::text[])) c
             WHERE c NOT IN (SELECT code FROM public.grade_levels)) THEN
    RAISE EXCEPTION 'Unknown grade' USING ERRCODE = 'LBR40', HINT = 'grades';
  END IF;
  DELETE FROM public.institution_grades WHERE institution_id = p_institution_id;
  INSERT INTO public.institution_grades (institution_id, grade_code)
  SELECT DISTINCT p_institution_id, c FROM unnest(coalesce(p_codes, ARRAY[]::text[])) c;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, p_institution_id, 'school.grades_update', 'institution', p_institution_id::text,
          jsonb_build_object('grades', to_jsonb(coalesce(p_codes, ARRAY[]::text[]))));
END;
$$;
REVOKE ALL ON FUNCTION public.set_institution_grades(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_institution_grades(uuid, text[]) TO authenticated;

-- 8. Academic years ------------------------------------------------------------------------------
-- Create (p_year_id NULL) or update a year. Years of one school can't overlap,
-- and existing terms must still fit inside the year.
CREATE OR REPLACE FUNCTION public.save_academic_year(
  p_institution_id uuid,
  p_year_id uuid,
  p_label text,
  p_starts_on date,
  p_ends_on date,
  p_make_current boolean
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.require_school_admin(p_institution_id);
  v_label text := btrim(coalesce(p_label, ''));
  v_id uuid := p_year_id;
BEGIN
  IF char_length(v_label) NOT BETWEEN 2 AND 20 THEN
    RAISE EXCEPTION 'Invalid label' USING ERRCODE = 'LBR40', HINT = 'label';
  END IF;
  IF p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on <= p_starts_on THEN
    RAISE EXCEPTION 'End must be after start' USING ERRCODE = 'LBR40', HINT = 'ends_on';
  END IF;
  IF p_ends_on > p_starts_on + interval '18 months' THEN
    RAISE EXCEPTION 'A year can be at most 18 months' USING ERRCODE = 'LBR40', HINT = 'ends_on';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.academic_years
    WHERE institution_id = p_institution_id AND id IS DISTINCT FROM p_year_id
      AND daterange(starts_on, ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  ) THEN
    RAISE EXCEPTION 'Overlaps another year' USING ERRCODE = 'LBR41', HINT = 'starts_on';
  END IF;
  IF p_year_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.terms WHERE academic_year_id = p_year_id
      AND (starts_on < p_starts_on OR ends_on > p_ends_on)
  ) THEN
    RAISE EXCEPTION 'A term would fall outside the year' USING ERRCODE = 'LBR42', HINT = 'starts_on';
  END IF;

  IF coalesce(p_make_current, false) THEN
    UPDATE public.academic_years SET is_current = false
    WHERE institution_id = p_institution_id AND is_current AND id IS DISTINCT FROM p_year_id;
  END IF;

  IF p_year_id IS NULL THEN
    INSERT INTO public.academic_years (institution_id, label, starts_on, ends_on, is_current)
    VALUES (p_institution_id, v_label, p_starts_on, p_ends_on, coalesce(p_make_current, false))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.academic_years
    SET label = v_label, starts_on = p_starts_on, ends_on = p_ends_on,
        is_current = CASE WHEN coalesce(p_make_current, false) THEN true ELSE is_current END
    WHERE id = p_year_id AND institution_id = p_institution_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Year not found' USING ERRCODE = 'LBR03';
    END IF;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, p_institution_id,
          CASE WHEN p_year_id IS NULL THEN 'school.year_create' ELSE 'school.year_update' END,
          'academic_year', v_id::text,
          jsonb_build_object('label', v_label, 'starts_on', p_starts_on, 'ends_on', p_ends_on,
                             'current', coalesce(p_make_current, false)));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_academic_year(uuid, uuid, text, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_academic_year(uuid, uuid, text, date, date, boolean) TO authenticated;

-- 9. Terms ------------------------------------------------------------------------------------------
-- Create or update term N of a year. Must be inside the year and not overlap its other terms.
CREATE OR REPLACE FUNCTION public.save_term(
  p_academic_year_id uuid,
  p_number smallint,
  p_starts_on date,
  p_ends_on date
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year public.academic_years%ROWTYPE;
  v_actor text;
  v_id uuid;
BEGIN
  SELECT * INTO v_year FROM public.academic_years WHERE id = p_academic_year_id;
  IF NOT FOUND THEN
    -- Don't reveal whether another school's year exists.
    RAISE EXCEPTION 'Only this school''s administrators can do this' USING ERRCODE = '42501';
  END IF;
  v_actor := public.require_school_admin(v_year.institution_id);

  IF p_number IS NULL OR p_number NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Term number must be 1 to 4' USING ERRCODE = 'LBR40', HINT = 'number';
  END IF;
  IF p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on <= p_starts_on THEN
    RAISE EXCEPTION 'End must be after start' USING ERRCODE = 'LBR40', HINT = 'ends_on';
  END IF;
  IF p_starts_on < v_year.starts_on OR p_ends_on > v_year.ends_on THEN
    RAISE EXCEPTION 'Term outside the year' USING ERRCODE = 'LBR42', HINT = 'starts_on';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.terms
    WHERE academic_year_id = p_academic_year_id AND number <> p_number
      AND daterange(starts_on, ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  ) THEN
    RAISE EXCEPTION 'Overlaps another term' USING ERRCODE = 'LBR41', HINT = 'starts_on';
  END IF;

  INSERT INTO public.terms (institution_id, academic_year_id, number, starts_on, ends_on)
  VALUES (v_year.institution_id, p_academic_year_id, p_number, p_starts_on, p_ends_on)
  ON CONFLICT (academic_year_id, number) DO UPDATE
    SET starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, actor_role, institution_id, action, entity_type, entity_id, after)
  VALUES (auth.uid(), v_actor, v_year.institution_id, 'school.term_save', 'term', v_id::text,
          jsonb_build_object('year', v_year.label, 'number', p_number, 'starts_on', p_starts_on, 'ends_on', p_ends_on));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_term(uuid, smallint, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_term(uuid, smallint, date, date) TO authenticated;

-- 10. Year/term options for filters --------------------------------------------------------------------
-- Every year and term of a school, newest year first. is_current marks the
-- current year, and the term that contains p_today (or, between terms, the
-- next one) in the current year.
CREATE OR REPLACE FUNCTION public.academic_periods(p_institution_id uuid, p_today date DEFAULT current_date)
RETURNS TABLE (
  year_id uuid, year_label text, year_starts_on date, year_ends_on date, year_is_current boolean,
  term_id uuid, term_number smallint, term_starts_on date, term_ends_on date, term_is_current boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_term uuid;
BEGIN
  IF NOT (public.is_platform_admin() OR public.is_institution_member(p_institution_id)) THEN
    RAISE EXCEPTION 'Not a member of this school' USING ERRCODE = '42501';
  END IF;

  SELECT t.id INTO v_current_term
  FROM public.terms t JOIN public.academic_years y ON y.id = t.academic_year_id
  WHERE y.institution_id = p_institution_id AND y.is_current AND t.ends_on >= p_today
  ORDER BY (t.starts_on <= p_today) DESC, t.starts_on
  LIMIT 1;

  RETURN QUERY
  SELECT y.id, y.label, y.starts_on, y.ends_on, y.is_current,
         t.id, t.number, t.starts_on, t.ends_on, coalesce(t.id = v_current_term, false)
  FROM public.academic_years y
  LEFT JOIN public.terms t ON t.academic_year_id = y.id
  WHERE y.institution_id = p_institution_id
  ORDER BY y.starts_on DESC, t.number;
END;
$$;
REVOKE ALL ON FUNCTION public.academic_periods(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academic_periods(uuid, date) TO authenticated;

-- 11. School details for its own members ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.institution_settings(p_institution_id uuid)
RETURNS TABLE (
  id uuid, name text, type public.institution_type, emis_number text, province text, district text,
  address text, contact_email text, contact_phone text, policies jsonb, grades text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.is_institution_member(p_institution_id)) THEN
    RAISE EXCEPTION 'Not a member of this school' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.name, i.type, i.emis_number, i.province, i.district, i.address,
         i.contact_email, i.contact_phone, coalesce(i.settings -> 'policies', '{}'::jsonb),
         coalesce((SELECT array_agg(g.grade_code ORDER BY gl.sort_order)
                   FROM public.institution_grades g JOIN public.grade_levels gl ON gl.code = g.grade_code
                   WHERE g.institution_id = i.id), ARRAY[]::text[])
  FROM public.institutions i WHERE i.id = p_institution_id;
END;
$$;
REVOKE ALL ON FUNCTION public.institution_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.institution_settings(uuid) TO authenticated;
