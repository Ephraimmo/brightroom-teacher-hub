import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import type { PlatformRole } from "@/domain/permissions";
import { supabase } from "@/integrations/supabase/client";

const KNOWN: readonly PlatformRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "learner",
  "parent",
];

// my_roles() isn't in the generated types until Lovable applies the P3-01 SQL.
// TODO(P3-01): call supabase.rpc("my_roles") directly once the types include it.
const db = supabase as unknown as SupabaseClient;

/**
 * The signed-in user's roles: global roles (user_roles) plus school roles
 * from active memberships (P3-01's my_roles()). Before that database update is
 * applied, falls back to reading user_roles, where RLS returns only the
 * user's own rows. Shared cache key with the account page.
 */
export function useUserRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-roles", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: async (): Promise<{ role: PlatformRole }[]> => {
      if (!user) throw new Error("Sign in to view account access.");
      const combined = await db.rpc("my_roles");
      if (!combined.error) {
        const values = ((combined.data as unknown[] | null) ?? []).map(String);
        return KNOWN.filter((r) => values.includes(r)).map((role) => ({ role }));
      }
      if (combined.error.code !== "PGRST202") throw combined.error;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });
}
