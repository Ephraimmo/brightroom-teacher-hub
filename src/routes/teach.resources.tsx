import { createFileRoute } from "@tanstack/react-router";

import { TeacherResourcesPage } from "@/components/teacher/teacher-pages";

export const Route = createFileRoute("/teach/resources")({
  head: () => ({
    meta: [
      { title: "Learning Resources | LearnBridge" },
      {
        name: "description",
        content: "Browse sample teacher notes, worksheets, study guides, and past papers.",
      },
      { property: "og:title", content: "Learning Resources | LearnBridge" },
      {
        property: "og:description",
        content: "A searchable sample library organized by class and subject.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherResourcesPage,
});
