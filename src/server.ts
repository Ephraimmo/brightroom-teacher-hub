import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logging/logger";
import { redactPath } from "./lib/logging/redact";
import { REQUEST_ID_HEADER, requestIdFrom, tagRequest } from "./lib/request-id";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  requestId: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  logger.error("server.render_failed", {
    requestId,
    error: consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  });
  return errorResponse(requestId);
}

function errorResponse(requestId: string): Response {
  return new Response(renderErrorPage(requestId), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", [REQUEST_ID_HEADER]: requestId },
  });
}

/** Return the request ID to the browser so it can be matched to server logs. */
function withRequestId(response: Response, requestId: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    // Some responses have read-only headers; copy into a new response.
    const copy = new Response(response.body, response);
    copy.headers.set(REQUEST_ID_HEADER, requestId);
    return copy;
  }
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Tag the request so middleware and server functions can log the same ID.
    // The request object itself is passed on unchanged: the dev server and the
    // Worker runtime both rely on their own Request class.
    const requestId = requestIdFrom(request.headers);
    tagRequest(request, requestId);

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withRequestId(await normalizeCatastrophicSsrResponse(response, requestId), requestId);
    } catch (error) {
      logger.error("server.unhandled", {
        requestId,
        error,
        method: request.method,
        path: redactPath(new URL(request.url).pathname),
      });
      return errorResponse(requestId);
    }
  },
};
