/**
 * Common interfaces for competition file parsers.
 * Supports Hy-Tek HY3 and SportSystems formats.
 */

import {
  UK_GOVERNING_BODIES,
  defaultGoverningBodyForCountry,
  governingBodyConfig,
} from '@club-manager/shared-types';

export interface ParsedMember {
  /**
   * The member's governing-body registration number. Historically named for
   * the Swim England number; non-UK bodies (USA Swimming ID, Swimming
   * Australia member number) use the same field.
   */
  registrationNumber: string;
  lastName: string;
  firstName: string;
  gender: 'M' | 'F';
  dateOfBirth: Date;
  teamName?: string;
  teamCode?: string;
}

export interface ParsedEntry {
  member: ParsedMember;
  eventNumber?: string;
  eventName?: string;
  distance: number;
  stroke: string;
  entryTime: number; // Time in seconds (e.g. 65.23)
  seedTime?: number;
  ageGroup?: string;
  course?: 'SC' | 'LC';
}

export interface ParsedResult {
  member: ParsedMember;
  eventName?: string;
  distance: number;
  stroke: string;
  time: number; // Time in seconds
  place?: number;
  heat?: number;
  lane?: number;
  dq: boolean;
  dqReason?: string;
  splits?: number[]; // Split times in seconds
  isPB?: boolean;
}

export interface ParsedMeetData {
  meetName: string;
  meetDate?: Date;
  venue?: string;
  teamName?: string;
  teamCode?: string;
  country?: string;
  entries: ParsedEntry[];
  results: ParsedResult[];
}

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Controls how a parser validates member registration numbers. Defaults
 * reproduce the historical Swim England behaviour (strict 7-digit numbers),
 * so callers that pass nothing keep the previous GB validation.
 */
export interface ParserValidationOptions {
  /** What the club's governing body calls the number ("SE number", "Member number"). */
  registrationNumberLabel?: string;
  /** Enforce the UK 7-digit format as an error. Only UK bodies use this. */
  enforceSevenDigitFormat?: boolean;
}

/**
 * Derive parser validation options from a club's governing body. Bodies in
 * UK_GOVERNING_BODIES keep the strict 7-digit registration-number format;
 * every other body (including British Gymnastics, whose membership number
 * format is not published) only requires a non-empty number of at most 20
 * characters. A missing body follows the product's default governing body,
 * so strictness always matches the label shown in error copy.
 */
export function validationOptionsForGoverningBody(
  governingBody?: string | null,
): ParserValidationOptions {
  const body = governingBody || defaultGoverningBodyForCountry();
  const config = governingBodyConfig(body);
  return {
    registrationNumberLabel: config.registrationNumberLabel,
    enforceSevenDigitFormat: (UK_GOVERNING_BODIES as string[]).includes(body),
  };
}

/**
 * Validate a member's registration number against the active options. A
 * missing number, or one over 20 characters, is always an error. The
 * historical 7-digit format check applies only when enforceSevenDigitFormat
 * is on (the default, matching the previous Swim England behaviour), so for
 * a Swim England club the error copy is the previous
 * "SE number must be exactly 7 digits" byte-for-byte.
 */
export function validateRegistrationNumber(
  value: string,
  row: number,
  errors: ValidationError[],
  options?: ParserValidationOptions,
): void {
  const label = options?.registrationNumberLabel ?? 'SE number';
  const enforceSevenDigits = options?.enforceSevenDigitFormat ?? true;

  if (!value || value.trim().length === 0) {
    errors.push({
      row,
      field: 'registrationNumber',
      value,
      message: `${label} is required`,
      severity: 'error',
    });
    return;
  }
  if (value.length > 20) {
    errors.push({
      row,
      field: 'registrationNumber',
      value,
      message: `${label} must be 20 characters or fewer`,
      severity: 'error',
    });
    return;
  }
  if (enforceSevenDigits && !/^\d{7}$/.test(value)) {
    errors.push({
      row,
      field: 'registrationNumber',
      value,
      message: `${label} must be exactly 7 digits`,
      severity: 'error',
    });
  }
}

export interface FileParser {
  parseEntries(content: string): ParsedMeetData;
  parseResults(content: string): ParsedMeetData;
  generateEntryFile(data: ParsedMeetData): string;
  generateResultFile(data: ParsedMeetData): string;
  validate(data: ParsedMeetData, options?: ParserValidationOptions): ValidationResult;
}

export enum FileFormat {
  HY3 = 'hy3',
  SPORTSYSTEMS = 'sportsystems',
}

export enum StrokeCode {
  FREESTYLE = 'Freestyle',
  BACKSTROKE = 'Backstroke',
  BREASTSTROKE = 'Breaststroke',
  BUTTERFLY = 'Butterfly',
  INDIVIDUAL_MEDLEY = 'Individual Medley',
}

/** Valid competition distances in metres */
export const VALID_DISTANCES = [25, 50, 100, 200, 400, 800, 1500];

/** Valid strokes */
export const VALID_STROKES = [
  StrokeCode.FREESTYLE,
  StrokeCode.BACKSTROKE,
  StrokeCode.BREASTSTROKE,
  StrokeCode.BUTTERFLY,
  StrokeCode.INDIVIDUAL_MEDLEY,
];

/**
 * Parse a human-readable time string (e.g. "1:05.23") to seconds.
 */
export function parseTimeString(timeStr: string): number {
  const trimmed = timeStr.trim();
  if (!trimmed) return 0;

  // Format: M:SS.HH or MM:SS.HH or SS.HH
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    // Just seconds: SS.HH
    const value = parseFloat(trimmed);
    if (isNaN(value)) throw new Error(`Invalid time format: ${timeStr}`);
    return value;
  }

  const minutes = parseInt(trimmed.substring(0, colonIndex), 10);
  const rest = trimmed.substring(colonIndex + 1);
  const seconds = parseFloat(rest);

  if (isNaN(minutes) || isNaN(seconds)) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  if (seconds >= 60) {
    throw new Error(`Invalid time: seconds must be < 60, got ${seconds}`);
  }

  return minutes * 60 + seconds;
}

/**
 * Format seconds to human-readable time string (e.g. "1:05.23").
 */
export function formatTimeString(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0.00';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (minutes === 0) {
    return seconds.toFixed(2);
  }

  const secondsStr = seconds < 10 ? `0${seconds.toFixed(2)}` : seconds.toFixed(2);
  return `${minutes}:${secondsStr}`;
}
