import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { ArrowLeft, GraduationCap, LoaderCircle, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create an account | LearnBridge" },
      {
        name: "description",
        content: "Sign in to your LearnBridge account or create a new profile.",
      },
      { property: "og:title", content: "Sign in or create an account | LearnBridge" },
      { property: "og:description", content: "Access your learning account and profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "sign-in" | "sign-up" | "reset";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) {
          setError("The reset email could not be sent. Please try again.");
        } else {
          setSuccess("If an account uses that email, a password reset link will arrive shortly.");
        }
        return;
      }

      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) {
          setError("The account could not be created. Check your details or try signing in.");
        } else {
          setSuccess(
            "Check your email to confirm your account. Your profile is saved; a school administrator assigns access before school records are available.",
          );
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Email or password was not accepted. Please try again.");
        return;
      }
      await navigate({ to: "/account" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialSignIn(provider: "google" | "lovable") {
    setBusy(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Sign-in could not start. Please try again.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      await navigate({ to: "/account" });
    } catch {
      setError("Sign-in could not start. Please try again.");
      setBusy(false);
    }
  }

  const isSignUp = mode === "sign-up";
  const isReset = mode === "reset";

  return (
    <main className="auth-page">
      <div className="auth-topline">
        <Link to="/" className="auth-brand">
          <span className="workspace-brand-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <strong>LearnBridge</strong>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft aria-hidden="true" /> Back to dashboard
          </Link>
        </Button>
      </div>
      <div className="auth-layout">
        <section className="auth-intro">
          <p className="page-eyebrow">A CONNECTED LEARNING COMMUNITY</p>
          <h1>
            {isReset ? "Reset your password" : isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p>
            {isReset
              ? "We’ll send a secure link to the email address on your account."
              : "One place for teaching, learning, and progress."}
          </p>
          <div className="auth-assurance">
            <ShieldCheck aria-hidden="true" />
            <span>Your profile and learning records stay private to your account.</span>
          </div>
        </section>

        <section className="auth-panel" aria-label={isReset ? "Password reset" : "Account sign in"}>
          {!isReset ? (
            <div className="auth-tabs" role="group" aria-label="Account action">
              <Button
                variant={isSignUp ? "ghost" : "secondary"}
                type="button"
                aria-pressed={!isSignUp}
                onClick={() => changeMode("sign-in")}
              >
                Sign in
              </Button>
              <Button
                variant={isSignUp ? "secondary" : "ghost"}
                type="button"
                aria-pressed={isSignUp}
                onClick={() => changeMode("sign-up")}
              >
                Create account
              </Button>
            </div>
          ) : null}

          {isReset ? <h2 className="auth-panel-title">Send a reset link</h2> : null}
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp ? (
              <div className="form-field">
                <Label htmlFor="auth-full-name">Full name</Label>
                <Input
                  id="auth-full-name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.currentTarget.value)}
                  required
                  maxLength={100}
                />
              </div>
            ) : null}
            <div className="form-field">
              <Label htmlFor="auth-email">Email address</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
                maxLength={254}
              />
            </div>
            {!isReset ? (
              <div className="form-field">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                  minLength={8}
                />
                {isSignUp ? <span className="field-hint">Use at least 8 characters.</span> : null}
              </div>
            ) : null}

            {error ? (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="form-message form-message--success" role="status">
                {success}
              </p>
            ) : null}

            <Button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : isReset ? (
                <Mail aria-hidden="true" />
              ) : null}
              {busy
                ? "Please wait…"
                : isReset
                  ? "Send reset link"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
            </Button>
          </form>

          {!isReset ? (
            <>
              {!isSignUp ? (
                <Button
                  variant="link"
                  className="forgot-link"
                  type="button"
                  onClick={() => changeMode("reset")}
                >
                  Forgot password?
                </Button>
              ) : null}
              <div className="auth-divider">
                <span>or continue with</span>
              </div>
              <div className="provider-buttons">
                <Button
                  className="provider-button google-button"
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSocialSignIn("google")}
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  className="provider-button"
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSocialSignIn("lovable")}
                >
                  <LovableMark /> Continue with Lovable
                </Button>
              </div>
            </>
          ) : null}

          {isReset ? (
            <Button
              variant="link"
              className="forgot-link"
              type="button"
              onClick={() => changeMode("sign-in")}
            >
              Back to sign in
            </Button>
          ) : null}
          {isSignUp ? (
            <p className="auth-footnote">
              After confirming your email, a school or platform administrator assigns the
              appropriate role.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
