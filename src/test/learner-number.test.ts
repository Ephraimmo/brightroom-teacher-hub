import { describe, expect, it } from "vitest";

import {
  formatLearnerNumber,
  isValidLearnerNumber,
  luhnCheckDigit,
  normalizeLearnerNumber,
} from "@/domain/learner-number";

describe("learner numbers", () => {
  it("computes standard Luhn check digits", () => {
    // 7992739871 is the textbook Luhn example; its check digit is 3.
    expect(luhnCheckDigit("7992739871")).toBe(3);
    expect(luhnCheckDigit("0")).toBe(0);
  });

  it("formats year, padded sequence and check digit", () => {
    const number = formatLearnerNumber(2026, 4211);
    expect(number).toMatch(/^LB26-004211-\d$/);
    expect(isValidLearnerNumber(number)).toBe(true);
  });

  it("gives different numbers different check digits for neighbouring sequences", () => {
    const numbers = new Set(
      Array.from({ length: 50 }, (_, index) => formatLearnerNumber(2027, index + 1)),
    );
    expect(numbers.size).toBe(50);
  });

  it("accepts what people type and returns the canonical form", () => {
    const canonical = formatLearnerNumber(2026, 4211);
    const typed = ` ${canonical.toLowerCase().replaceAll("-", "")} `;
    expect(normalizeLearnerNumber(typed)).toBe(canonical);
  });

  it("rejects a single mistyped digit and a swapped pair of digits", () => {
    const canonical = formatLearnerNumber(2026, 4211); // LB26-004211-c
    const wrongDigit = canonical.replace("004211", "004218");
    const swapped = canonical.replace("004211", "004121");
    expect(isValidLearnerNumber(wrongDigit)).toBe(false);
    expect(isValidLearnerNumber(swapped)).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const input of ["", "LB26-4211-1", "XX26-004211-1", "LB26-004211", "LB2600421112"]) {
      expect(isValidLearnerNumber(input)).toBe(false);
    }
  });

  it("refuses out-of-range years and sequences", () => {
    expect(() => formatLearnerNumber(1999, 1)).toThrow();
    expect(() => formatLearnerNumber(2026, 0)).toThrow();
    expect(() => formatLearnerNumber(2026, 1_000_000)).toThrow();
    expect(() => formatLearnerNumber(2026, 1.5)).toThrow();
  });
});
