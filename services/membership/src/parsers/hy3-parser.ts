/**
 * Hy-Tek HY3 file format parser and generator.
 *
 * HY3 is a fixed-width, line-based text format used by ~60% of UK meets.
 * Record types: A1 (file), B1 (meet), C1 (team), D1 (swimmer),
 *               E1 (entry), F1 (relay), G1 (splits), Z0 (EOF).
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
  formatTimeString,
  validateRegistrationNumber,
} from './parser.interface';

/**
 * Hy-Tek uses ISO 3166-1 alpha-3 country codes in C1 team records. Club
 * countries are stored as alpha-2, so map them; the historical 'UK' value is
 * accepted as an alias for GBR.
 */
const COUNTRY_ALPHA3: Record<string, string> = {
  GB: 'GBR',
  UK: 'GBR',
  AU: 'AUS',
  US: 'USA',
  CA: 'CAN',
  IE: 'IRL',
};

function toAlpha3Country(country?: string): string {
  if (!country) return 'GBR';
  const upper = country.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return COUNTRY_ALPHA3[upper] ?? 'GBR';
}

const STROKE_CODE_MAP: Record<string, string> = {
  '1': 'Freestyle',
  '2': 'Backstroke',
  '3': 'Breaststroke',
  '4': 'Butterfly',
  '5': 'Individual Medley',
};

const STROKE_TO_CODE: Record<string, string> = {
  Freestyle: '1',
  Backstroke: '2',
  Breaststroke: '3',
  Butterfly: '4',
  'Individual Medley': '5',
};

export class HY3Parser implements FileParser {
  /**
   * Parse a HY3 entry file into structured meet data.
   */
  parseEntries(content: string): ParsedMeetData {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const data: ParsedMeetData = {
      meetName: '',
      entries: [],
      results: [],
    };

    let currentSwimmer: ParsedSwimmer | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const recordType = line.substring(0, 2);

      switch (recordType) {
        case 'A1':
          // File descriptor — skip
          break;
        case 'B1':
          this.parseMeetInfo(line, data);
          break;
        case 'C1':
          this.parseTeamInfo(line, data);
          break;
        case 'D1':
          currentSwimmer = this.parseSwimmerRecord(line, i + 1);
          break;
        case 'E1':
          if (currentSwimmer) {
            const entry = this.parseEntryRecord(line, currentSwimmer, i + 1);
            if (entry) data.entries.push(entry);
          }
          break;
        case 'Z0':
          // End of file
          break;
        default:
          // Ignore unknown record types (F1 relay, G1 splits, etc.)
          break;
      }
    }

    return data;
  }

  /**
   * Parse a HY3 results file into structured meet data.
   * Results files have the same structure but E1 records contain final times
   * and additional result fields.
   */
  parseResults(content: string): ParsedMeetData {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const data: ParsedMeetData = {
      meetName: '',
      entries: [],
      results: [],
    };

    let currentSwimmer: ParsedSwimmer | null = null;
    let currentResult: ParsedResult | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const recordType = line.substring(0, 2);

      switch (recordType) {
        case 'A1':
          break;
        case 'B1':
          this.parseMeetInfo(line, data);
          break;
        case 'C1':
          this.parseTeamInfo(line, data);
          break;
        case 'D1':
          currentSwimmer = this.parseSwimmerRecord(line, i + 1);
          break;
        case 'E1':
          if (currentSwimmer) {
            currentResult = this.parseResultRecord(line, currentSwimmer, i + 1);
            if (currentResult) data.results.push(currentResult);
          }
          break;
        case 'G1':
          if (currentResult) {
            const splits = this.parseSplitsRecord(line);
            if (splits.length > 0) {
              currentResult.splits = [...(currentResult.splits || []), ...splits];
            }
          }
          break;
        case 'Z0':
          break;
        default:
          break;
      }
    }

    return data;
  }

  /**
   * Generate a HY3 entry file from structured data.
   */
  generateEntryFile(data: ParsedMeetData): string {
    const lines: string[] = [];

    // A1 — File descriptor
    lines.push(this.padRight('A1V3   SWIMLY CLUB MANAGER', 80));

    // B1 — Meet info
    const meetDate = data.meetDate ? this.formatHY3Date(data.meetDate) : '        ';
    lines.push(this.padRight(`B1${this.padRight(data.meetName, 46)}${meetDate}`, 80));

    // C1 — Team info
    const teamName = data.teamName || '';
    const teamCode = data.teamCode || '';
    const country = toAlpha3Country(data.country);
    lines.push(
      this.padRight(`C1${this.padRight(teamName, 30)}${this.padRight(teamCode, 16)}${country}`, 80),
    );

    // Group entries by swimmer
    const swimmerEntries = new Map<string, ParsedEntry[]>();
    for (const entry of data.entries) {
      const key = entry.swimmer.seNumber;
      if (!swimmerEntries.has(key)) {
        swimmerEntries.set(key, []);
      }
      swimmerEntries.get(key)!.push(entry);
    }

    // D1 + E1 records per swimmer
    for (const [, entries] of swimmerEntries) {
      const swimmer = entries[0].swimmer;

      // D1 — Swimmer
      const dob = this.formatHY3Date(swimmer.dateOfBirth);
      const swimmerTeam = swimmer.teamName || teamName;
      lines.push(
        this.padRight(
          `D1${this.padRight(swimmer.seNumber, 7)}${this.padRight(swimmer.lastName, 20)}${this.padRight(swimmer.firstName, 20)}${swimmer.gender}${dob}${this.padRight(swimmerTeam, 30)}`,
          80,
        ),
      );

      // E1 — Entry per event
      for (const entry of entries) {
        const eventNum = this.padRight(entry.eventNumber || '01', 2);
        const dist = this.padLeft(String(entry.distance), 3);
        const strokeCode = STROKE_TO_CODE[entry.stroke] || '1';
        const ageGroup = entry.ageGroup || '0';
        const timeStr = this.formatHY3Time(entry.entryTime);
        const seedStr = entry.seedTime ? this.formatHY3Time(entry.seedTime) : '       ';
        const eventName = entry.eventName || `${entry.distance} ${entry.stroke.substring(0, 4)}`;

        lines.push(
          this.padRight(
            `E1${eventNum}${dist}${strokeCode}${ageGroup}${timeStr}${seedStr}${this.padRight(eventName, 24)}`,
            80,
          ),
        );
      }
    }

    // Z0 — EOF
    lines.push('Z0');

    return lines.join('\n');
  }

  /**
   * Generate a HY3 results file from structured data.
   */
  generateResultFile(data: ParsedMeetData): string {
    const lines: string[] = [];

    lines.push(this.padRight('A1V3   SWIMLY CLUB MANAGER', 80));

    const meetDate = data.meetDate ? this.formatHY3Date(data.meetDate) : '        ';
    lines.push(this.padRight(`B1${this.padRight(data.meetName, 46)}${meetDate}`, 80));

    const teamName = data.teamName || '';
    const teamCode = data.teamCode || '';
    const country = toAlpha3Country(data.country);
    lines.push(
      this.padRight(`C1${this.padRight(teamName, 30)}${this.padRight(teamCode, 16)}${country}`, 80),
    );

    // Group results by swimmer
    const swimmerResults = new Map<string, ParsedResult[]>();
    for (const result of data.results) {
      const key = result.swimmer.seNumber;
      if (!swimmerResults.has(key)) {
        swimmerResults.set(key, []);
      }
      swimmerResults.get(key)!.push(result);
    }

    for (const [, results] of swimmerResults) {
      const swimmer = results[0].swimmer;
      const dob = this.formatHY3Date(swimmer.dateOfBirth);
      const swimmerTeam = swimmer.teamName || teamName;

      lines.push(
        this.padRight(
          `D1${this.padRight(swimmer.seNumber, 7)}${this.padRight(swimmer.lastName, 20)}${this.padRight(swimmer.firstName, 20)}${swimmer.gender}${dob}${this.padRight(swimmerTeam, 30)}`,
          80,
        ),
      );

      for (const result of results) {
        const dist = this.padLeft(String(result.distance), 3);
        const strokeCode = STROKE_TO_CODE[result.stroke] || '1';
        const timeStr = this.formatHY3Time(result.time);
        const place = result.place ? this.padLeft(String(result.place), 3) : '   ';
        const dqFlag = result.dq ? 'Y' : 'N';
        const eventName = result.eventName || `${result.distance} ${result.stroke.substring(0, 4)}`;

        lines.push(
          this.padRight(
            `E1  ${dist}${strokeCode}0${timeStr}${place}${dqFlag}     ${this.padRight(eventName, 24)}`,
            80,
          ),
        );

        // G1 — Splits
        if (result.splits && result.splits.length > 0) {
          const splitStrs = result.splits.map((s) => this.formatHY3Time(s));
          lines.push(this.padRight(`G1${splitStrs.join('')}`, 80));
        }
      }
    }

    lines.push('Z0');
    return lines.join('\n');
  }

  /**
   * Validate parsed meet data.
   */
  validate(data: ParsedMeetData, options?: ParserValidationOptions): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate entries
    data.entries.forEach((entry, idx) => {
      this.validateSwimmer(entry.swimmer, idx + 1, errors, options);
      this.validateTime(entry.entryTime, idx + 1, 'entryTime', errors);
      this.validateEvent(entry.distance, entry.stroke, idx + 1, errors);
    });

    // Validate results
    data.results.forEach((result, idx) => {
      this.validateSwimmer(result.swimmer, idx + 1, errors, options);
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

  // --- Private parsing helpers ---

  private parseMeetInfo(line: string, data: ParsedMeetData): void {
    data.meetName = line.substring(2, 48).trim();
    const dateStr = line.substring(48, 56).trim();
    if (dateStr.length === 8) {
      data.meetDate = this.parseHY3Date(dateStr);
    }
  }

  private parseTeamInfo(line: string, data: ParsedMeetData): void {
    data.teamName = line.substring(2, 32).trim();
    data.teamCode = line.substring(32, 48).trim();
    // Alpha-3 country code, matching the write path. Older two-letter values
    // ('UK') still parse: the three-character slice trims to the raw token.
    data.country = line.substring(48, 51).trim() || undefined;
  }

  parseSwimmerRecord(line: string, lineNumber: number): ParsedSwimmer {
    const seNumber = line.substring(2, 9).trim();

    // Numbers are validated per governing body in validate(); at parse time
    // only an entirely missing number is fatal. Non-UK bodies issue
    // alphanumeric member numbers, so no numeric format is imposed here.
    if (!seNumber) {
      throw new Error(`Line ${lineNumber}: Missing registration number`);
    }

    const lastName = line.substring(9, 29).trim();
    const firstName = line.substring(29, 49).trim();
    const gender = line.substring(49, 50) as 'M' | 'F';
    const dateStr = line.substring(50, 58).trim();
    const teamName = line.substring(58, 88).trim();

    if (gender !== 'M' && gender !== 'F') {
      throw new Error(`Line ${lineNumber}: Invalid gender "${gender}" — must be M or F`);
    }

    return {
      seNumber,
      lastName,
      firstName,
      gender,
      dateOfBirth: this.parseHY3Date(dateStr),
      teamName: teamName || undefined,
    };
  }

  private parseEntryRecord(
    line: string,
    swimmer: ParsedSwimmer,
    lineNumber: number,
  ): ParsedEntry | null {
    try {
      const eventNumber = line.substring(2, 4).trim();
      const distance = parseInt(line.substring(4, 7).trim(), 10);
      const strokeCode = line.substring(7, 8);
      const ageGroup = line.substring(8, 9);
      const timeStr = line.substring(9, 17).trim();
      const seedStr = line.substring(17, 24).trim();
      const eventName = line.substring(24, 48).trim();

      const stroke = STROKE_CODE_MAP[strokeCode];
      if (!stroke) {
        throw new Error(`Line ${lineNumber}: Unknown stroke code "${strokeCode}"`);
      }

      return {
        swimmer,
        eventNumber,
        eventName: eventName || undefined,
        distance,
        stroke,
        entryTime: this.parseHY3Time(timeStr),
        seedTime: seedStr ? this.parseHY3Time(seedStr) : undefined,
        ageGroup: ageGroup !== '0' ? ageGroup : undefined,
      };
    } catch {
      return null;
    }
  }

  private parseResultRecord(
    line: string,
    swimmer: ParsedSwimmer,
    lineNumber: number,
  ): ParsedResult | null {
    try {
      const distance = parseInt(line.substring(4, 7).trim(), 10);
      const strokeCode = line.substring(7, 8);
      const timeStr = line.substring(9, 17).trim();
      const placeStr = line.substring(17, 20).trim();
      const dqFlag = line.substring(20, 21);
      const eventName = line.substring(25, 49).trim();

      const stroke = STROKE_CODE_MAP[strokeCode];
      if (!stroke) {
        throw new Error(`Line ${lineNumber}: Unknown stroke code "${strokeCode}"`);
      }

      return {
        swimmer,
        eventName: eventName || undefined,
        distance,
        stroke,
        time: this.parseHY3Time(timeStr),
        place: placeStr ? parseInt(placeStr, 10) : undefined,
        dq: dqFlag === 'Y',
        dqReason: undefined,
        splits: [],
      };
    } catch {
      return null;
    }
  }

  private parseSplitsRecord(line: string): number[] {
    const splits: number[] = [];
    const data = line.substring(2);

    // Splits are 8-char blocks: MMSSHH00
    for (let i = 0; i < data.length; i += 8) {
      const chunk = data.substring(i, i + 8).trim();
      if (chunk.length >= 6) {
        try {
          splits.push(this.parseHY3Time(chunk.substring(0, 8)));
        } catch {
          // Skip malformed splits
        }
      }
    }

    return splits;
  }

  // --- Date/time helpers ---

  /**
   * Parse HY3 date (MMDDYYYY) to Date.
   */
  parseHY3Date(dateStr: string): Date {
    if (dateStr.length !== 8) {
      throw new Error(`Invalid HY3 date format: "${dateStr}" (expected MMDDYYYY)`);
    }
    const month = parseInt(dateStr.substring(0, 2), 10);
    const day = parseInt(dateStr.substring(2, 4), 10);
    const year = parseInt(dateStr.substring(4, 8), 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date values: month=${month}, day=${day}`);
    }

    return new Date(year, month - 1, day);
  }

  /**
   * Format Date to HY3 date (MMDDYYYY).
   */
  private formatHY3Date(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${month}${day}${year}`;
  }

  /**
   * Parse HY3 time (MMSSHH or MMSSHH00) to seconds.
   * Format: MM=minutes, SS=seconds, HH=hundredths.
   */
  parseHY3Time(timeStr: string): number {
    const cleaned = timeStr.trim();
    if (!cleaned || cleaned === '0' || cleaned === 'NT') return 0;

    // Pad to at least 6 chars
    const padded = cleaned.padEnd(6, '0').substring(0, 6);

    const minutes = parseInt(padded.substring(0, 2), 10);
    const seconds = parseInt(padded.substring(2, 4), 10);
    const hundredths = parseInt(padded.substring(4, 6), 10);

    if (isNaN(minutes) || isNaN(seconds) || isNaN(hundredths)) {
      throw new Error(`Invalid HY3 time: "${timeStr}"`);
    }
    if (seconds >= 60) {
      throw new Error(`Invalid time: seconds must be < 60, got ${seconds}`);
    }
    if (hundredths >= 100) {
      throw new Error(`Invalid time: hundredths must be < 100, got ${hundredths}`);
    }

    return minutes * 60 + seconds + hundredths / 100;
  }

  /**
   * Format seconds to HY3 time (MMSSHH00).
   */
  private formatHY3Time(totalSeconds: number): string {
    if (totalSeconds <= 0) return '00000000';

    const minutes = Math.floor(totalSeconds / 60);
    const remaining = totalSeconds - minutes * 60;
    const seconds = Math.floor(remaining);
    const hundredths = Math.round((remaining - seconds) * 100);

    return (
      String(minutes).padStart(2, '0') +
      String(seconds).padStart(2, '0') +
      String(hundredths).padStart(2, '0') +
      '00'
    );
  }

  // --- String helpers ---

  private padRight(str: string, length: number): string {
    return str.substring(0, length).padEnd(length, ' ');
  }

  private padLeft(str: string, length: number): string {
    return str.substring(0, length).padStart(length, ' ');
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

    const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 5 || age > 99) {
      errors.push({
        row,
        field: 'dateOfBirth',
        value: dob.toISOString(),
        message: `Swimmer age (${Math.floor(age)}) outside expected range 5-99`,
        severity: 'warning',
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
      // 30 minutes
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
