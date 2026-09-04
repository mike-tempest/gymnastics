import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { CompetitionResult } from './entities/competition-result.entity';
import { CourseType } from './entities/competition.entity';
import { parseTimeString, VALID_DISTANCES, StrokeCode } from '../../parsers/parser.interface';
import { Swimmer } from '../swimmers/entities/swimmer.entity';

export interface TimesRowError {
  row: number;
  message: string;
}

export interface ParsedTimeRow {
  row: number;
  swimmer_id: string;
  swimmerName: string;
  distance: number;
  stroke: string;
  time: number;
  course: CourseType;
  swum_at: string | null;
}

export interface TimesImportPreview {
  totalRows: number;
  validRows: ParsedTimeRow[];
  errors: TimesRowError[];
}

export interface TimesImportOutcome {
  imported: number;
  newPBs: number;
  errors: TimesRowError[];
  warnings: string[];
}

const STROKE_ALIASES: Record<string, string> = {
  freestyle: StrokeCode.FREESTYLE,
  free: StrokeCode.FREESTYLE,
  fr: StrokeCode.FREESTYLE,
  backstroke: StrokeCode.BACKSTROKE,
  back: StrokeCode.BACKSTROKE,
  bk: StrokeCode.BACKSTROKE,
  breaststroke: StrokeCode.BREASTSTROKE,
  breast: StrokeCode.BREASTSTROKE,
  br: StrokeCode.BREASTSTROKE,
  butterfly: StrokeCode.BUTTERFLY,
  fly: StrokeCode.BUTTERFLY,
  bf: StrokeCode.BUTTERFLY,
  'individual medley': StrokeCode.INDIVIDUAL_MEDLEY,
  im: StrokeCode.INDIVIDUAL_MEDLEY,
  medley: StrokeCode.INDIVIDUAL_MEDLEY,
};

const HEADER_ALIASES: Record<string, string> = {
  registration_number: 'registration_number',
  registration: 'registration_number',
  se_number: 'registration_number',
  member_number: 'registration_number',
  first_name: 'first_name',
  firstname: 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  distance: 'distance',
  stroke: 'stroke',
  event: 'stroke_and_distance',
  time: 'time',
  course: 'course',
  date: 'date',
  swum_at: 'date',
};

/**
 * Imports a plain CSV of times — one row per swimmer per event — into a
 * competition, typically a "Baseline times" time trial created during
 * onboarding. Swimmers are matched by registration number when present,
 * otherwise by first and last name. Rows may carry their own course and the
 * date the time was swum; both fall back to the competition's values.
 */
@Injectable()
export class TimesImportService {
  private readonly logger = new Logger(TimesImportService.name);

  constructor(
    private readonly repository: CompetitionsRepository,
    private readonly swimmersRepository: SwimmersRepository,
    private readonly personalBests: PersonalBestsService,
  ) {}

  async preview(competitionId: string, csvContent: string): Promise<TimesImportPreview> {
    const { rows, errors } = await this.parseAndMatch(competitionId, csvContent);
    return {
      totalRows: rows.length + errors.length,
      validRows: rows,
      errors,
    };
  }

  async import(competitionId: string, csvContent: string): Promise<TimesImportOutcome> {
    const { rows, errors } = await this.parseAndMatch(competitionId, csvContent);

    if (rows.length === 0) {
      return { imported: 0, newPBs: 0, errors, warnings: [] };
    }

    const entities: Partial<CompetitionResult>[] = rows.map((row) => ({
      competition_id: competitionId,
      swimmer_id: row.swimmer_id,
      event_name: null,
      distance: row.distance,
      stroke: row.stroke,
      time: row.time,
      place: null,
      heat: null,
      lane: null,
      dq: false,
      is_pb: false,
      splits: null,
      course: row.course,
      swum_at: row.swum_at ? new Date(row.swum_at) : null,
    }));

    const saved = await this.repository.createResults(entities);
    const affectedSwimmers = new Set(saved.map((r) => r.swimmer_id));
    for (const swimmerId of affectedSwimmers) {
      await this.personalBests.recomputeForSwimmer(swimmerId);
    }
    const refreshed = await this.repository.findResultsByIds(saved.map((r) => r.result_id));
    const newPBs = refreshed.filter((r) => r.is_pb).length;

    this.logger.log(
      `Imported ${saved.length} times into competition ${competitionId} (${newPBs} PBs, ${errors.length} rows skipped)`,
    );

    return { imported: saved.length, newPBs, errors, warnings: [] };
  }

  private async parseAndMatch(
    competitionId: string,
    csvContent: string,
  ): Promise<{ rows: ParsedTimeRow[]; errors: TimesRowError[] }> {
    const competition = await this.repository.findCompetitionById(competitionId);
    if (!competition) {
      throw new BadRequestException(`Competition with ID ${competitionId} not found`);
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length < 2) {
      throw new BadRequestException(
        'The file needs a header row and at least one row of times. Download the template for the expected layout.',
      );
    }

    const headers = this.parseCsvLine(lines[0]).map(
      (h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, '_')] ?? null,
    );
    if (!headers.includes('time') || (!headers.includes('distance') && !headers.includes('stroke_and_distance'))) {
      throw new BadRequestException(
        'Unrecognised header row. Expected columns like registration_number, first_name, last_name, distance, stroke, time, course, date.',
      );
    }

    const swimmers = await this.swimmersRepository.findAll();
    const byRegistration = new Map(
      swimmers.filter((s) => s.se_number).map((s) => [s.se_number!.trim().toLowerCase(), s]),
    );
    const byName = new Map<string, Swimmer[]>();
    for (const swimmer of swimmers) {
      const key = `${swimmer.first_name} ${swimmer.last_name}`.trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), swimmer]);
    }

    const rows: ParsedTimeRow[] = [];
    const errors: TimesRowError[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const cells = this.parseCsvLine(lines[i]);
      const value = (name: string): string => {
        const index = headers.indexOf(name);
        return index >= 0 ? (cells[index] ?? '').trim() : '';
      };

      // --- Swimmer ---
      const registration = value('registration_number');
      const firstName = value('first_name');
      const lastName = value('last_name');
      let swimmer = registration ? byRegistration.get(registration.toLowerCase()) : undefined;
      if (!swimmer && firstName && lastName) {
        const candidates = byName.get(`${firstName} ${lastName}`.toLowerCase()) ?? [];
        if (candidates.length > 1) {
          errors.push({
            row: rowNumber,
            message: `More than one swimmer is named ${firstName} ${lastName}; add their registration number to the row`,
          });
          continue;
        }
        swimmer = candidates[0];
      }
      if (!swimmer) {
        const identity =
          registration || `${firstName} ${lastName}`.trim() || '(no swimmer given)';
        errors.push({ row: rowNumber, message: `Swimmer not found in club: ${identity}` });
        continue;
      }

      // --- Event ---
      let distanceText = value('distance');
      let strokeText = value('stroke');
      const eventText = value('stroke_and_distance');
      if ((!distanceText || !strokeText) && eventText) {
        // Accept "100 Freestyle" / "100m Free" in a single "event" column.
        const match = eventText.match(/^(\d+)\s*m?\s+(.+)$/i);
        if (match) {
          distanceText = distanceText || match[1];
          strokeText = strokeText || match[2];
        }
      }
      const distance = parseInt(distanceText, 10);
      if (!distance || !VALID_DISTANCES.includes(distance)) {
        errors.push({
          row: rowNumber,
          message: `Distance "${distanceText}" is not one of ${VALID_DISTANCES.join(', ')}`,
        });
        continue;
      }
      const stroke = STROKE_ALIASES[strokeText.toLowerCase().trim()];
      if (!stroke) {
        errors.push({ row: rowNumber, message: `Unrecognised stroke "${strokeText}"` });
        continue;
      }

      // --- Time ---
      let time: number;
      try {
        time = parseTimeString(value('time'));
      } catch {
        errors.push({
          row: rowNumber,
          message: `Time "${value('time')}" could not be read; use 34.20 or 1:05.23`,
        });
        continue;
      }
      if (!time || time <= 0) {
        errors.push({ row: rowNumber, message: 'Time is required' });
        continue;
      }

      // --- Course and date ---
      const courseText = value('course').toUpperCase();
      if (courseText && courseText !== CourseType.SC && courseText !== CourseType.LC) {
        errors.push({ row: rowNumber, message: `Course must be SC or LC, got "${courseText}"` });
        continue;
      }
      const course = (courseText as CourseType) || competition.course;

      const dateText = value('date');
      let swumAt: string | null = null;
      if (dateText) {
        const parsed = new Date(dateText);
        if (Number.isNaN(parsed.getTime())) {
          errors.push({
            row: rowNumber,
            message: `Date "${dateText}" could not be read; use YYYY-MM-DD`,
          });
          continue;
        }
        swumAt = parsed.toISOString().slice(0, 10);
      }

      rows.push({
        row: rowNumber,
        swimmer_id: swimmer.swimmer_id,
        swimmerName: `${swimmer.first_name} ${swimmer.last_name}`,
        distance,
        stroke,
        time,
        course,
        swum_at: swumAt,
      });
    }

    return { rows, errors };
  }

  /** Minimal CSV line parser: handles quoted fields and escaped quotes. */
  private parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }
}
