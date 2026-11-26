/**
 * Grade catalogue: Grades 1–12 plus the non-school categories the platform serves.
 * Mirrors the `grade_levels` reference table planned in docs/plan/02-database-schema.md.
 */
export type GradePhase = "foundation" | "intermediate" | "senior" | "fet" | "adult";

export interface GradeLevel {
  code: string;
  label: string;
  phase: GradePhase;
  sortOrder: number;
}

function schoolPhase(grade: number): GradePhase {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

const schoolGrades: GradeLevel[] = Array.from({ length: 12 }, (_, index) => {
  const grade = index + 1;
  return {
    code: `G${String(grade).padStart(2, "0")}`,
    label: `Grade ${grade}`,
    phase: schoolPhase(grade),
    sortOrder: grade,
  };
});

export const gradeLevels: readonly GradeLevel[] = [
  ...schoolGrades,
  { code: "MATRIC_REWRITE", label: "Matric rewrite", phase: "adult", sortOrder: 13 },
  { code: "MATRIC_UPGRADE", label: "Matric upgrade", phase: "adult", sortOrder: 14 },
  { code: "EXAM_PREP", label: "Exam preparation", phase: "adult", sortOrder: 15 },
];

export function findGrade(code: string): GradeLevel | undefined {
  return gradeLevels.find((grade) => grade.code === code);
}

export function isValidGradeCode(code: string): boolean {
  return findGrade(code) !== undefined;
}

/** The grade a learner moves to on promotion, or null when there is no next school grade. */
export function nextGrade(code: string): GradeLevel | null {
  const current = findGrade(code);
  if (!current || current.phase === "adult" || current.sortOrder >= 12) return null;
  return gradeLevels.find((grade) => grade.sortOrder === current.sortOrder + 1) ?? null;
}
