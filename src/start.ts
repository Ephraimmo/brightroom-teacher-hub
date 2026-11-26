import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logging/logger";
import { redactPath } from "./lib/logging/redact";
import { REQUEST_ID_HEADER, requestIdOf } from "./lib/request-id";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request, pathname }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Set by src/server.ts for every request.
    const requestId = requestIdOf(request);
    logger.error("server.request_failed", {
      requestId,
      error,
      method: request.method,
      path: redactPath(pathname),
    });
    return new Response(renderErrorPage(requestId), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", [REQUEST_ID_HEADER]: requestId },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// requestMiddleware runs on every request; functionMiddleware only on server functions, where
// client sendContext is unvalidated input. Append to these arrays, never replace them.
// Enabling Lovable Cloud adds functionMiddleware: [attachSupabaseAuth], the bearer token that
// requireSupabaseAuth server functions need. Add it by hand only if Lovable Cloud or a
// user-managed Supabase project is connected, no middleware here sets Authorization, and the
// project did not intentionally replace it.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
