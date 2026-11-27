import type { MySchool } from "@/lib/schools";

/** Choose which school to work in, for people who belong to several. */
export function SchoolSwitcher({
  schools,
  current,
  onChoose,
}: {
  schools: MySchool[];
  current: MySchool | null;
  onChoose: (id: string) => void;
}) {
  if (schools.length < 2 || !current) return null;
  return (
    <label className="role-switcher">
      <span className="sr-only">School</span>
      <select value={current.institutionId} onChange={(e) => onChoose(e.currentTarget.value)}>
        {schools.map((s) => (
          <option key={s.institutionId} value={s.institutionId}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
