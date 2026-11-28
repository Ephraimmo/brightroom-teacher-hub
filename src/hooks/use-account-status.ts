import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { isAccountStatus, type AccountStatus } from "@/domain/account-status";
import { isDemo } from "@/demo/demo-session";
import { myAccountStatus } from "@/demo/demo-store";
import { supabase } from "@/integrations/supabase/client";

// account_states isn't in the generated types until Lovable applies the P2-05 SQL.
// TODO(P2-05): use `supabase` directly once the types include it.
const db = supabase as unknown as SupabaseClient;

/** PostgREST "table not found" / Postgres "undefined table": P2-05 isn't applied yet. */
const TABLE_MISSING = new Set(["PGRST205", "42P01"]);

/**
 * The signed-in user's account status. No row means active. Before the
 * database update is applied, everyone counts as active.
 */
export function useAccountStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-status", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: async (): Promise<AccountStatus> => {
      if (!user) throw new Error("Sign in first.");
      if (isDemo()) return myAccountStatus();
      const { data, error } = await db
        .from("account_states")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        if (TABLE_MISSING.has(error.code)) return "active";
        throw error;
      }
      const status = (data as { status?: unknown } | null)?.status;
      return isAccountStatus(status) ? status : "active";
    },
  });
}
