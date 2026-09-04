/**
 * SportSystems CSV file format parser and generator.
 *
 * SportSystems is a UK-specific format used by ~30% of UK meets.
 * Entry files and results files are CSV with header rows.
 */

import {
  FileParser,
  ParsedMeetData,
  ParsedSwimmer,
  ParsedEntry,
  ParsedResult,
  ParserValidationOptions,
  ValidationResult,
  ValidationError,
  VALID_DISTANCES,
  VALID_STROKES,
  parseTimeString,
  formatTimeString,
  validateRegistrationNumber,
} from './parser.interface';

/** Expected headers for SportSystems entry files */
const ENTRY_HEADERS = [
  'ClubCode',
  'ClubName',
  'SwimmerSENumber',
  'LastName',
  'FirstName',
  'Gender',
  'DOB',
  'Event',
  'Distance',
  'Stroke',
  'EntryTime',
];

/** Expected headers for SportSystems results files */
const RESULT_HEADERS = [
  'Event',
  'Heat',
  'Lane',
  'SwimmerSENumber',
  'LastName',
  'FirstName',
  'Time',
  'Place',
  'DQ',
  'Splits',
];

export class SportSystemsParser implements FileParser {
  /**
   * Parse a SportSystems entry CSV file.
   */
  parseEntries(content: string): ParsedMeetData {
    const { headers, rows } = this.parseCSV(content);
    this.validateHeaders(headers, ENTRY_HEADERS, 'entry');

    const data: ParsedMeetData = {
      meetName: '',
      entries: [],
      results: [],
    };

    for (const row of rows) {
      const record = this.zipRow(headers, row);
      if (!record['SwimmerSENumber']) continue; // Skip empty rows

      const swimmer: ParsedSwimmer = {
        seNumber: record['SwimmerSENumber'].trim(),
        lastName: record['LastName'].trim(),
        firstName: record['FirstName'].trim(),
        gender: record['Gender'].trim().toUpperCase().charAt(0) as 'M' | 'F',
        dateOfBirth: this.parseUKDate(record['DOB']),
        teamName: record['ClubName']?.trim(),
        teamCode: record['ClubCode']?.trim(),
      };

      // Derive distance and stroke from Event field or dedicated columns
      const eventStr = record['Event']?.trim() || '';
      const distanceStr = record['Distance']?.trim();
      const strokeStr = record['Stroke']?.trim();

      let distance: number;
      let stroke: string;

      if (distanceStr && strokeStr) {
        distance = parseInt(distanceStr, 10);
        stroke = this.normaliseStroke(strokeStr);
      } else {
        const parsed = this.parseEventString(eventStr);
        distance = parsed.distance;
        stroke = parsed.stroke;
      }

      const entry: ParsedEntry = {
        swimmer,
        eventName: eventStr || `${distance} ${stroke}`,
        distance,
        stroke,
        entryTime: this.parseSportSystemsTime(record['EntryTime']),
      };

      data.entries.push(entry);

      // Capture team info from first row
      if (!data.teamName && record['ClubName']) {
        data.teamName = record['ClubName'].trim();
        data.teamCode = record['ClubCode']?.trim();
      }
    }

    return data;
  }

  /**
   * Parse a SportSystems results CSV file.
   */
  parseResults(content: string): ParsedMeetData {
    const { headers, rows } = this.parseCSV(content);
    this.validateHeaders(headers, RESULT_HEADERS, 'results');

    const data: ParsedMeetData = {
      meetName: '',
      entries: [],
      results: [],
    };

    for (const row of rows) {
      const record = this.zipRow(headers, row);
      if (!record['SwimmerSENumber']) continue;

      const swimmer: ParsedSwimmer = {
        seNumber: record['SwimmerSENumber'].trim(),
        lastName: record['LastName'].trim(),
        firstName: record['FirstName'].trim(),
        gender: 'M', // Gender not in results file — default, will be resolved during import
        dateOfBirth: new Date(0), // DOB not in results file — resolved during import
      };

      const eventStr = record['Event']?.trim() || '';
      const { distance, stroke } = this.parseEventString(eventStr);

      const dqValue = record['DQ']?.trim().toUpperCase();
      const isDQ = dqValue === 'Y' || dqValue === 'YES' || dqValue === 'DQ';

      const result: ParsedResult = {
        swimmer,
        eventName: eventStr,
        distance,
        stroke,
        time: isDQ ? 0 : this.parseSportSystemsTime(record['Time']),
        place: record['Place'] ? parseInt(record['Place'].trim(), 10) : undefined,
        heat: record['Heat'] ? parseInt(record['Heat'].trim(), 10) : undefined,
        lane: record['Lane'] ? parseInt(record['Lane'].trim(), 10) : undefined,
        dq: isDQ,
        splits: this.parseSplitsString(record['Splits']),
      };

      data.results.push(result);
    }

    return data;
  }

  /**
   * Generate a SportSystems entry CSV file.
   */
  generateEntryFile(data: ParsedMeetData): string {
    const lines: string[] = [];

    // Header row
    lines.push(ENTRY_HEADERS.join(','));

    for (const entry of data.entries) {
      const s = entry.swimmer;
      const row = [
        this.csvEscape(s.teamCode || data.teamCode || ''),
        this.csvEscape(s.teamName || data.teamName || ''),
        this.csvEscape(s.seNumber),
        this.csvEscape(s.lastName),
        this.csvEscape(s.firstName),
        s.gender,
        this.formatUKDate(s.dateOfBirth),
        this.csvEscape(entry.eventName || `${entry.distance} ${entry.stroke}`),
        String(entry.distance),
        entry.stroke,
        formatTimeString(entry.entryTime),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Generate a SportSystems results CSV file.
   */
  generateResultFile(data: ParsedMeetData): string {
    const lines: string[] = [];

    lines.push(RESULT_HEADERS.join(','));

    for (const result of data.results) {
      const row = [
        this.csvEscape(result.eventName || `${result.distance} ${result.stroke}`),
        result.heat != null ? String(result.heat) : '',
        result.lane != null ? String(result.lane) : '',
        this.csvEscape(result.swimmer.seNumber),
        this.csvEscape(result.swimmer.lastName),
        this.csvEscape(result.swimmer.firstName),
        result.dq ? 'DQ' : formatTimeString(result.time),
        result.place != null ? String(result.place) : '',
        result.dq ? 'Y' : 'N',
        result.splits ? result.splits.map((s) => formatTimeString(s)).join(';') : '',
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Validate parsed meet data.
   */
  validate(data: ParsedMeetData, options?: ParserValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];

    data.entries.forEach((entry, idx) => {
      this.validateSwimmer(entry.swimmer, idx + 1, errors, options);
      this.validateTime(entry.entryTime, idx + 1, 'entryTime', errors);
      this.validateEvent(entry.distance, entry.stroke, idx + 1, errors);
    });

    data.results.forEach((result, idx) => {
      validateRegistrationNumber(result.swimmer.seNumber, idx + 1, errors, options);
      if (!result.dq) {
        this.validateTime(result.time, idx + 1, 'time', errors);
      }
      this.validateEvent(result.distance, result.stroke, idx + 1, errors);
    });

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
    };
  }

  // --- CSV parsing ---

  private parseCSV(content: string): { headers: string[]; rows: string[][] } {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('Empty file');
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows = lines.slice(1).map((line) => this.parseCSVLine(line));

    return { headers, rows };
  }

  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = i + 1 < line.length ? line[i + 1] : '';

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    fields.push(current);

    return fields;
  }

  private zipRow(headers: string[], values: string[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = values[i] || '';
    }
    return record;
  }

  private validateHeaders(actual: string[], expected: string[], fileType: string): void {
    // Check that at least the critical headers are present
    const actualNormalised = actual.map((h) => h.trim().toLowerCase());
    const missing = expected.filter((h) => !actualNormalised.includes(h.toLowerCase()));
    if (missing.length > expected.length / 2) {
      throw new Error(
        `Invalid SportSystems ${fileType} file: missing headers: ${missing.join(', ')}`,
      );
    }
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // --- Date helpers ---

  /**
   * Parse UK date format (DD/MM/YYYY) to Date.
   */
  parseUKDate(dateStr: string): Date {
    const trimmed = dateStr.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 3) {
      throw new Error(`Invalid UK date format: "${dateStr}" (expected DD/MM/YYYY)`);
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date values: day=${day}, month=${month}`);
    }

    return new Date(year, month - 1, day);
  }

  /**
   * Format Date to UK date format (DD/MM/YYYY).
   */
  private formatUKDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  }

  // --- Time helpers ---

  /**
   * Parse SportSystems time (M:SS.HH or MM:SS.HH or SS.HH) to seconds.
   */
  parseSportSystemsTime(timeStr: string): number {
    if (!timeStr || !timeStr.trim()) return 0;
    return parseTimeString(timeStr);
  }

  private parseSplitsString(splitsStr: string | undefined): number[] {
    if (!splitsStr || !splitsStr.trim()) return [];
    return splitsStr
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseTimeString(s));
  }

  // --- Event parsing ---

  /**
   * Parse event string like "50 Free" or "100 Breaststroke" into distance + stroke.
   */
  private parseEventString(eventStr: string): { distance: number; stroke: string } {
    const trimmed = eventStr.trim();

    // Try "DISTANCE STROKE" pattern
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (match) {
      return {
        distance: parseInt(match[1], 10),
        stroke: this.normaliseStroke(match[2]),
      };
    }

    // Try event code like "100FR", "50BA"
    const codeMatch = trimmed.match(/^(\d+)(FR|BA|BR|BK|FL|FLY|IM|FREE|BACK|BREAST|FLY)$/i);
    if (codeMatch) {
      return {
        distance: parseInt(codeMatch[1], 10),
        stroke: this.normaliseStroke(codeMatch[2]),
      };
    }

    throw new Error(`Cannot parse event: "${eventStr}"`);
  }

  /**
   * Normalise stroke name to standard form.
   */
  private normaliseStroke(stroke: string): string {
    const normalised = stroke.trim().toLowerCase();
    const map: Record<string, string> = {
      free: 'Freestyle',
      freestyle: 'Freestyle',
      fr: 'Freestyle',
      back: 'Backstroke',
      backstroke: 'Backstroke',
      ba: 'Backstroke',
      bk: 'Backstroke',
      breast: 'Breaststroke',
      breaststroke: 'Breaststroke',
      br: 'Breaststroke',
      fly: 'Butterfly',
      butterfly: 'Butterfly',
      fl: 'Butterfly',
      im: 'Individual Medley',
      'individual medley': 'Individual Medley',
      medley: 'Individual Medley',
    };
    return map[normalised] || stroke;
  }

  // --- Validation helpers ---

  private validateSwimmer(
    swimmer: ParsedSwimmer,
    row: number,
    errors: ValidationError[],
    options?: ParserValidationOptions,
  ): void {
    validateRegistrationNumber(swimmer.seNumber, row, errors, options);

    if (swimmer.gender !== 'M' && swimmer.gender !== 'F') {
      errors.push({
        row,
        field: 'gender',
        value: swimmer.gender,
        message: 'Gender must be M or F',
        severity: 'error',
      });
    }

    const dob = swimmer.dateOfBirth;
    const now = new Date();
    if (dob > now) {
      errors.push({
        row,
        field: 'dateOfBirth',
        value: dob.toISOString(),
        message: 'Date of birth cannot be in the future',
        severity: 'error',
      });
    }
  }

  private validateTime(time: number, row: number, field: string, errors: ValidationError[]): void {
    if (time <= 0) {
      errors.push({
        row,
        field,
        value: formatTimeString(time),
        message: 'Time must be greater than 0',
        severity: 'error',
      });
    }
    if (time > 1800) {
      errors.push({
        row,
        field,
        value: formatTimeString(time),
        message: 'Time exceeds 30 minutes — likely invalid',
        severity: 'warning',
      });
    }
  }

  private validateEvent(
    distance: number,
    stroke: string,
    row: number,
    errors: ValidationError[],
  ): void {
    if (!VALID_DISTANCES.includes(distance)) {
      errors.push({
        row,
        field: 'distance',
        value: String(distance),
        message: `Invalid distance: ${distance}m`,
        severity: 'error',
      });
    }
    if (!VALID_STROKES.includes(stroke as any)) {
      errors.push({
        row,
        field: 'stroke',
        value: stroke,
        message: `Unrecognised stroke: ${stroke}`,
        severity: 'error',
      });
    }
  }
}
