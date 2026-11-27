-- P2-06: Multi-factor authentication (authenticator app, TOTP) for
-- privileged roles.
--
-- Needs P2-03, P2-04 and P2-05 first.
-- Apply through Lovable (see db/pending/README.md). Do not edit drizzle/ by hand.
-- Tested against Postgres (PGlite) by src/test/db-mfa.test.ts.
--
-- Supabase Auth does the MFA itself (enrol, challenge, verify). After a
-- successful code, the session's token says aal = 'aal2'. This file makes the
-- DATABASE require that: a platform admin whose session hasn't passed MFA has
-- no admin powers, whatever the screens do. (School admins get the same rule
-- in P3-01's has_institution_role().)
--
-- IMPORTANT once applied: platform admins must set up an authenticator app
-- (My profile -> Security) before the admin screens work again.
--
-- Recovery (lost phone): a person can register a second authenticator as a
-- backup; if they lose all of them, ANOTHER platform admin resets their MFA
-- from Admin -> People (a server function using Supabase's admin API, audited
-- as 'mfa.reset').

-- 1. Was this session verified with MFA? ------------------------------------
CREATE OR REPLACE FUNCTION public.is_mfa_verified()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
REVOKE ALL ON FUNCTION public.is_mfa_verified() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mfa_verified() TO authenticated;

-- 2. Platform admin powers need an MFA-verified session -------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_mfa_verified()
    AND public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'
    );
$$;

-- 3. Does a person have an authenticator set up? (for Admin -> People) -----------
CREATE OR REPLACE FUNCTION public.admin_mfa_factor_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN (
    SELECT count(*)::integer FROM auth.mfa_factors
    WHERE user_id = p_user_id AND status = 'verified'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mfa_factor_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mfa_factor_count(uuid) TO authenticated;
