/**
 * School settings, academic years and terms (tracker P3-02). The database
 * enforces the same rules (db/pending/P3-02-school-settings.sql).
 */

export const POLICIES = [
  {
    key: "lesson_recording",
    label: "Lesson recordings",
    description:
      "Teachers may record online lessons. Learners and parents are told when recording.",
    default: false,
  },
  {
    key: "ai_assistance",
    label: "AI study help",
    description: "Learners may use the AI tutor for explanations and practice (not for tests).",
    default: false,
  },
  {
    key: "parent_messaging",
    label: "Parent messages",
    description: "Parents and teachers may message each other.",
    default: true,
  },
  {
    key: "learner_messaging",
    label: "Learner messages",
    description: "Learners may message their teachers. Learners can never message each other.",
    default: false,
  },
] as const;
export type PolicyKey = (typeof POLICIES)[number]["key"];
export type Policies = Record<PolicyKey, boolean>;

/** Stored policies with defaults filled in for switches never set. */
export function withPolicyDefaults(stored: Record<string, unknown>): Policies {
  return Object.fromEntries(
    POLICIES.map((p) => [p.key, typeof stored[p.key] === "boolean" ? stored[p.key] : p.default]),
  ) as Policies;
}

export interface Term {
  id: string;
  number: number;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface AcademicYear {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  terms: Term[];
}

export interface PeriodRow {
  year_id: string;
  year_label: string;
  year_starts_on: string;
  year_ends_on: string;
  year_is_current: boolean;
  term_id: string | null;
  term_number: number | null;
  term_starts_on: string | null;
  term_ends_on: string | null;
  term_is_current: boolean;
}

/** academic_periods() rows (one per term) → years with their terms. */
export function groupPeriods(rows: readonly PeriodRow[]): AcademicYear[] {
  const years = new Map<string, AcademicYear>();
  for (const r of rows) {
    let year = years.get(r.year_id);
    if (!year) {
      year = {
        id: r.year_id,
        label: r.year_label,
        startsOn: r.year_starts_on,
        endsOn: r.year_ends_on,
        isCurrent: r.year_is_current,
        terms: [],
      };
      years.set(r.year_id, year);
    }
    if (r.term_id && r.term_number !== null && r.term_starts_on && r.term_ends_on) {
      year.terms.push({
        id: r.term_id,
        number: r.term_number,
        startsOn: r.term_starts_on,
        endsOn: r.term_ends_on,
        isCurrent: r.term_is_current,
      });
    }
  }
  return [...years.values()];
}

export interface PeriodSelection {
  yearId: string | null;
  /** null = the whole year */
  termId: string | null;
}

/**
 * What class and report pages filter by when the person hasn't chosen:
 * the current year and its current term, else the newest year.
 */
export function defaultPeriod(years: readonly AcademicYear[]): PeriodSelection {
  const year = years.find((y) => y.isCurrent) ?? years[0];
  if (!year) return { yearId: null, termId: null };
  return { yearId: year.id, termId: year.terms.find((t) => t.isCurrent)?.id ?? null };
}

/** The date range a selection covers, for filtering records by date. */
export function periodRange(
  years: readonly AcademicYear[],
  selection: PeriodSelection,
): { from: string; to: string } | null {
  const year = years.find((y) => y.id === selection.yearId);
  if (!year) return null;
  const term = year.terms.find((t) => t.id === selection.termId);
  return term ? { from: term.startsOn, to: term.endsOn } : { from: year.startsOn, to: year.endsOn };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2;

export interface YearForm {
  label: string;
  startsOn: string;
  endsOn: string;
  makeCurrent: boolean;
}

export function validateYear(
  form: YearForm,
  others: readonly AcademicYear[],
): Partial<Record<"label" | "startsOn" | "endsOn", string>> {
  const errors: Partial<Record<"label" | "startsOn" | "endsOn", string>> = {};
  const label = form.label.trim();
  if (label.length < 2 || label.length > 20)
    errors.label = "Use a name like 2027 (2 to 20 characters).";
  if (!DATE.test(form.startsOn)) errors.startsOn = "Choose the first day of the year.";
  if (!DATE.test(form.endsOn)) errors.endsOn = "Choose the last day of the year.";
  if (errors.startsOn || errors.endsOn) return errors;
  if (form.endsOn <= form.startsOn) errors.endsOn = "The year must end after it starts.";
  else if (days(form.startsOn, form.endsOn) > 549)
    errors.endsOn = "A year can be at most 18 months.";
  else if (others.some((y) => overlaps(form.startsOn, form.endsOn, y.startsOn, y.endsOn))) {
    errors.startsOn = "These dates overlap another academic year.";
  }
  return errors;
}

export interface TermForm {
  number: number;
  startsOn: string;
  endsOn: string;
}

export function validateTerm(
  form: TermForm,
  year: AcademicYear,
): Partial<Record<"startsOn" | "endsOn", string>> {
  const errors: Partial<Record<"startsOn" | "endsOn", string>> = {};
  if (!DATE.test(form.startsOn)) errors.startsOn = "Choose the first day of the term.";
  if (!DATE.test(form.endsOn)) errors.endsOn = "Choose the last day of the term.";
  if (errors.startsOn || errors.endsOn) return errors;
  if (form.endsOn <= form.startsOn) errors.endsOn = "The term must end after it starts.";
  else if (form.startsOn < year.startsOn || form.endsOn > year.endsOn) {
    errors.startsOn = `Terms must fall inside ${year.label} (${year.startsOn} to ${year.endsOn}).`;
  } else if (
    year.terms.some(
      (t) => t.number !== form.number && overlaps(form.startsOn, form.endsOn, t.startsOn, t.endsOn),
    )
  ) {
    errors.startsOn = "These dates overlap another term.";
  }
  return errors;
}

/** Map a database refusal from the settings functions to a message. */
export function settingsErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  switch (code) {
    case "LBR40":
      return "One of the values isn't valid. Check the highlighted fields and try again.";
    case "LBR41":
      return "These dates overlap another year or term.";
    case "LBR42":
      return "A term would fall outside its academic year.";
    case "42501":
      return "Only this school's administrators can change its settings.";
    case "PGRST202":
    case "PGRST205":
      return "This isn't switched on in the database yet. The pending database updates (db/pending) need to be applied in Lovable.";
    default:
      return "That didn't save. Please try again.";
  }
}

/** "13 Jan 2027" */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
