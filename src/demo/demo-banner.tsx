import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";

import { personaFor } from "./demo-data";
import { endDemo } from "./demo-session";
import { clearDemoData, resetDemoData } from "./demo-store";
import { useDemoRole } from "./use-demo-role";

/** Shown on every page while demo mode is on. */
export function DemoBanner() {
  const role = useDemoRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  if (!role) return null;

  function reset() {
    resetDemoData();
    void queryClient.invalidateQueries();
  }

  async function leave() {
    endDemo();
    clearDemoData();
    queryClient.clear();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="demo-banner" role="region" aria-label="Demo mode">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>Demo mode</strong>, exploring as {personaFor(role).title}. Sample data only; nothing
        is saved to LearnBridge.
      </p>
      <div className="demo-banner-actions">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/demo">Switch role</Link>
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={reset}>
          Reset data
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={() => void leave()}>
          Leave demo
        </Button>
      </div>
    </div>
  );
}
