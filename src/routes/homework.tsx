import { createFileRoute } from "@tanstack/react-router";

import { TeacherHomeworkPage } from "@/components/teacher/teacher-pages";

export const Route = createFileRoute("/homework")({
  head: () => ({
    meta: [
      { title: "Homework & Tests | LearnBridge" },
      { name: "description", content: "Review sample assignments, due dates, and submission progress." },
      { property: "og:title", content: "Homework & Tests | LearnBridge" },
      { property: "og:description", content: "Track sample assignment submissions and marking workload." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherHomeworkPage,
});