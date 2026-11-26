# Logging and error handling

How LearnBridge records problems without leaking personal data, and what users see when something fails.

## The rules

1. **Log with `logger`, not `console`.** `logger.error("learners.import_failed", { error, requestId, rows: 200 })`. It writes one JSON line per event, which hosting logs can search.
2. **Never put personal data or secrets in an error message or log on purpose.** The logger removes them anyway (see below), but don't rely on that alone.
3. **Wrap every route loader and server function in `withSafeErrors`.** When server code fails, the framework copies the thrown error into the page sent to the browser. The wrapper logs the real error and passes on only a safe one.
4. **Users never see raw error text.** Use `userMessageFor(error)` for the words, and give them the reference so support can find the log line.

## What is logged

Every entry looks like this:

```json
{
  "level": "error",
  "time": "2026-11-26T15:43:02.954Z",
  "event": "server.page_failed",
  "where": "server",
  "requestId": "dae6c71799204d8e",
  "error": {
    "name": "Error",
    "message": "Lookup failed for [email]",
    "code": "42501",
    "stack": "…"
  },
  "context": { "path": "/school/learners/:id" }
}
```

| Event                   | When                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `server.unhandled`      | The server crashed before the app could answer                           |
| `server.render_failed`  | Server rendering failed in a way the framework hid                       |
| `server.request_failed` | A request failed inside the app's request middleware                     |
| `server.page_failed`    | A page failed while being rendered on the server                         |
| `browser.page_failed`   | A page failed in the browser (also reported to Lovable's error tracking) |
| _your event_            | Anything you log with `logger`, named `area.what_happened`               |

## What is removed before logging

`src/lib/logging/redact.ts` runs on every log entry.

| Removed                                                                         | Replaced with            |
| ------------------------------------------------------------------------------- | ------------------------ |
| Fields named like password, secret, token, authorization, cookie, API key, OTP… | `[redacted]`             |
| Fields named like email, phone, name, ID number, address, date of birth…        | `[personal]`             |
| Email addresses anywhere in text                                                | `[email]`                |
| Supabase keys and JSON web tokens                                               | `[api-key]`, `[jwt]`     |
| `Bearer …` credentials, and `token=`, `code=`, `key=`… in URLs                  | `[redacted]`             |
| South African ID numbers (13 digits) and phone numbers                          | `[id-number]`, `[phone]` |
| Long random-looking parts of a path (invitation tokens, record IDs)             | `:id`                    |

Very long text is cut short, and deeply nested or circular data is trimmed.

## Request IDs (correlation)

- Every request gets an ID in `src/server.ts`. If the hosting edge already sent one (`x-request-id`, or Cloudflare's `cf-ray`), it is reused so our logs line up with theirs.
- The ID is returned in the `x-request-id` response header and written on every server log line for that request.
- The server's fallback error page shows it as **Reference: …**. In-app error screens show a reference too, which is logged with the error.
- A user who quotes the reference lets support find the exact log lines.

## What users see

| Situation                    | Message                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| No connection                | "You seem to be offline" — check your connection                    |
| Session expired              | "Please sign in again"                                              |
| Blocked by permissions (RLS) | "You don't have access to this" — ask your school administrator     |
| Record missing               | "We couldn't find that"                                             |
| Anything else                | "Something went wrong on our side" — try again, quote the reference |

Every route uses the app's own error and 404 screens (`src/components/app-shell/error-screens.tsx`, registered in `src/router.tsx`). The framework's built-in error screen is never used, because its **Show Error** button reveals the raw message.

## Where to read the logs

- **Development:** the terminal running `npm run dev`.
- **Production:** Lovable's project logs (Cloudflare Worker logs). Browser errors also appear in Lovable's error reporting.
- **Later:** an error-monitoring service (Sentry is planned; see `.env.example`). The logger is the single place to connect it.
