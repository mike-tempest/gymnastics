import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { governingBodyConfig } from '@club-manager/shared-types';
import { CompetitionsRepository } from './competitions.repository';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { ClubsService } from '../clubs/clubs.service';
import { ParserFactory } from '../../parsers/parser-factory';
import {
  FileFormat,
  ParsedResult,
  ValidationResult,
  validationOptionsForGoverningBody,
} from '../../parsers/parser.interface';
import { CompetitionResult } from './entities/competition-result.entity';
import { PersonalBestsService } from './personal-bests.service';

export interface ImportPreview {
  format: FileFormat;
  meetName: string;
  totalResults: number;
  matchedSwimmers: number;
  unmatchedSwimmers: string[];
  validation: ValidationResult;
  results: ParsedResult[];
}

export interface ImportOutcome {
  imported: number;
  newPBs: number;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class FileImportService {
  private readonly logger = new Logger(FileImportService.name);

  constructor(
    private readonly repository: CompetitionsRepository,
    private readonly swimmersRepository: SwimmersRepository,
    private readonly clubsService: ClubsService,
    private readonly personalBests: PersonalBestsService,
  ) {}

  /**
   * Preview a results file before committing the import.
   * Auto-detects file format, parses, validates, and matches swimmers.
   */
  async preview(
    competitionId: string,
    fileName: string,
    fileContent: string,
    formatHint?: FileFormat,
  ): Promise<ImportPreview> {
    // Auto-detect format
    const format = formatHint || ParserFactory.detectFormat(fileName, fileContent);
    const parser = ParserFactory.getParser(format);

    // Parse results
    const parsed = parser.parseResults(fileContent);

    // Validate with the club's governing-body rules: UK clubs keep the
    // strict 7-digit SE-number format, other bodies accept their own numbers.
    const club = await this.clubsService.findCurrent();
    const validation = parser.validate(
      parsed,
      validationOptionsForGoverningBody(club.governing_body),
    );

    // Match swimmers by registration number
    const allSwimmers = await this.swimmersRepository.findAll();
    const swimmerMap = new Map(allSwimmers.map((s) => [s.se_number, s]));

    const unmatchedSwimmers: string[] = [];
    let matchedCount = 0;

    for (const result of parsed.results) {
      if (swimmerMap.has(result.swimmer.seNumber)) {
        matchedCount++;
      } else {
        const name = `${result.swimmer.firstName} ${result.swimmer.lastName} (${result.swimmer.seNumber})`;
        if (!unmatchedSwimmers.includes(name)) {
          unmatchedSwimmers.push(name);
        }
      }
    }

    return {
      format,
      meetName: parsed.meetName,
      totalResults: parsed.results.length,
      matchedSwimmers: matchedCount,
      unmatchedSwimmers,
      validation,
      results: parsed.results,
    };
  }

  /**
   * Import results from a parsed file into the database.
   * Automatically checks for PB updates.
   */
  async importResults(
    competitionId: string,
    fileName: string,
    fileContent: string,
    formatHint?: FileFormat,
  ): Promise<ImportOutcome> {
    const format = formatHint || ParserFactory.detectFormat(fileName, fileContent);
    const parser = ParserFactory.getParser(format);
    const parsed = parser.parseResults(fileContent);

    // Validate with the club's governing-body rules — reject if critical errors
    const club = await this.clubsService.findCurrent();
    const validation = parser.validate(
      parsed,
      validationOptionsForGoverningBody(club.governing_body),
    );
    const criticalErrors = validation.errors.filter((e) => e.severity === 'error');
    if (criticalErrors.length > 0) {
      throw new BadRequestException({
        message: 'File contains validation errors that must be resolved before import',
        errors: criticalErrors,
      });
    }

    // The parent meet's course is stamped onto every imported time so PBs
    // stay separated between short-course and long-course pools.
    const competition = await this.repository.findCompetitionById(competitionId);
    if (!competition) {
      throw new BadRequestException(`Competition with ID ${competitionId} not found`);
    }

    // Match swimmers
    const allSwimmers = await this.swimmersRepository.findAll();
    const swimmerMap = new Map(allSwimmers.map((s) => [s.se_number, s]));

    const resultEntities: Partial<CompetitionResult>[] = [];
    const warnings: string[] = [];

    const registrationLabel = governingBodyConfig(club.governing_body).registrationNumberLabel;
    for (const result of parsed.results) {
      const swimmer = swimmerMap.get(result.swimmer.seNumber);
      if (!swimmer) {
        warnings.push(
          `Swimmer "${result.swimmer.firstName} ${result.swimmer.lastName}" (${registrationLabel}: ${result.swimmer.seNumber}) not found in club — skipped`,
        );
        continue;
      }

      resultEntities.push({
        competition_id: competitionId,
        swimmer_id: swimmer.swimmer_id,
        event_name: result.eventName,
        distance: result.distance,
        stroke: result.stroke,
        time: result.dq ? 0 : result.time,
        place: result.dq ? null : result.place,
        heat: result.heat,
        lane: result.lane,
        dq: result.dq,
        dq_reason: result.dq ? result.dqReason : null,
        is_pb: false,
        splits: result.splits || null,
        course: competition.course,
      });
    }

    // Bulk save, then rebuild PBs and is_pb flags for every affected swimmer.
    let newPBs = 0;
    if (resultEntities.length > 0) {
      const saved = await this.repository.createResults(resultEntities);
      const affectedSwimmers = new Set(saved.map((r) => r.swimmer_id));
      for (const swimmerId of affectedSwimmers) {
        await this.personalBests.recomputeForSwimmer(swimmerId);
      }
      const refreshed = await this.repository.findResultsByIds(saved.map((r) => r.result_id));
      newPBs = refreshed.filter((r) => r.is_pb).length;
    }

    this.logger.log(
      `Imported ${resultEntities.length} results for competition ${competitionId} (${newPBs} new PBs)`,
    );

    return {
      imported: resultEntities.length,
      newPBs,
      errors: [],
      warnings,
    };
  }
}
