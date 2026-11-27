-- P2-04: Profile management — mobile number, preferred language, contact
-- preferences and a profile photo, validated and audited.
--
-- Needs P2-03-role-assignment.sql first (it uses public.audit_log).
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-profile-management.test.ts.
--
-- After this, users can no longer UPDATE their profile row directly: every
-- change goes through update_my_profile() / set_my_avatar(), which check the
-- values and write an audit entry. The audit entry lists WHICH fields changed,
-- never the values (no phone numbers in the audit log).
--
-- Error codes the app understands:
--   LBR10  full name missing or too long (1-100 characters)
--   LBR11  display name too long (max 60)
--   LBR12  mobile number not a valid South African mobile (+27 6x/7x/8x ...)
--   LBR13  language not supported
--   LBR14  SMS or WhatsApp chosen without a mobile number
--   LBR15  photo isn't one of your uploaded files
--   42501  not signed in

-- 1. New profile fields ------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN phone              text,
  ADD COLUMN preferred_language text    NOT NULL DEFAULT 'en',
  ADD COLUMN contact_email      boolean NOT NULL DEFAULT true,
  ADD COLUMN contact_sms        boolean NOT NULL DEFAULT false,
  ADD COLUMN contact_whatsapp   boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at         timestamptz NOT NULL DEFAULT now();

-- The same rules as update_my_profile(), kept by the table itself too.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length CHECK (char_length(full_name) <= 100),
  ADD CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) <= 60),
  ADD CONSTRAINT profiles_phone_format CHECK (phone IS NULL OR phone ~ '^\+27[678][0-9]{8}$'),
  ADD CONSTRAINT profiles_language CHECK (
    preferred_language IN ('en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr')
  ),
  ADD CONSTRAINT profiles_phone_channels_need_phone CHECK (
    phone IS NOT NULL OR (NOT contact_sms AND NOT contact_whatsapp)
  );

-- 2. No more direct edits ------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 3. Update my own profile -----------------------------------------------------
-- Returns true if anything changed, false if the values were the same.
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name          text,
  p_display_name       text,
  p_phone              text,
  p_preferred_language text,
  p_contact_email      boolean,
  p_contact_sms        boolean,
  p_contact_whatsapp   boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_old     public.profiles%ROWTYPE;
  v_name    text := btrim(coalesce(p_full_name, ''));
  v_display text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_phone   text := nullif(btrim(coalesce(p_phone, '')), '');
  v_changed text[] := ARRAY[]::text[];
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Full name must be 1 to 100 characters' USING ERRCODE = 'LBR10';
  END IF;
  IF v_display IS NOT NULL AND char_length(v_display) > 60 THEN
    RAISE EXCEPTION 'Display name must be at most 60 characters' USING ERRCODE = 'LBR11';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^\+27[678][0-9]{8}$' THEN
    RAISE EXCEPTION 'Not a South African mobile number' USING ERRCODE = 'LBR12';
  END IF;
  IF coalesce(p_preferred_language, '') NOT IN ('en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr') THEN
    RAISE EXCEPTION 'Language not supported' USING ERRCODE = 'LBR13';
  END IF;
  IF v_phone IS NULL AND (coalesce(p_contact_sms, false) OR coalesce(p_contact_whatsapp, false)) THEN
    RAISE EXCEPTION 'SMS and WhatsApp need a mobile number' USING ERRCODE = 'LBR14';
  END IF;

  SELECT * INTO v_old FROM public.profiles WHERE id = v_me FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old.full_name IS DISTINCT FROM v_name THEN v_changed := array_append(v_changed, 'full_name'); END IF;
  IF v_old.display_name IS DISTINCT FROM v_display THEN v_changed := array_append(v_changed, 'display_name'); END IF;
  IF v_old.phone IS DISTINCT FROM v_phone THEN v_changed := array_append(v_changed, 'phone'); END IF;
  IF v_old.preferred_language IS DISTINCT FROM p_preferred_language THEN v_changed := array_append(v_changed, 'preferred_language'); END IF;
  IF v_old.contact_email IS DISTINCT FROM coalesce(p_contact_email, true) THEN v_changed := array_append(v_changed, 'contact_email'); END IF;
  IF v_old.contact_sms IS DISTINCT FROM coalesce(p_contact_sms, false) THEN v_changed := array_append(v_changed, 'contact_sms'); END IF;
  IF v_old.contact_whatsapp IS DISTINCT FROM coalesce(p_contact_whatsapp, false) THEN v_changed := array_append(v_changed, 'contact_whatsapp'); END IF;

  IF cardinality(v_changed) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.profiles SET
    full_name          = v_name,
    display_name       = v_display,
    phone              = v_phone,
    preferred_language = p_preferred_language,
    contact_email      = coalesce(p_contact_email, true),
    contact_sms        = coalesce(p_contact_sms, false),
    contact_whatsapp   = coalesce(p_contact_whatsapp, false),
    updated_at         = now()
  WHERE id = v_me;

  INSERT INTO public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, after)
  VALUES (v_me, 'self', 'profile.update', 'user', v_me::text, jsonb_build_object('fields', to_jsonb(v_changed)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, boolean, boolean, boolean) TO authenticated;

-- 4. Profile photos ------------------------------------------------------------
-- Private bucket: many users are children, so photos are never public. Each
-- user can only touch files in their own folder: avatars/<their user id>/...
-- The app shows a photo through a short-lived signed link.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read their own profile photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload their own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can replace their own profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete their own profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Point the profile at an uploaded photo (a path inside avatars/), or remove
-- it with NULL. Returns true if it changed.
CREATE OR REPLACE FUNCTION public.set_my_avatar(p_path text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_old text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  IF p_path IS NOT NULL AND (
    split_part(p_path, '/', 1) <> v_me::text
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_path)
  ) THEN
    RAISE EXCEPTION 'That photo is not one of your uploads' USING ERRCODE = 'LBR15';
  END IF;

  SELECT avatar_url INTO v_old FROM public.profiles WHERE id = v_me FOR UPDATE;
  IF v_old IS NOT DISTINCT FROM p_path THEN
    RETURN false;
  END IF;

  UPDATE public.profiles SET avatar_url = p_path, updated_at = now() WHERE id = v_me;

  INSERT INTO public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id)
  VALUES (v_me, 'self', CASE WHEN p_path IS NULL THEN 'profile.photo_remove' ELSE 'profile.photo_set' END,
          'user', v_me::text);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_avatar(text) TO authenticated;
