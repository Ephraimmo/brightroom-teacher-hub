/**
 * MFA recovery (tracker P2-06): a platform admin removes every authenticator
 * of someone who lost their phone, so they can sign in with their password and
 * set up a new one. Needs Supabase's admin API, so it runs on the server.
 *
 * Checks, in order: the caller is signed in; the database says the caller is
 * a platform admin in an MFA-verified session (is_platform_admin() reads the
 * caller's own token); they're not resetting themselves; a reason is given.
 * The reset is written to the audit log as 'mfa.reset'.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withSafeErrors } from "@/lib/safe-error";

export interface ResetMfaInput {
  userId: string;
  reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown with a database-style code so the screen can explain it. */
function refusal(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

export function validateResetMfaInput(input: unknown): ResetMfaInput {
  const value = (input ?? {}) as Partial<ResetMfaInput>;
  if (typeof value.userId !== "string" || !UUID.test(value.userId)) {
    throw refusal("LBR03", "User not found");
  }
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw refusal("LBR02", "A reason is required");
  return { userId: value.userId, reason };
}

export const resetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateResetMfaInput)
  .handler(({ data, context }) =>
    withSafeErrors("admin.mfa_reset", async () => {
      const { data: isAdmin, error: checkError } = await context.supabase.rpc(
        "is_platform_admin" as never,
      );
      if (checkError) throw checkError;
      if (isAdmin !== true) throw refusal("42501", "Only platform administrators can do this");
      if (data.userId === context.userId) {
        throw refusal("LBR21", "You can't reset your own two-step sign-in");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const listed = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: data.userId });
      if (listed.error) throw listed.error;
      const factors = listed.data.factors;
      for (const factor of factors) {
        const removed = await supabaseAdmin.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId: data.userId,
        });
        if (removed.error) throw removed.error;
      }

      // audit_log isn't in the generated types until the P2-03 SQL is applied.
      const audit = await (
        supabaseAdmin as unknown as {
          from: (t: string) => {
            insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
          };
        }
      )
        .from("audit_log")
        .insert({
          actor_user_id: context.userId,
          actor_role: "platform_admin",
          action: "mfa.reset",
          entity_type: "user",
          entity_id: data.userId,
          before: { factors: factors.length },
          after: { factors: 0 },
          reason: data.reason,
        });
      if (audit.error) throw audit.error;
      return { removed: factors.length };
    }),
  );
