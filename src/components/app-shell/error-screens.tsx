import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { logger } from "@/lib/logging/logger";
import { redactPath } from "@/lib/logging/redact";
import { newRequestId } from "@/lib/request-id";
import { userMessageFor } from "@/lib/user-messages";

/** Shown for any address that doesn't match a page. Registered as the router default. */
export function NotFoundScreen() {
  return (
    <StatusPage
      kind="not-found"
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      actions={
        <Button asChild>
          <Link to="/">Go to my home page</Link>
        </Button>
      }
    />
  );
}

/**
 * Shown when any page fails. Registered as the router default, so no route
 * falls back to the framework's own error screen (which can reveal the raw
 * error message). The user sees a plain message and a reference; the details
 * go to the logs, scrubbed of personal data.
 */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  // Browser-only values are filled in after hydration so the server and
  // browser render the same HTML.
  const [reference, setReference] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const message = userMessageFor(error, online);

  // During server rendering effects don't run, so log here instead.
  if (typeof window === "undefined") {
    logger.error("server.page_failed", { error, path: redactPath(pathname) });
  }

  useEffect(() => {
    const ref = newRequestId();
    setReference(ref);
    setOnline(navigator.onLine);
    logger.error("browser.page_failed", {
      requestId: ref,
      error,
      path: redactPath(window.location.pathname),
    });
    reportLovableError(error, { boundary: "router_error_component", reference: ref });
  }, [error]);

  return (
    <StatusPage
      kind="error"
      title={message.title}
      description={
        <>
          {message.description}
          {reference ? (
            <span className="mt-3 block text-xs">
              Reference: <code>{reference}</code>
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Go to my home page</a>
          </Button>
        </>
      }
    />
  );
}
