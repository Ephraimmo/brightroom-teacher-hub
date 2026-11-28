import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { endDemo, isDemo } from "@/demo/demo-session";
import { clearDemoData } from "@/demo/demo-store";
import { supabase } from "@/integrations/supabase/client";

/** Signs out, clears cached data from the previous user, and returns to sign-in. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    await queryClient.cancelQueries();
    queryClient.clear();
    if (isDemo()) {
      endDemo();
      clearDemoData();
      await navigate({ to: "/demo", replace: true });
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError("You could not be signed out. Please try again.");
      return;
    }
    await navigate({ to: "/auth", replace: true });
  }

  return { signOut, error };
}
