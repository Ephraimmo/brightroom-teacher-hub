/**
 * A redirect target from the address bar, kept only if it's a path inside
 * LearnBridge. Stops links like /auth/mfa?redirect=https://evil.example from
 * sending people to another site after they sign in.
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
