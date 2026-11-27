import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

import { EmptyState } from "@/components/design/states";
import { formatDate } from "@/domain/school-settings";
import { MEMBERSHIP_ROLE_LABELS } from "@/domain/schools";

import { PeriodFilter } from "./period-filter";
import { SchoolShell } from "./school-shell";
import { usePeriodFilter } from "./use-period-filter";

/** The links on the school home page, one per school-admin page that exists. */
const SECTIONS: { to: string; title: string; text: string }[] = [
  {
    to: "/school/settings",
    title: "Settings",
    text: "School details, academic years and terms, grades and policies.",
  },
];

/** School admin home: which school this is, and where to go next. */
export function SchoolHome() {
  return (
    <SchoolShell
      title="School administration"
      description="Your school's details, staff and families."
    >
      {(school) => (
        <>
          <CurrentPeriod institutionId={school.institutionId} />
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

/** The current term, from the school's calendar (P3-02). */
function CurrentPeriod({ institutionId }: { institutionId: string }) {
  const { years, selection, setSelection, isLoading } = usePeriodFilter(institutionId);
  if (isLoading) return null;
  const year = years.find((y) => y.id === selection.yearId);
  const term = year?.terms.find((t) => t.id === selection.termId);
  return (
    <section className="workspace-panel school-summary" aria-label="Academic period">
      <p className="section-eyebrow">ACADEMIC CALENDAR</p>
      {year ? (
        <>
          <h2>
            {year.label}
            {term ? `, Term ${term.number}` : ""}
          </h2>
          <p className="people-note">
            {term
              ? `${formatDate(term.startsOn)} to ${formatDate(term.endsOn)}`
              : "No term is set for today. Add terms in Settings."}
          </p>
          <PeriodFilter years={years} selection={selection} onChange={setSelection} />
        </>
      ) : (
        <p className="people-note">
          No academic year set up yet. Add one in Settings so classes and reports can filter by
          term.
        </p>
      )}
    </section>
  );
}
