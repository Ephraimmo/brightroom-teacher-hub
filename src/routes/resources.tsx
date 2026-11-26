import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /teach/resources (P1-03). Kept so old links and bookmarks still work.
export const Route = createFileRoute("/resources")({
  beforeLoad: () => {
    throw redirect({ to: "/teach/resources", replace: true });
  },
});
