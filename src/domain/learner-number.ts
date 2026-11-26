/**
 * Learner numbers look like `LB26-004211-7`:
 *   LB      platform prefix
 *   26      two-digit registration year
 *   004211  sequence within that year (issued by the database)
 *   7       Luhn check digit, so a mistyped number is caught before it is looked up
 */
const PREFIX = "LB";
const MAX_SEQUENCE = 999_999;
const PATTERN = /^LB(\d{2})-?(\d{6})-?(\d)$/;

export function luhnCheckDigit(digits: string): number {
  if (!/^\d+$/.test(digits)) throw new Error("Luhn input must contain digits only.");

  let sum = 0;
  // Walk from the right; the digit next to the (future) check digit is doubled first.
  for (let offset = 0; offset < digits.length; offset += 1) {
    let digit = Number(digits[digits.length - 1 - offset]);
    if (offset % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

export function formatLearnerNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    throw new Error("Registration year must be between 2000 and 2099.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE) {
    throw new Error(`Sequence must be between 1 and ${MAX_SEQUENCE}.`);
  }

  const yy = String(year % 100).padStart(2, "0");
  const seq = String(sequence).padStart(6, "0");
  return `${PREFIX}${yy}-${seq}-${luhnCheckDigit(yy + seq)}`;
}

/**
 * Accepts what people type (lower case, spaces, missing dashes) and returns the
 * canonical form, or null when the number is malformed or the check digit is wrong.
 */
export function normalizeLearnerNumber(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  const match = PATTERN.exec(compact);
  if (!match) return null;

  const [, yy = "", seq = "", check = ""] = match;
  if (luhnCheckDigit(yy + seq) !== Number(check)) return null;
  return `${PREFIX}${yy}-${seq}-${check}`;
}

export function isValidLearnerNumber(input: string): boolean {
  return normalizeLearnerNumber(input) !== null;
}
