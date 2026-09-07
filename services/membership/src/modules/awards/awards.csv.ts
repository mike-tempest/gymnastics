/**
 * The Rise CSV bridge.
 *
 * Rise Hub has no public API, so badge records move in and out of this product
 * as a spreadsheet. Parsing stays here, server-side and deliberately small:
 * a club exports its awarded badges, keys them into Rise Hub by hand, and
 * imports whatever Rise gives back.
 */

/** Column headers written on export and expected (case-insensitively) on import. */
export const RISE_CSV_COLUMNS = [
  'first_name',
  'last_name',
  'dob',
  'bg_membership_number',
  'scheme',
  'level',
  'award_date',
] as const;

/** Header aliases a club's own spreadsheet is likely to use. */
const HEADER_ALIASES: Record<string, string> = {
  'first name': 'first_name',
  forename: 'first_name',
  'last name': 'last_name',
  surname: 'last_name',
  'date of birth': 'dob',
  dateofbirth: 'dob',
  'bg membership number': 'bg_membership_number',
  'bg number': 'bg_membership_number',
  'membership number': 'bg_membership_number',
  'registration number': 'bg_membership_number',
  registration_number: 'bg_membership_number',
  'award scheme': 'scheme',
  scheme_name: 'scheme',
  badge: 'level',
  'level name': 'level',
  level_name: 'level',
  'award date': 'award_date',
  'date awarded': 'award_date',
  awarded_on: 'award_date',
};

export interface RiseCsvRow {
  first_name: string;
  last_name: string;
  dob: string;
  bg_membership_number: string;
  scheme: string;
  level: string;
  award_date: string;
}

/**
 * Quotes a single CSV field, doubling any embedded quote.
 *
 * A field starting with =, +, - or @ is also prefixed with an apostrophe. The
 * export exists to be opened in a spreadsheet before being keyed into Rise
 * Hub, and a name or membership number is club-entered text, so a leading =
 * would otherwise be evaluated as a formula when the file is opened.
 */
function quoteField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/** Serialises rows to a CSV string with the Rise column headers. */
export function toRiseCsv(rows: RiseCsvRow[]): string {
  const lines = [RISE_CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(RISE_CSV_COLUMNS.map((column) => quoteField(row[column] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Splits CSV text into rows of fields. Handles quoted fields containing
 * commas, newlines and doubled quotes, which covers every export the founding
 * clubs have produced so far. Anything more exotic belongs in a real parser.
 *
 * Blank rows are kept rather than dropped, so a caller can report a problem
 * against the line number the club actually sees in its spreadsheet.
 */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Normalise line endings so a Windows-authored file parses identically.
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < source.length; index++) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Flush the trailing field/row unless the file ended on a clean newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Whether a split row holds nothing but empty cells. */
function isBlankRow(cells: string[]): boolean {
  return cells.every((value) => value.trim() === '');
}

/** Maps a raw header cell onto one of the Rise column names, or null. */
function normaliseHeader(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/^﻿/, '');
  if ((RISE_CSV_COLUMNS as readonly string[]).includes(cleaned)) {
    return cleaned;
  }
  return HEADER_ALIASES[cleaned] ?? null;
}

export interface ParsedRiseCsvRow extends RiseCsvRow {
  /**
   * The row's 1-based line in the source file, header included. This is the
   * number a club needs to find the row in its own spreadsheet, so it counts
   * blank lines rather than the position among the rows that carried data.
   */
  lineNumber: number;
}

export interface ParsedRiseCsv {
  rows: ParsedRiseCsvRow[];
  /** Headers that were not recognised, reported back so a club can fix them. */
  unknownHeaders: string[];
  /** Recognised Rise columns the file did not supply. */
  missingHeaders: string[];
}

/** Parses Rise CSV text into typed rows, reporting unusable headers. */
export function parseRiseCsv(text: string): ParsedRiseCsv {
  const grid = splitCsv(text);
  // A leading blank line would otherwise be read as the header row.
  const headerIndex = grid.findIndex((cells) => !isBlankRow(cells));
  if (headerIndex === -1) {
    return { rows: [], unknownHeaders: [], missingHeaders: [...RISE_CSV_COLUMNS] };
  }

  const headerCells = grid[headerIndex];
  const unknownHeaders: string[] = [];
  const columnIndex = new Map<string, number>();

  headerCells.forEach((cell, index) => {
    const name = normaliseHeader(cell);
    if (!name) {
      if (cell.trim() !== '') unknownHeaders.push(cell.trim());
      return;
    }
    if (!columnIndex.has(name)) {
      columnIndex.set(name, index);
    }
  });

  const missingHeaders = RISE_CSV_COLUMNS.filter((column) => !columnIndex.has(column));

  const rows: ParsedRiseCsvRow[] = [];
  for (let index = headerIndex + 1; index < grid.length; index++) {
    const cells = grid[index];
    if (isBlankRow(cells)) continue;

    const read = (column: string): string => {
      const columnAt = columnIndex.get(column);
      return columnAt === undefined ? '' : (cells[columnAt] ?? '').trim();
    };

    rows.push({
      lineNumber: index + 1,
      first_name: read('first_name'),
      last_name: read('last_name'),
      dob: read('dob'),
      bg_membership_number: read('bg_membership_number'),
      scheme: read('scheme'),
      level: read('level'),
      award_date: read('award_date'),
    });
  }

  return { rows, unknownHeaders, missingHeaders: [...missingHeaders] };
}

/**
 * Normalises a date cell to an ISO yyyy-mm-dd key for matching.
 *
 * Accepts ISO already, and UK day-first formats (dd/mm/yyyy, dd-mm-yyyy),
 * because that is what a UK club's spreadsheet holds. An unparseable value
 * returns null so the caller can report the row rather than guess.
 */
export function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  const trimmed = value.trim();
  if (trimmed === '') return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const ukStyle = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (ukStyle) {
    const day = ukStyle[1].padStart(2, '0');
    const month = ukStyle[2].padStart(2, '0');
    return `${ukStyle[3]}-${month}-${day}`;
  }

  return null;
}
