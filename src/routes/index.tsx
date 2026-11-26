import { createFileRoute } from "@tanstack/react-router";

import { TeacherOverview } from "@/components/teacher/teacher-pages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard | LearnBridge" },
      {
        name: "description",
        content: "A focused teacher workspace for lessons, attendance, classes, and learner work.",
      },
      { property: "og:title", content: "Teacher Dashboard | LearnBridge" },
      {
        property: "og:description",
        content: "A clear view of teaching, learner progress, and upcoming work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherOverview,
});
