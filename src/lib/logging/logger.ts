import { redact } from "./redact";

/**
 * Structured logging: one JSON object per line, so hosting logs can be
 * searched by event name or request ID. Everything passes through `redact`
 * first. See docs/logging.md.
 *
 *   logger.error("profile.save_failed", { error, requestId });
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  /** Ties together everything logged for one request; shown to users as "Reference". */
  requestId?: string;
  /** The thing that failed, if any. */
  error?: unknown;
  /** Anything else useful. Sensitive keys and values are removed automatically. */
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  time: string;
  event: string;
  where: "server" | "browser";
  requestId?: string;
  error?: unknown;
  context?: unknown;
}

export function buildLogEntry(level: LogLevel, event: string, context: LogContext = {}): LogEntry {
  const { requestId, error, ...rest } = context;
  const entry: LogEntry = {
    level,
    time: new Date().toISOString(),
    event,
    where: typeof window === "undefined" ? "server" : "browser",
  };
  if (typeof requestId === "string") entry.requestId = requestId;
  if (error !== undefined) entry.error = redact(error);
  if (Object.keys(rest).length > 0) entry.context = redact(rest);
  return entry;
}

function write(level: LogLevel, event: string, context?: LogContext) {
  const line = JSON.stringify(buildLogEntry(level, event, context));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};
