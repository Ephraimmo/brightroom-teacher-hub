import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import type { AssuranceLevel, MfaState } from "@/domain/mfa";
import { supabase } from "@/integrations/supabase/client";

export interface MfaFactor {
  id: string;
  friendlyName: string;
  createdAt: string;
}

export interface MfaInfo extends MfaState {
  factors: MfaFactor[];
}

export const mfaKey = (userId: string | undefined) => ["mfa", userId ?? "signed-out"] as const;

const level = (value: unknown): AssuranceLevel | null =>
  value === "aal1" || value === "aal2" ? value : null;

/** This session's MFA level and the person's verified authenticator apps. */
export function useMfa() {
  const { user } = useAuth();
  return useQuery({
    queryKey: mfaKey(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<MfaInfo> => {
      const [aal, factors] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (aal.error) throw aal.error;
      if (factors.error) throw factors.error;
      const verified = factors.data.totp.map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name ?? "Authenticator app",
        createdAt: f.created_at,
      }));
      return {
        currentLevel: level(aal.data.currentLevel),
        nextLevel: level(aal.data.nextLevel),
        verifiedFactors: verified.length,
        factors: verified,
      };
    },
  });
}
