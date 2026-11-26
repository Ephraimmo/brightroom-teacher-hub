import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError("You could not be signed out. Please try again.");
      return;
    }
    await navigate({ to: "/auth", replace: true });
  }

  return { signOut, error };
}
