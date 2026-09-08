/**
 * The shared CSV writer.
 *
 * Every CSV this service hands to a club goes through here: the Rise badge
 * bridge (`modules/awards/awards.csv.ts`) and the full club export
 * (`modules/export`). Escaping a spreadsheet safely is easy to get subtly
 * wrong, so there is exactly one implementation of it.
 *
 * Output is comma separated with LF line endings and a trailing newline.
 * Excel, Numbers and LibreOffice all read LF, and the Rise bridge's file
 * format is pinned by its own specs, so the line ending stays as it is.
 */

/** Anything a CSV cell can be built from before it is formatted to text. */
export type CsvValue = string | number | boolean | Date | null | undefined | object;

/**
 * A row keyed by column name. Typed as a plain object rather than an index
 * signature so a concrete row interface (RiseCsvRow, say) can be passed
 * without having to declare one.
 */
export type CsvRowRecord = object;

/**
 * Quotes a single CSV field, doubling any embedded quote.
 *
 * A field starting with =, +, - or @ is also prefixed with an apostrophe. A
 * club's export exists to be opened in a spreadsheet, and almost every value
 * in it is club-entered text, so a leading = would otherwise be evaluated as
 * a formula when the file is opened. The apostrophe is consumed by the
 * spreadsheet on open, so the value a club sees is unchanged.
 */
export function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/**
 * Renders a value as CSV text, before escaping.
 *
 * Null and undefined become an empty cell rather than the words "null" or
 * "undefined". Dates are written in full ISO 8601 so the value round-trips;
 * objects and arrays (jsonb columns) are written as JSON, which is the only
 * honest single-cell representation of them.
 */
export function formatCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** The header line for a set of columns, without its trailing newline. */
export function csvHeaderLine(columns: readonly string[]): string {
  return columns.map((column) => escapeCsvField(column)).join(',');
}

/** One data line for a row, without its trailing newline. */
export function csvBodyLine(columns: readonly string[], row: CsvRowRecord): string {
  const cells = row as Record<string, CsvValue>;
  return columns.map((column) => escapeCsvField(formatCsvValue(cells[column]))).join(',');
}

/** Serialises rows to a complete CSV document with a header line. */
export function toCsv(columns: readonly string[], rows: readonly CsvRowRecord[]): string {
  const lines = [csvHeaderLine(columns)];
  for (const row of rows) {
    lines.push(csvBodyLine(columns, row));
  }
  return `${lines.join('\n')}\n`;
}
