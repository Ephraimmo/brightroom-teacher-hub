import { describe, expect, it } from "vitest";

import { findSecrets, isEnvFile } from "@/lib/secret-scan";

// Secret-looking test values are assembled at runtime so this file itself
// never contains a string the scanner would flag.
const fakeSupabaseSecret = "sb_" + "secret_" + "a".repeat(24);
const base64url = (obj: object) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fakeJwt = (role: string) =>
  `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ role, iss: "supabase" })}.c2lnbmF0dXJl`;
const privateKeyHeader = "-----BEGIN " + "RSA PRIVATE KEY-----";

const rules = (file: string, content: string) => findSecrets(file, content).map((f) => f.rule);

describe("isEnvFile", () => {
  it("recognises env files but not the example template", () => {
    expect(isEnvFile(".env")).toBe(true);
    expect(isEnvFile("config/.env.production")).toBe(true);
    expect(isEnvFile(".env.example")).toBe(false);
    expect(isEnvFile("src/env.ts")).toBe(false);
  });
});

describe("findSecrets in env files", () => {
  it("allows the public Supabase values the project commits today", () => {
    const env = [
      'SUPABASE_PROJECT_ID="abc"',
      'SUPABASE_PUBLISHABLE_KEY="sb_publishable_xyz"',
      'SUPABASE_URL="https://abc.supabase.co"',
      'VITE_SUPABASE_PROJECT_ID="abc"',
      'VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xyz"',
      'VITE_SUPABASE_URL="https://abc.supabase.co"',
    ].join("\n");
    expect(findSecrets(".env", env)).toEqual([]);
  });

  it("flags a server-only variable that has a value", () => {
    const [finding] = findSecrets(".env", "\n\nPAYFAST_MERCHANT_KEY=abc123");
    expect(finding).toMatchObject({ rule: "server-variable-in-env-file", line: 3 });
    expect(finding?.detail).toContain("PAYFAST_MERCHANT_KEY");
  });

  it("flags a browser variable whose name says it is secret", () => {
    expect(rules(".env.production", "VITE_LIVEKIT_API_SECRET=abc")).toEqual([
      "secret-in-browser-variable",
    ]);
  });

  it("ignores comments, empty values and the example template", () => {
    expect(findSecrets(".env", "# SUPABASE_SERVICE_ROLE_KEY=abc\nLOVABLE_CRON_SECRET=")).toEqual(
      [],
    );
    expect(findSecrets(".env.example", "LOVABLE_CRON_SECRET=change-me")).toEqual([]);
  });
});

describe("findSecrets in any file", () => {
  it("flags a Supabase secret key", () => {
    expect(rules("src/x.ts", `const k = "${fakeSupabaseSecret}";`)).toEqual([
      "supabase-secret-key",
    ]);
  });

  it("flags a service-role JWT but not an anon JWT", () => {
    expect(rules("src/x.ts", `key: "${fakeJwt("service_role")}"`)).toEqual([
      "supabase-service-role-jwt",
    ]);
    expect(rules("src/x.ts", `key: "${fakeJwt("anon")}"`)).toEqual([]);
  });

  it("flags a private key block", () => {
    expect(rules("certs/key.pem", privateKeyHeader)).toEqual(["private-key"]);
  });

  it("never includes the secret value in the report", () => {
    const [finding] = findSecrets("src/x.ts", fakeSupabaseSecret);
    expect(JSON.stringify(finding)).not.toContain(fakeSupabaseSecret);
  });

  it("does not flag ordinary code", () => {
    expect(findSecrets("src/x.ts", "const url = process.env['SUPABASE_URL'];")).toEqual([]);
  });
});
