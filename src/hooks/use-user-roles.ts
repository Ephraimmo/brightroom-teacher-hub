import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/integrations/supabase/client";

/**
 * The signed-in user's roles from `user_roles`. Row-level security only
 * returns the user's own rows. Shared cache key with the account page.
 */
export function useUserRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-roles", user?.id ?? "signed-out"],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Sign in to view account access.");
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });
}
