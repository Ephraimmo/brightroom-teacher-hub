import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /teach/homework (P1-03). Kept so old links and bookmarks still work.
export const Route = createFileRoute("/homework")({
  beforeLoad: () => {
    throw redirect({ to: "/teach/homework", replace: true });
  },
});
