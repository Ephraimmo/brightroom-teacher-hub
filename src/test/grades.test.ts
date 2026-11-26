import { describe, expect, it } from "vitest";

import { findGrade, gradeLevels, isValidGradeCode, nextGrade } from "@/domain/grades";

describe("grade catalogue", () => {
  it("covers Grades 1–12 and the matric and exam-prep categories", () => {
    expect(gradeLevels.map((grade) => grade.code)).toEqual([
      "G01",
      "G02",
      "G03",
      "G04",
      "G05",
      "G06",
      "G07",
      "G08",
      "G09",
      "G10",
      "G11",
      "G12",
      "MATRIC_REWRITE",
      "MATRIC_UPGRADE",
      "EXAM_PREP",
    ]);
  });

  it("assigns the CAPS phases", () => {
    expect(findGrade("G03")?.phase).toBe("foundation");
    expect(findGrade("G04")?.phase).toBe("intermediate");
    expect(findGrade("G09")?.phase).toBe("senior");
    expect(findGrade("G10")?.phase).toBe("fet");
    expect(findGrade("EXAM_PREP")?.phase).toBe("adult");
  });

  it("promotes one grade at a time and stops after Grade 12", () => {
    expect(nextGrade("G01")?.code).toBe("G02");
    expect(nextGrade("G11")?.code).toBe("G12");
    expect(nextGrade("G12")).toBeNull();
    expect(nextGrade("MATRIC_UPGRADE")).toBeNull();
    expect(nextGrade("G13")).toBeNull();
  });

  it("validates codes", () => {
    expect(isValidGradeCode("G07")).toBe(true);
    expect(isValidGradeCode("Grade 7")).toBe(false);
  });
});
