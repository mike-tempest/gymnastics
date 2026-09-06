import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { governingBodyConfig } from '@club-manager/shared-types';
import { CompetitionsRepository } from './competitions.repository';
import { MembersRepository } from '../members/members.repository';
import { ClubsService } from '../clubs/clubs.service';
import { MEMBER_NOUN } from '../../common/brand';
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
  matchedMembers: number;
  unmatchedMembers: string[];
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
    private readonly membersRepository: MembersRepository,
    private readonly clubsService: ClubsService,
    private readonly personalBests: PersonalBestsService,
  ) {}

  /**
   * Preview a results file before committing the import.
   * Auto-detects file format, parses, validates, and matches members.
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

    // Match members by registration number
    const allMembers = await this.membersRepository.findAll();
    const memberMap = new Map(allMembers.map((s) => [s.registration_number, s]));

    const unmatchedMembers: string[] = [];
    let matchedCount = 0;

    for (const result of parsed.results) {
      if (memberMap.has(result.member.registrationNumber)) {
        matchedCount++;
      } else {
        const name = `${result.member.firstName} ${result.member.lastName} (${result.member.registrationNumber})`;
        if (!unmatchedMembers.includes(name)) {
          unmatchedMembers.push(name);
        }
      }
    }

    return {
      format,
      meetName: parsed.meetName,
      totalResults: parsed.results.length,
      matchedMembers: matchedCount,
      unmatchedMembers,
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

    // Match members
    const allMembers = await this.membersRepository.findAll();
    const memberMap = new Map(allMembers.map((s) => [s.registration_number, s]));

    const resultEntities: Partial<CompetitionResult>[] = [];
    const warnings: string[] = [];

    const registrationLabel = governingBodyConfig(club.governing_body).registrationNumberLabel;
    for (const result of parsed.results) {
      const member = memberMap.get(result.member.registrationNumber);
      if (!member) {
        warnings.push(
          `${MEMBER_NOUN} "${result.member.firstName} ${result.member.lastName}" (${registrationLabel}: ${result.member.registrationNumber}) not found in club, skipped`,
        );
        continue;
      }

      resultEntities.push({
        competition_id: competitionId,
        member_id: member.member_id,
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

    // Bulk save, then rebuild PBs and is_pb flags for every affected member.
    let newPBs = 0;
    if (resultEntities.length > 0) {
      const saved = await this.repository.createResults(resultEntities);
      const affectedMembers = new Set(saved.map((r) => r.member_id));
      for (const memberId of affectedMembers) {
        await this.personalBests.recomputeForMember(memberId);
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
