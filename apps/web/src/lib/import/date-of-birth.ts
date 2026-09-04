/**
 * Explicit date-of-birth parsing for roster imports.
 *
 * UK and AU exports write dates day-first (DD/MM/YYYY) and Excel is happy
 * to emit D/M/YY or YYYY-MM-DD depending on the machine that saved the
 * file. We never hand an ambiguous string to `new Date(...)`, whose
 * behaviour is locale and engine dependent; every accepted shape is
 * matched explicitly and validated as a real calendar date.
 */

/** Helper text shown next to date columns in the import UI. */
export const DOB_FORMAT_HINT =
  'Dates can be YYYY-MM-DD or day-first (DD/MM/YYYY). Ambiguous dates such as 05/06/2015 are read day-first, so 5 June 2015.';

const ISO_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const DAY_FIRST_PATTERN = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/;

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Expand a two-digit year with a pivot on the current year: values up to
 * the current two-digit year are 20xx, later values are 19xx. In 2026,
 * "08" is 2008 and "98" is 1998, which is the sensible reading for a
 * swimmer's date of birth.
 */
export function expandTwoDigitYear(twoDigit: number, referenceYear: number = new Date().getFullYear()): number {
  const pivot = referenceYear % 100;
  return twoDigit <= pivot ? 2000 + twoDigit : 1900 + twoDigit;
}

/**
 * Parse a date of birth into YYYY-MM-DD, or return null when the value is
 * not recognisable or not a real calendar date.
 *
 * Accepted shapes:
 * - YYYY-MM-DD (also YYYY/MM/DD)
 * - DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - the same day-first shapes with a two-digit year (pivot: see
 *   {@link expandTwoDigitYear})
 *
 * When both day and month are 12 or less the value is genuinely
 * ambiguous; both AU and UK read dates day-first, so day-first wins.
 */
export function parseDateOfBirth(
  value: string,
  referenceYear: number = new Date().getFullYear(),
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number;
  let day: number;

  const iso = trimmed.match(ISO_PATTERN);
  const dayFirst = trimmed.match(DAY_FIRST_PATTERN);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = Number(dayFirst[2]);
    year = dayFirst[3].length === 2 ? expandTwoDigitYear(Number(dayFirst[3]), referenceYear) : Number(dayFirst[3]);
  } else {
    return null;
  }

  if (year < 1900 || !isRealDate(year, month, day)) return null;

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
