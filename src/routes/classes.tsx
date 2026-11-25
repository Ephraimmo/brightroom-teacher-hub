import { createFileRoute } from "@tanstack/react-router";

import { TeacherClassesPage } from "@/components/teacher/teacher-pages";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "My Classes | LearnBridge" },
      { name: "description", content: "Review teaching groups, learner counts, and sample attendance." },
      { property: "og:title", content: "My Classes | LearnBridge" },
      { property: "og:description", content: "Teaching groups and attendance for a sample teacher workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherClassesPage,
});