import { createFileRoute } from "@tanstack/react-router";

import { TeacherTimetablePage } from "@/components/teacher/teacher-pages";

export const Route = createFileRoute("/teach/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable | LearnBridge" },
      { name: "description", content: "View a teacher’s weekly timetable and lesson details." },
      { property: "og:title", content: "Timetable | LearnBridge" },
      {
        property: "og:description",
        content: "A sample weekly view of lessons, times, subjects, and rooms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherTimetablePage,
});
