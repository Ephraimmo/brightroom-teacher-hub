/**
 * Rules for catching secrets before they are committed.
 *
 * The committed `.env` may only hold values that are safe in a browser: the
 * Supabase URL, project ID and publishable key. Everything else (service-role
 * key, cron secret, payment and video keys) lives in Lovable Secrets and is
 * read only by server code through `process.env`.
 *
 * Findings never include the secret itself, only where it is and which rule
 * caught it, so the report is safe to print in CI logs.
 */

export interface SecretFinding {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

/** Server-side names whose values are public by design (they mirror VITE_ values). */
export const PUBLIC_ENV_NAMES: ReadonlySet<string> = new Set([
  "SUPABASE_URL",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PUBLISHABLE_KEY",
]);

/** Words that mean a variable is a secret, even if its name starts with VITE_. */
const SECRET_NAME_WORDS = /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|PASSPHRASE|TOKEN/;

const SUPABASE_SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{16,}/;
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** True for `.env`, `.env.production`, etc. The `.env.example` template is not an env file. */
export function isEnvFile(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  return /^\.env(\..+)?$/.test(name) && name !== ".env.example";
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

function decodeJwtRole(token: string): string | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role: unknown = JSON.parse(json).role;
    return typeof role === "string" ? role : undefined;
  } catch {
    return undefined;
  }
}

function checkEnvLine(file: string, lineNo: number, text: string): SecretFinding | undefined {
  const match = ENV_LINE.exec(text);
  if (!match || text.trimStart().startsWith("#")) return undefined;
  const name = match[1] ?? "";
  const value = stripQuotes(match[2] ?? "");
  if (value === "") return undefined;

  if (name.startsWith("VITE_")) {
    if (SECRET_NAME_WORDS.test(name)) {
      return {
        file,
        line: lineNo,
        rule: "secret-in-browser-variable",
        detail: `${name} is sent to every browser (VITE_ prefix) but its name says it is secret`,
      };
    }
    return undefined;
  }
  if (PUBLIC_ENV_NAMES.has(name)) return undefined;
  return {
    file,
    line: lineNo,
    rule: "server-variable-in-env-file",
    detail: `${name} has a value in a committed env file; keep server values in Lovable Secrets`,
  };
}

/** Scan one file's text. `file` is only used for reporting and to decide whether env rules apply. */
export function findSecrets(file: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const envFile = isEnvFile(file);
  const lines = content.split(/\r?\n/);

  lines.forEach((text, index) => {
    const line = index + 1;

    if (envFile) {
      const finding = checkEnvLine(file, line, text);
      if (finding) findings.push(finding);
    }
    if (SUPABASE_SECRET_KEY.test(text)) {
      findings.push({ file, line, rule: "supabase-secret-key", detail: "Supabase secret key" });
    }
    if (PRIVATE_KEY_BLOCK.test(text)) {
      findings.push({ file, line, rule: "private-key", detail: "private key block" });
    }
    for (const token of text.match(JWT) ?? []) {
      if (decodeJwtRole(token) === "service_role") {
        findings.push({
          file,
          line,
          rule: "supabase-service-role-jwt",
          detail: "Supabase service-role key (bypasses all row-level security)",
        });
      }
    }
  });

  return findings;
}
