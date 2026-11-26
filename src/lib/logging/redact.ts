/**
 * Removes secrets and personal information before anything is logged.
 *
 * Logs leave the app (hosting logs, error monitoring), and LearnBridge holds
 * children's data, so the rule is: log what went wrong and where, never who it
 * happened to or the keys involved (POPIA; docs/logging.md).
 */

/** Keys whose values are secrets. */
const SECRET_KEY =
  /pass(word|phrase)?|secret|token|authori[sz]ation|cookie|api[-_]?key|service[-_]?role|credential|otp|signature/i;

/** Keys whose values identify a person. */
const PERSONAL_KEY =
  /e-?mail|phone|mobile|cell|whatsapp|id[-_]?number|full[-_]?name|display[-_]?name|first[-_]?name|last[-_]?name|surname|address|birth|dob/i;

const STRING_RULES: [RegExp, string][] = [
  // "Bearer abc..." headers (first, so the whole credential goes)
  [/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 [redacted]"],
  // JSON Web Tokens (Supabase access and service-role keys)
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  // Supabase API keys
  [/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[api-key]"],
  // Secrets in URLs: ?token=..., &access_token=..., #refresh_token=...
  [
    /([?&#](?:access_token|refresh_token|token|code|key|apikey|api_key|password|secret)=)[^&#\s"']+/gi,
    "$1[redacted]",
  ],
  // Email addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  // South African ID numbers (13 digits)
  [/\b\d{13}\b/g, "[id-number]"],
  // South African phone numbers: 082 123 4567, +27 82 123 4567, 0821234567
  [/(?:\+27|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[phone]"],
];

const MAX_DEPTH = 6;
const MAX_STRING = 4000;
const MAX_ITEMS = 50;

/**
 * A URL path that is safe to log: long random-looking segments (invitation
 * tokens, link codes, record IDs) become ":id", and the query string is dropped.
 */
export function redactPath(pathname: string): string {
  return (pathname.split("?")[0] ?? "")
    .split("/")
    .map((segment) => (/^[A-Za-z0-9_-]{16,}$/.test(segment) ? ":id" : segment))
    .join("/");
}

export function redactString(value: string): string {
  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  for (const [pattern, replacement] of STRING_RULES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Returns a copy of `value` that is safe to log: sensitive keys are replaced,
 * strings are scrubbed, Errors become `{ name, message, stack }`, and deep,
 * large or circular structures are cut short.
 */
export function redact(value: unknown): unknown {
  return walk(value, 0, new WeakSet());
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") {
    return typeof value === "function" || typeof value === "symbol" ? `[${typeof value}]` : value;
  }
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[too deep]";
  seen.add(value);

  if (value instanceof Error) return serializeError(value, depth, seen);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => walk(v, depth + 1, seen));
    if (value.length > MAX_ITEMS) items.push(`[${value.length - MAX_ITEMS} more]`);
    return items;
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value).slice(0, MAX_ITEMS)) {
    if (SECRET_KEY.test(key)) out[key] = "[redacted]";
    else if (PERSONAL_KEY.test(key)) out[key] = "[personal]";
    else out[key] = walk(v, depth + 1, seen);
  }
  return out;
}

function serializeError(error: Error, depth: number, seen: WeakSet<object>) {
  const extra = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  const out: Record<string, unknown> = {
    name: error.name,
    message: redactString(error.message),
  };
  if (error.stack) out["stack"] = redactString(error.stack);
  if (typeof extra.code === "string" || typeof extra.code === "number") out["code"] = extra.code;
  const status = extra.status ?? extra.statusCode;
  if (typeof status === "number") out["status"] = status;
  if (error.cause !== undefined) out["cause"] = walk(error.cause, depth + 1, seen);
  return out;
}
