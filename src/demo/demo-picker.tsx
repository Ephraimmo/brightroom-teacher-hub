import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  LoaderCircle,
  School,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ROLE_AREAS } from "@/domain/navigation";
import { supabase } from "@/integrations/supabase/client";

import { DEMO_PERSONAS, type DemoRole } from "./demo-data";
import { isDemo, startDemo } from "./demo-session";
import { resetDemoData } from "./demo-store";
import { useDemoRole } from "./use-demo-role";

const ICONS: Record<DemoRole, LucideIcon> = {
  platform_admin: ShieldCheck,
  school_admin: School,
  teacher: Users,
  parent: HeartHandshake,
  learner: UserRound,
};

/**
 * "Try the demo": choose whose eyes to see LearnBridge through. Everything
 * runs on sample data in this browser tab; no account or password is needed.
 *
 * Each role is a plain link (/demo?as=teacher), so it works even before the
 * page's scripts load, and can be shared.
 */
export function DemoPicker({ startAs }: { startAs: DemoRole | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const active = useDemoRole();
  const { user } = useAuth();
  const realUserSignedIn = user !== null && !isDemo();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef<DemoRole | null>(null);

  useEffect(() => {
    if (!startAs || started.current === startAs) return;
    started.current = startAs;
    queryClient.clear();
    startDemo(startAs);
    // Leave any real account too, so demo and real data never mix. Not awaited:
    // while the demo is on, every data call is answered by the demo store anyway.
    if (realUserSignedIn) void supabase.auth.signOut({ scope: "local" });
    void navigate({ to: ROLE_AREAS[startAs].base, replace: true });
  }, [startAs, navigate, queryClient, realUserSignedIn]);

  function reset() {
    resetDemoData();
    void queryClient.invalidateQueries();
    setMessage("The demo data is back to how it started.");
  }

  return (
    <main className="auth-page demo-page">
      <div className="auth-topline">
        <Link to="/" className="auth-brand">
          <span className="workspace-brand-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <strong>LearnBridge</strong>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auth">
            <ArrowLeft aria-hidden="true" /> Back to sign in
          </Link>
        </Button>
      </div>

      <section className="demo-intro">
        <p className="page-eyebrow">DEMO</p>
        <h1>Explore LearnBridge with sample data</h1>
        <p>
          Choose who to be. You'll see Greenridge Learning Centre and two other made-up schools,
          with their staff, parents, terms and audit history. You can change anything; it stays in
          this browser tab only and never reaches the real database.
        </p>
      </section>

      <ul className="demo-roles" aria-label="Demo roles">
        {DEMO_PERSONAS.map((p) => {
          const Icon = ICONS[p.role];
          const isActive = active === p.role;
          return (
            <li key={p.role}>
              <Link
                to="/demo"
                search={{ as: p.role }}
                className={`demo-role${isActive ? " is-active" : ""}`}
                aria-label={`Explore as ${p.title}`}
                aria-disabled={startAs !== null}
              >
                <span className="demo-role-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="demo-role-copy">
                  <strong>{p.title}</strong>
                  <span>{p.summary}</span>
                  {isActive ? <em>You're exploring as this role</em> : null}
                </span>
                {startAs === p.role ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="demo-footer">
        <Button variant="outline" size="sm" type="button" onClick={reset}>
          Reset demo data
        </Button>
        {message ? (
          <p className="form-message form-message--success" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
