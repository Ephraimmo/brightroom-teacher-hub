import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /teach/timetable (P1-03). Kept so old links and bookmarks still work.
export const Route = createFileRoute("/timetable")({
  beforeLoad: () => {
    throw redirect({ to: "/teach/timetable", replace: true });
  },
});
