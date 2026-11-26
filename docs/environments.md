# Environments and configuration

How LearnBridge is configured in development, testing and production, where each setting lives, and how secrets are kept out of the code.

The longer-term plan is in [plan/09-deployment.md](plan/09-deployment.md). This page describes what is set up **today** and what still needs doing.

## The environments

| Environment           | Where it runs                                                  | Backend it uses                     | Status                            |
| --------------------- | -------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| **Development**       | Your computer (`npm run dev`)                                  | The Lovable Cloud project in `.env` | Works                             |
| **CI**                | GitHub Actions, on every push to `main` and every pull request | None (no database tests yet)        | Works                             |
| **Preview / staging** | Lovable preview                                                | Should be a separate test project   | **Not separated yet** (see below) |
| **Production**        | Lovable published app (Cloudflare)                             | Lovable Cloud production            | Works                             |

### ⚠️ Development and production share one database today

There is only one Lovable Cloud project. `.env` points at it, and so does the published app. That means anything you create while testing locally or in the Lovable preview (accounts, schools, learners) lands in the same database as real users.

This is acceptable **only while there is no real learner data**. Before any real school or family uses the platform:

1. Create a second Lovable Cloud project (or Lovable's test environment, if available on your plan) for staging.
2. Apply the same migrations to it.
3. Point local development and previews at it by changing the six `SUPABASE_*` values in your local environment, as described in _Using a different backend locally_ below.
4. Never copy real learner data into it (POPIA).

## Where each setting lives

There are two kinds of value. The full list is in [`.env.example`](../.env.example).

| Kind       | Examples                                                                               | Where it lives                           | Who can see it                 |
| ---------- | -------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| **Public** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and their non-`VITE_` twins       | `.env` (committed, written by Lovable)   | Anyone; they're in the browser |
| **Secret** | `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_CRON_SECRET`, later PayFast, LiveKit, email keys | **Lovable → Project settings → Secrets** | Server code only               |

Rules:

- **`VITE_` means public.** Anything whose name starts with `VITE_` is copied into the JavaScript every visitor downloads. Never give a secret a `VITE_` name.
- **Secrets are read only in server code**, through `process.env['NAME']`, in files that run on the server (server functions, `*.server.ts`). Never in a component.
- **The publishable key is safe to share.** It can only do what row-level security allows a signed-out or signed-in user to do. The service-role key bypasses all of that, so it never leaves the server.
- **Separate keys per environment.** Staging uses its own Supabase project and sandbox payment credentials; production keys are never used outside production.
- **Rotate** keys at least yearly and immediately if one is exposed. The cron secret supports a current and previous value so it can be rotated without downtime.

## The secret check

`npm run check:secrets` scans every file that git would commit and fails if it finds:

| Rule                          | Catches                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `server-variable-in-env-file` | Any variable in a committed env file other than the public Supabase values                          |
| `secret-in-browser-variable`  | A `VITE_` variable whose name contains SECRET, SERVICE_ROLE, PRIVATE, PASSWORD, PASSPHRASE or TOKEN |
| `supabase-secret-key`         | A Supabase secret key (`sb_secret_…`)                                                               |
| `supabase-service-role-jwt`   | A legacy Supabase service-role key                                                                  |
| `private-key`                 | A private key block (`-----BEGIN … PRIVATE KEY-----`)                                               |

It runs in CI on every push and pull request, and as part of `npm run check`. The report says which file and line, but never prints the secret itself.

Files that only exist on your computer (`.env.local`, `.env.*`, `.dev.vars`) are ignored by git, so they are not scanned and can hold local secrets.

**If the check fails:** delete the value from the file, add it in Lovable Secrets, and read it with `process.env` in server code. If the secret was ever pushed to GitHub, treat it as exposed and rotate it, because it stays in the git history.

## Running locally

Requires Node.js 22.18 or later (this machine has Node 26).

```sh
npm install          # first time only
npm run dev          # open the http://localhost:… address it prints
```

Server-only secrets are not available locally, because they live in Lovable. Features that need them (scheduled jobs, and later payments and live video) only work in the Lovable preview or the published app until a staging project exists.

### Using a different backend locally

Create `.env.local` (git ignores it) with the six `SUPABASE_*` values of the other project. Vite reads `.env.local` after `.env`, so its values take priority. Delete the file to go back. (Not yet tried against a second project; confirm this when the staging project is created.)

## Checks before every push

| Command                 | What it checks                     |
| ----------------------- | ---------------------------------- |
| `npm run typecheck`     | TypeScript types                   |
| `npm run lint`          | Code rules                         |
| `npm run format:check`  | Formatting                         |
| `npm run test`          | Unit tests                         |
| `npm run check:secrets` | No secrets in committed files      |
| `npm run check`         | All of the above except formatting |
| `npm run build`         | Production build                   |

CI runs every one of these on GitHub.
