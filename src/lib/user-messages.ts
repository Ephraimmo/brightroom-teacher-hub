/**
 * Turns any failure into a short message a teacher, parent or learner can act
 * on. Raw error text is never shown: it can contain internal details, and it
 * doesn't help the person reading it.
 */
export interface UserMessage {
  kind: "offline" | "session" | "forbidden" | "not-found" | "unknown";
  title: string;
  description: string;
}

const MESSAGES: Record<UserMessage["kind"], Omit<UserMessage, "kind">> = {
  offline: {
    title: "You seem to be offline",
    description: "Check your internet or mobile data connection, then try again.",
  },
  session: {
    title: "Please sign in again",
    description: "Your session has ended, so we couldn't load this. Sign in and try again.",
  },
  forbidden: {
    title: "You don't have access to this",
    description: "If you think you should, ask your school administrator.",
  },
  "not-found": {
    title: "We couldn't find that",
    description: "It may have been moved or removed.",
  },
  unknown: {
    title: "Something went wrong on our side",
    description:
      "Please try again. If it keeps happening, contact support and quote the reference below.",
  },
};

function field(error: unknown, key: string): unknown {
  return error && typeof error === "object" ? (error as Record<string, unknown>)[key] : undefined;
}

export function classifyError(error: unknown, online = true): UserMessage["kind"] {
  const message = String(field(error, "message") ?? (typeof error === "string" ? error : ""));
  const code = String(field(error, "code") ?? "");
  const status = Number(field(error, "status") ?? field(error, "statusCode") ?? NaN);

  if (!online || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "offline";
  }
  if (
    status === 401 ||
    code === "PGRST301" ||
    /jwt expired|invalid jwt|session.*(expired|missing)/i.test(message)
  ) {
    return "session";
  }
  // 42501 = Postgres "insufficient privilege", which row-level security raises.
  if (status === 403 || code === "42501") return "forbidden";
  if (status === 404 || code === "PGRST116") return "not-found";
  return "unknown";
}

export function userMessageFor(error: unknown, online = true): UserMessage {
  const kind = classifyError(error, online);
  return { kind, ...MESSAGES[kind] };
}
