/**
 * File parsing for the import wizards: CSV via Papa Parse and Excel
 * workbooks via SheetJS. Both funnel into the same shape, a list of
 * header strings plus rows keyed by those headers, so the mapping and
 * validation steps do not care which format was uploaded.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

export class SpreadsheetParseError extends Error {}

/** File extensions the import wizards accept, for the file picker. */
export const IMPORT_FILE_ACCEPT = '.csv,.xlsx';

export function isSupportedImportFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.xlsx');
}

/**
 * Convert an Excel serial date number to YYYY-MM-DD. Handles the 1904
 * epoch used by some Mac-authored workbooks and Excel's fictional
 * 29 February 1900 (serial 60 in the 1900 system), which returns null.
 * The time-of-day fraction is ignored.
 */
export function excelSerialDateToIso(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial)) return null;
  let days = Math.floor(serial) + (date1904 ? 1462 : 0);
  if (days < 1) return null;
  if (!date1904) {
    if (days === 60) return null;
    // Serials 1-59 predate Excel's imaginary 1900 leap day, so they are
    // one day behind the 1899-12-30 epoch used for later serials.
    if (days < 60) days += 1;
  }
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
  return date.toISOString().slice(0, 10);
}

function formatDateCell(value: Date): string {
  // SheetJS builds Date objects in local time; read them back the same way.
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cellToString(cell: XLSX.CellObject | undefined, date1904: boolean): string {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.t === 'n' && typeof cell.v === 'number') {
    // Date cells reach us as serial numbers; recognise them by their
    // number format and convert with the workbook's epoch.
    if (typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z)) {
      return excelSerialDateToIso(cell.v, date1904) ?? '';
    }
    return String(cell.v);
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    return formatDateCell(cell.v);
  }
  if (cell.t === 'b') {
    return cell.v ? 'TRUE' : 'FALSE';
  }
  return String(cell.v).trim();
}

/**
 * Parse the first worksheet of an .xlsx workbook. The header row is the
 * first row with at least two non-empty cells (tolerating a title row or
 * leading blank rows); fully empty data rows are skipped and duplicate or
 * empty headers are made unique so no column silently overwrites another.
 */
export function parseWorkbook(data: ArrayBuffer): ParsedSpreadsheet {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellNF: true });
  } catch {
    throw new SpreadsheetParseError('This file could not be read as an Excel workbook.');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet || !sheet['!ref']) {
    throw new SpreadsheetParseError('The workbook has no data in its first worksheet.');
  }

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const grid: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cellToString(cell, date1904));
    }
    grid.push(row);
  }

  const filled = (row: string[]) => row.filter((v) => v !== '').length;
  let headerIndex = grid.findIndex((row) => filled(row) >= 2);
  if (headerIndex === -1) headerIndex = grid.findIndex((row) => filled(row) >= 1);
  if (headerIndex === -1) {
    throw new SpreadsheetParseError('The worksheet has no header row.');
  }

  const headers: string[] = [];
  const seen = new Set<string>();
  grid[headerIndex].forEach((raw, i) => {
    const header = raw.trim() || `Column ${i + 1}`;
    let unique = header;
    let suffix = 2;
    while (seen.has(unique)) {
      unique = `${header} (${suffix})`;
      suffix += 1;
    }
    seen.add(unique);
    headers.push(unique);
  });

  const rows: Record<string, string>[] = [];
  for (let r = headerIndex + 1; r < grid.length; r++) {
    if (filled(grid[r]) === 0) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = grid[r][i] ?? '';
    });
    rows.push(record);
  }

  return { headers, rows };
}

/** Strip a leading UTF-8 BOM, which Excel prepends to CSV exports. */
function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

/** Parse CSV text into the shared spreadsheet shape. */
export function parseCsvText(text: string): ParsedSpreadsheet {
  const result = Papa.parse<Record<string, string>>(stripBom(text), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new SpreadsheetParseError(
      `CSV parsing error (row ${(first.row ?? 0) + 1}): ${first.message}`
    );
  }

  return { headers: result.meta.fields ?? [], rows: result.data };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new SpreadsheetParseError('The file could not be read.'));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new SpreadsheetParseError('The file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse an uploaded .csv or .xlsx file. Rejects with
 * {@link SpreadsheetParseError} for unsupported or malformed files.
 */
export async function parseImportFile(file: File): Promise<ParsedSpreadsheet> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) {
    return parseCsvText(await readFileAsText(file));
  }
  if (lower.endsWith('.xlsx')) {
    return parseWorkbook(await readFileAsArrayBuffer(file));
  }
  throw new SpreadsheetParseError('Please upload a .csv or .xlsx file.');
}
