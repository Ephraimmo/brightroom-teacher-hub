import { FormField } from "@/components/design/form-field";
import type { AcademicYear, PeriodSelection } from "@/domain/school-settings";

/** Year and term dropdowns. Renders nothing until the school has a year. */
export function PeriodFilter({
  years,
  selection,
  onChange,
}: {
  years: AcademicYear[];
  selection: PeriodSelection;
  onChange: (next: PeriodSelection) => void;
}) {
  const year = years.find((y) => y.id === selection.yearId);
  if (!year) return null;
  return (
    <div className="period-filter">
      <FormField id="period-year" label="Academic year">
        <select
          className="native-select"
          value={year.id}
          onChange={(e) => {
            const next = years.find((y) => y.id === e.currentTarget.value);
            onChange({
              yearId: e.currentTarget.value,
              termId: next?.terms.find((t) => t.isCurrent)?.id ?? null,
            });
          }}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="period-term" label="Term">
        <select
          className="native-select"
          value={selection.termId ?? ""}
          onChange={(e) => onChange({ yearId: year.id, termId: e.currentTarget.value || null })}
        >
          <option value="">Whole year</option>
          {year.terms.map((t) => (
            <option key={t.id} value={t.id}>
              Term {t.number}
              {t.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}
