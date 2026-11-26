/**
 * Fails (exit code 1) if any file that would be committed contains a secret.
 * Run with `npm run check:secrets`. Uses Node's built-in TypeScript support.
 *
 * In a git checkout it scans exactly what git would commit (tracked files plus
 * new files that are not ignored), so local-only files such as `.env.local`
 * are left alone. Outside git it walks the folder and skips the same kinds of
 * files that .gitignore excludes.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { findSecrets, type SecretFinding } from "../src/lib/secret-scan.ts";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".output",
  ".wrangler",
  ".vinxi",
  ".tanstack",
  ".nitro",
  "dist",
  "dist-ssr",
]);
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|eot|pdf|zip|gz|xlsx?|docx?|pptx?|mp[34]|webm|wasm)$/i;
const LOCAL_ONLY = /(^|[\\/])(\.dev\.vars|[^\\/]*\.local)$/;
const MAX_BYTES = 2 * 1024 * 1024;

function gitFiles(root: string): string[] | undefined {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.split("\0").filter(Boolean);
  } catch {
    return undefined;
  }
}

function walk(root: string, dir = root, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, full, files);
    } else if (entry.isFile()) {
      files.push(relative(root, full));
    }
  }
  return files;
}

const root = process.cwd();
const files = (gitFiles(root) ?? walk(root)).filter(
  (f) => !BINARY_EXT.test(f) && !LOCAL_ONLY.test(f),
);

const findings: SecretFinding[] = [];
for (const file of files) {
  const full = join(root, file);
  let size: number;
  try {
    size = statSync(full).size;
  } catch {
    continue; // listed by git but deleted locally
  }
  if (size > MAX_BYTES) continue;
  findings.push(...findSecrets(file, readFileSync(full, "utf8")));
}

if (findings.length > 0) {
  console.error(`Secret check failed: ${findings.length} problem(s) found.\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.detail}`);
  console.error("\nMove these values to Lovable Secrets and read them in server code only.");
  console.error("See docs/environments.md.");
  process.exit(1);
}
console.log(`Secret check passed: ${files.length} files scanned, no secrets found.`);
