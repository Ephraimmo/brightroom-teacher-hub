import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { FormField } from "@/components/design/form-field";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanTotpCode, mfaErrorMessage } from "@/domain/mfa";
import { mfaKey, useMfa } from "@/hooks/use-mfa";
import { useSignOut } from "@/hooks/use-sign-out";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/lib/safe-redirect";

export const Route = createFileRoute("/auth_/mfa")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [{ title: "Enter your code | LearnBridge" }, { name: "robots", content: "noindex" }],
  }),
  component: MfaChallengePage,
});

/** Second sign-in step: a 6-digit code from the person's authenticator app. */
function MfaChallengePage() {
  const { user, isLoading } = useAuth();
  const mfa = useMfa();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useSignOut();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  if (isLoading || (user && mfa.isLoading)) {
    return <StatusPage kind="loading" title="Checking your sign-in…" />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (mfa.isError || !mfa.data) {
    return (
      <StatusPage
        kind="error"
        title="We couldn't check your sign-in"
        actions={<Button onClick={() => void mfa.refetch()}>Try again</Button>}
      />
    );
  }
  const target = safeRedirect(redirect);
  // Already verified, or nothing to verify with.
  if (mfa.data.currentLevel === "aal2") return <Navigate to={target} replace />;
  if (mfa.data.factors.length === 0) {
    return <Navigate to="/account/security" search={{ required: true }} replace />;
  }

  const factors = mfa.data.factors;
  const chosen = factorId ?? factors[0]?.id ?? "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = cleanTotpCode(code);
    if (!clean) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: chosen,
      code: clean,
    });
    setBusy(false);
    if (verifyError) {
      setError(mfaErrorMessage(verifyError));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: mfaKey(user?.id) });
    void navigate({ to: target, replace: true });
  }

  return (
    <main className="auth-page auth-page--compact">
      <section className="reset-panel">
        <ShieldCheck aria-hidden="true" className="mfa-icon" />
        <p className="page-eyebrow">TWO-STEP SIGN-IN</p>
        <h1>Enter your code</h1>
        <p className="page-description">
          Open your authenticator app and enter the 6-digit code for LearnBridge.
        </p>
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {factors.length > 1 ? (
            <FormField id="mfa-factor" label="Authenticator">
              <select
                className="native-select"
                value={chosen}
                onChange={(e) => setFactorId(e.currentTarget.value)}
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendlyName}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField id="mfa-code" label="6-digit code" error={error}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
            />
          </FormField>
          <Button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
        <p className="form-hint mfa-help">
          Lost your phone? Use your backup authenticator if you set one up, or ask another platform
          administrator to reset your two-step sign-in.
        </p>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
