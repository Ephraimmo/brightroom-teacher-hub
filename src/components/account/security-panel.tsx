import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { SectionHeader } from "@/components/design/page-header";
import { FormField } from "@/components/design/form-field";
import { ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanTotpCode, MAX_FACTORS, mfaErrorMessage } from "@/domain/mfa";
import { mfaKey, useMfa } from "@/hooks/use-mfa";
import { isDemo } from "@/demo/demo-session";
import { supabase } from "@/integrations/supabase/client";

interface Enrolment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/** Two-step sign-in: add, verify and remove authenticator apps. */
export function SecurityPanel({ required }: { required: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mfa = useMfa();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: mfaKey(user?.id) });

  if (mfa.isLoading) return <LoadingState label="Loading your sign-in settings…" rows={2} />;
  if (mfa.isError || !mfa.data) {
    return (
      <ErrorState title="Your sign-in settings didn't load" onRetry={() => void mfa.refetch()} />
    );
  }
  const { factors, currentLevel } = mfa.data;

  const DEMO_NOTE =
    "In the demo, authenticator apps can't be added or removed. Demo accounts count as already verified.";

  async function start() {
    if (isDemo()) {
      setMessage(DEMO_NOTE);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    // Clear any half-finished set-up first, so it doesn't block a new one.
    const all = await supabase.auth.mfa.listFactors();
    for (const f of all.data?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const name = factors.length === 0 ? "Authenticator app" : "Backup authenticator";
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `${name} ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (enrolError || !data) {
      setError(mfaErrorMessage(enrolError));
      return;
    }
    setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function cancel() {
    if (enrolment) await supabase.auth.mfa.unenroll({ factorId: enrolment.factorId });
    setEnrolment(null);
    setCode("");
    setError(null);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrolment) return;
    const clean = cleanTotpCode(code);
    if (!clean) {
      setError("Enter the 6-digit code your app shows.");
      return;
    }
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolment.factorId,
      code: clean,
    });
    setBusy(false);
    if (verifyError) {
      setError(mfaErrorMessage(verifyError));
      return;
    }
    setEnrolment(null);
    setCode("");
    setError(null);
    setMessage("Two-step sign-in is on. You'll be asked for a code when you sign in.");
    await refresh();
  }

  async function remove(factorId: string) {
    if (isDemo()) {
      setConfirmRemove(null);
      setMessage(DEMO_NOTE);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    setConfirmRemove(null);
    if (removeError) {
      setError(
        currentLevel === "aal2"
          ? mfaErrorMessage(removeError)
          : "Sign out and back in with your code before removing an authenticator.",
      );
      return;
    }
    setMessage("Authenticator removed.");
    await refresh();
  }

  return (
    <div className="security-panel">
      {required && factors.length === 0 ? (
        <div className="security-required" role="alert">
          <ShieldAlert aria-hidden="true" />
          <p>
            <strong>Your role needs two-step sign-in.</strong> Set up an authenticator app below to
            open the administration area.
          </p>
        </div>
      ) : null}

      <SectionHeader
        eyebrow="TWO-STEP SIGN-IN"
        title="Authenticator app"
        action={
          factors.length > 0 ? (
            <StatusPill tone="success">On</StatusPill>
          ) : (
            <StatusPill tone="neutral">Off</StatusPill>
          )
        }
      />
      <p className="form-hint">
        After your password, you'll enter a 6-digit code from an app such as Google Authenticator or
        Microsoft Authenticator. Required for administrators.
      </p>

      {factors.length > 0 ? (
        <ul className="security-factors">
          {factors.map((f) => (
            <li key={f.id}>
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>{f.friendlyName}</strong>
                <span className="people-note">
                  {" "}
                  added {new Date(f.createdAt).toLocaleDateString("en-ZA")}
                </span>
              </span>
              {confirmRemove === f.id ? (
                <span className="people-confirm">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void remove(f.id)}
                  >
                    Confirm removal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${f.friendlyName}`}
                  onClick={() => setConfirmRemove(f.id)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {enrolment ? (
        <form className="security-enrol" onSubmit={(e) => void verify(e)} noValidate>
          <p>
            <strong>1.</strong> Scan this code with your authenticator app.
          </p>
          <img
            className="security-qr"
            src={enrolment.qrCode}
            alt="QR code to scan with your authenticator app"
          />
          <p className="form-hint">
            Can't scan? Enter this key in the app instead:{" "}
            <code className="security-secret">{enrolment.secret}</code>
          </p>
          <p>
            <strong>2.</strong> Enter the 6-digit code the app shows.
          </p>
          <FormField id="security-code" label="6-digit code" error={error}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
            />
          </FormField>
          <span className="people-confirm">
            <Button type="submit" disabled={busy}>
              {busy ? "Checking…" : "Turn on"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void cancel()}>
              Cancel
            </Button>
          </span>
        </form>
      ) : factors.length < MAX_FACTORS ? (
        <div>
          <Button
            variant={factors.length === 0 ? "default" : "outline"}
            disabled={busy}
            onClick={() => void start()}
          >
            {factors.length === 0 ? "Set up authenticator app" : "Add a backup authenticator"}
          </Button>
          {factors.length === 1 ? (
            <p className="form-hint">
              A backup on a second phone lets you sign in if you lose the first one.
            </p>
          ) : null}
        </div>
      ) : null}

      {!enrolment && error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-message form-message--success" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
