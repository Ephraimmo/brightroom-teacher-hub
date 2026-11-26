import { isNotFound, isRedirect } from "@tanstack/react-router";

import { logger, type LogContext } from "./logging/logger";
import { classifyError, userMessageFor } from "./user-messages";

/**
 * Wrap every route loader and server function body in `withSafeErrors`.
 *
 * Why: when a loader fails during server rendering, the framework copies the
 * thrown error (including its message) into the page HTML so the browser can
 * show it. A database error can mention an email, a name or an ID. This wrapper
 * logs the real error (scrubbed) and throws a plain error instead, keeping only
 * what the error screen needs to pick a friendly message.
 *
 *   loader: () => withSafeErrors("learners.load", async () => { ... }),
 *
 * Redirects and not-found signals pass through unchanged.
 */
export async function withSafeErrors<T>(
  event: string,
  fn: () => Promise<T> | T,
  context: LogContext = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) throw error;
    logger.error(event, { ...context, error });
    throw toPublicError(error);
  }
}

/** A copy of `error` that is safe to send to the browser: no original message, no stack. */
export function toPublicError(error: unknown): Error {
  const kind = classifyError(error);
  const safe = new Error(userMessageFor(error).title);
  safe.name = "PublicError";
  // The stack points into server code; don't send it to the browser.
  delete safe.stack;
  // Keep just enough for classifyError to give the same answer in the browser.
  const fields: Record<typeof kind, Record<string, unknown>> = {
    offline: { message: "Failed to fetch" },
    session: { status: 401 },
    forbidden: { status: 403 },
    "not-found": { status: 404 },
    unknown: {},
  };
  const { message, ...rest } = fields[kind];
  if (typeof message === "string") safe.message = message;
  return Object.assign(safe, rest);
}
