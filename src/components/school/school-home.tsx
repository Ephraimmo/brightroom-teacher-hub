import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

import { EmptyState } from "@/components/design/states";
import { MEMBERSHIP_ROLE_LABELS } from "@/domain/schools";

import { SchoolShell } from "./school-shell";

/** The links on the school home page, one per school-admin page that exists. */
const SECTIONS: { to: string; title: string; text: string }[] = [];

/** School admin home: which school this is, and where to go next. */
export function SchoolHome() {
  return (
    <SchoolShell
      title="School administration"
      description="Your school's details, staff and families."
    >
      {(school) => (
        <>
          <section className="workspace-panel school-summary">
            <p className="section-eyebrow">YOUR SCHOOL</p>
            <h2>{school.name}</h2>
            <p className="people-note">
              You're a {MEMBERSHIP_ROLE_LABELS[school.role].toLowerCase()}
              {school.title ? ` (${school.title})` : ""} here.
            </p>
          </section>
          {SECTIONS.length > 0 ? (
            <ul className="school-sections">
              {SECTIONS.map((s) => (
                <li key={s.to} className="workspace-panel">
                  <Link to={s.to} className="school-section-link">
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <EmptyState
            icon={Construction}
            title="More school tools are on the way"
            description="Learners, classes, attendance and reports will appear here as they're built."
          />
        </>
      )}
    </SchoolShell>
  );
}
