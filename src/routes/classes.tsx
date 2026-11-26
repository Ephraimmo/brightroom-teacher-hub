import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /teach/classes (P1-03). Kept so old links and bookmarks still work.
export const Route = createFileRoute("/classes")({
  beforeLoad: () => {
    throw redirect({ to: "/teach/classes", replace: true });
  },
});
