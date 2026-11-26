import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password | LearnBridge" },
      { name: "description", content: "Choose a new password for your LearnBridge account." },
      { property: "og:title", content: "Choose a new password | LearnBridge" },
      { property: "og:description", content: "Securely reset your LearnBridge account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [recoveryValid, setRecoveryValid] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const recoveryType =
      new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      setRecoveryValid(recoveryType && !authError && Boolean(data.user));
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("The password could not be changed. Request a fresh reset link and try again.");
    } else {
      setMessage("Your password has been changed. You can now sign in with it.");
    }
    setBusy(false);
  }

  return (
    <main className="auth-page auth-page--compact">
      <div className="auth-topline">
        <Link to="/" className="auth-brand">
          <span className="workspace-brand-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <strong>LearnBridge</strong>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auth">
            <ArrowLeft aria-hidden="true" /> Sign in
          </Link>
        </Button>
      </div>
      <section className="reset-panel">
        <p className="page-eyebrow">ACCOUNT SECURITY</p>
        <h1>Choose a new password</h1>
        {checking ? (
          <p className="form-message" role="status">
            Checking your reset link…
          </p>
        ) : null}
        {!checking && !recoveryValid ? (
          <p className="form-message form-message--error" role="alert">
            This reset link is missing, expired, or already used. Request a new one to continue.
          </p>
        ) : null}
        {!checking && recoveryValid && !message ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
              <span className="field-hint">Use at least 8 characters.</span>
            </div>
            {error ? (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        ) : null}
        {message ? (
          <p className="form-message form-message--success" role="status">
            {message}
          </p>
        ) : null}
        {!checking && (!recoveryValid || message) ? (
          <Button className="auth-submit" asChild>
            <Link to="/auth">Go to sign in</Link>
          </Button>
        ) : null}
      </section>
    </main>
  );
}
