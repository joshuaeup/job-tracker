const MIN_SALARY = 30_000;
const MAX_SALARY = 600_000;

// Matches: $120,000 – $150,000 | $120k - $150k | $120,000 to $150,000
// Second $ sign is optional. Handles –, —, -, and "to" as separators.
const SALARY_RE =
  /\$\s*([\d,]+)\s*([kK])?\s*(?:–|—|-|to)\s*\$?\s*([\d,]+)\s*([kK])?/i;

const toAmount = (digits: string, k: string | undefined): number => {
  const n = parseFloat(digits.replace(/,/g, ''));
  return k !== undefined ? n * 1_000 : n;
};

const isPlausible = (n: number): boolean => n >= MIN_SALARY && n <= MAX_SALARY;

/**
 * Extracts the first salary range found in a plain-text job description.
 * Returns null for both fields when no plausible annual range is detected.
 */
export const parseSalaryFromText = (
  text: string,
): { min: number | null; max: number | null } => {
  const match = SALARY_RE.exec(text);
  if (!match) return { min: null, max: null };

  const minDigits = match[1];
  const maxDigits = match[3];
  if (!minDigits || !maxDigits) return { min: null, max: null };

  const min = toAmount(minDigits, match[2]);
  const max = toAmount(maxDigits, match[4]);

  if (!isPlausible(min) || !isPlausible(max) || min >= max) {
    return { min: null, max: null };
  }

  return { min, max };
};
