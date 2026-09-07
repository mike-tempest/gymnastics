import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  AssessmentOutcomeResult,
  AwardProgressStatus,
  AwardSchemeSource,
} from '@club-manager/shared-types';
import { AwardsRepository } from './awards.repository';
import { AwardScheme } from './entities/award-scheme.entity';
import { AwardLevel } from './entities/award-level.entity';
import { MemberAwardProgress } from './entities/member-award-progress.entity';
import { AssessmentEvent } from './entities/assessment-event.entity';
import { CreateAwardSchemeDto, UpdateAwardSchemeDto } from './dto/award-scheme.dto';
import { CreateAwardLevelDto, UpdateAwardLevelDto } from './dto/award-level.dto';
import { RecordAssessmentDto, SetProgressDto } from './dto/record-assessment.dto';
import { RiseCsvImportDto } from './dto/rise-csv.dto';
import { DEFAULT_AWARD_SCHEMES } from './awards.defaults';
import { parseRiseCsv, toDateKey, toRiseCsv, RiseCsvRow } from './awards.csv';
import { InvoicesService } from '../finance/invoices/invoices.service';
import { MembersRepository } from '../members/members.repository';
import { Member } from '../members/entities/member.entity';
import { MEMBER_NOUN_LOWER } from '../../common/brand';

/** Days between raising a badge invoice and its due date. */
const BADGE_INVOICE_TERMS_DAYS = 14;

export interface SchemeWithLevels extends AwardScheme {
  levels: AwardLevel[];
}

export interface AssessmentResult {
  event: AssessmentEvent;
  awarded: number;
  /** Invoices raised for badge and certificate fees. */
  invoices_raised: number;
  /**
   * Per-member notes about anything that did not happen, above all a badge
   * awarded to a member with no family to bill. The award always stands; only
   * the billing is skipped.
   */
  warnings: string[];
}

export interface RiseImportPreviewRow extends RiseCsvRow {
  /**
   * The row's line in the uploaded file, header and any blank lines counted,
   * so a warning points at the line the club sees in its own spreadsheet
   * rather than at a position among the rows that happened to carry data.
   */
  row_number: number;
  member_id: string | null;
  matched_on: 'registration_number' | 'name_and_dob' | null;
  level_id: string | null;
  errors: string[];
}

export interface RiseImportPreview {
  rows: RiseImportPreviewRow[];
  matched: number;
  unmatched: number;
  unknown_headers: string[];
  missing_headers: string[];
}

export interface RiseImportResult {
  imported: number;
  skipped: number;
  invoices_raised: number;
  warnings: string[];
}

export interface InstallDefaultsResult {
  installed: string[];
  skipped: string[];
}

@Injectable()
export class AwardsService {
  private readonly logger = new Logger(AwardsService.name);

  constructor(
    private readonly awardsRepository: AwardsRepository,
    private readonly invoicesService: InvoicesService,
    private readonly membersRepository: MembersRepository,
  ) {}

  // --- Schemes and levels ---

  async listSchemes(includeInactive = false): Promise<SchemeWithLevels[]> {
    const schemes = await this.awardsRepository.findAllSchemes(includeInactive);
    const levels = await this.awardsRepository.findAllLevels();

    return schemes.map((scheme) => ({
      ...scheme,
      levels: levels
        .filter((level) => level.scheme_id === scheme.scheme_id)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    }));
  }

  async getScheme(schemeId: string): Promise<SchemeWithLevels> {
    const scheme = await this.awardsRepository.findOneScheme(schemeId);
    if (!scheme) {
      throw new NotFoundException('Award scheme not found');
    }
    const levels = await this.awardsRepository.findLevelsByScheme(schemeId);
    return { ...scheme, levels };
  }

  async createScheme(dto: CreateAwardSchemeDto): Promise<AwardScheme> {
    const existing = await this.awardsRepository.findSchemeByName(dto.name);
    if (existing) {
      throw new BadRequestException(`An award scheme named "${dto.name}" already exists`);
    }
    return this.awardsRepository.createScheme(dto);
  }

  async updateScheme(schemeId: string, dto: UpdateAwardSchemeDto): Promise<AwardScheme> {
    const existing = await this.awardsRepository.findOneScheme(schemeId);
    if (!existing) {
      throw new NotFoundException('Award scheme not found');
    }
    const updated = await this.awardsRepository.updateScheme(schemeId, dto);
    return updated!;
  }

  async removeScheme(schemeId: string): Promise<void> {
    const existing = await this.awardsRepository.findOneScheme(schemeId);
    if (!existing) {
      throw new NotFoundException('Award scheme not found');
    }
    await this.awardsRepository.removeScheme(schemeId);
  }

  async createLevel(dto: CreateAwardLevelDto): Promise<AwardLevel> {
    // Scoped lookup, so a scheme id belonging to another club is not-found and
    // a level cannot be attached across the tenant boundary.
    const scheme = await this.awardsRepository.findOneScheme(dto.scheme_id);
    if (!scheme) {
      throw new NotFoundException('Award scheme not found');
    }
    return this.awardsRepository.createLevel(dto);
  }

  async updateLevel(levelId: string, dto: UpdateAwardLevelDto): Promise<AwardLevel> {
    const existing = await this.awardsRepository.findOneLevel(levelId);
    if (!existing) {
      throw new NotFoundException('Award level not found');
    }
    const updated = await this.awardsRepository.updateLevel(levelId, dto);
    return updated!;
  }

  async removeLevel(levelId: string): Promise<void> {
    const existing = await this.awardsRepository.findOneLevel(levelId);
    if (!existing) {
      throw new NotFoundException('Award level not found');
    }
    await this.awardsRepository.removeLevel(levelId);
  }

  /**
   * Writes the starter schemes into this club's own tables. They are ordinary
   * rows from that point on: the club renames, reprices and reorders them, or
   * deletes them and builds its own.
   *
   * Installing twice is safe. A scheme whose name is already taken is reported
   * as skipped rather than duplicated or overwritten, so a club that has
   * already edited its Rise levels does not lose that work.
   */
  async installDefaultSchemes(): Promise<InstallDefaultsResult> {
    const installed: string[] = [];
    const skipped: string[] = [];

    for (const definition of DEFAULT_AWARD_SCHEMES) {
      const existing = await this.awardsRepository.findSchemeByName(definition.name);
      if (existing) {
        skipped.push(definition.name);
        continue;
      }

      const scheme = await this.awardsRepository.createScheme({
        name: definition.name,
        description: definition.description,
        source: definition.source,
        active: true,
      });

      for (const level of definition.levels) {
        await this.awardsRepository.createLevel({
          scheme_id: scheme.scheme_id,
          name: level.name,
          description: level.description,
          sort_order: level.sort_order,
        });
      }

      installed.push(definition.name);
    }

    return { installed, skipped };
  }

  // --- Member progress ---

  /**
   * Every badge this member is working towards, has been assessed for or has
   * been awarded, newest first.
   *
   * This is the single query the parent portal will read from when it lands
   * (`parent/children/:id/badges` belongs to another ticket): it is already
   * tenant-scoped and returns the level and scheme alongside each row, so that
   * consumer needs no further joins.
   */
  async getMemberProgress(memberId: string): Promise<MemberAwardProgress[]> {
    return this.awardsRepository.findProgressByMember(memberId);
  }

  /** Progress rows for a group of members, for the coach assessment screen. */
  async getProgressForMembers(memberIds: string[]): Promise<MemberAwardProgress[]> {
    return this.awardsRepository.findProgressByMembers(memberIds);
  }

  async setProgress(dto: SetProgressDto): Promise<MemberAwardProgress> {
    const level = await this.awardsRepository.findOneLevel(dto.level_id);
    if (!level) {
      throw new NotFoundException('Award level not found');
    }
    const member = await this.membersRepository.findOne(dto.member_id);
    if (!member) {
      throw new NotFoundException(`${MEMBER_NOUN_LOWER} not found`);
    }

    return this.awardsRepository.upsertProgress(dto.member_id, dto.level_id, {
      status: dto.status,
      started_on: (dto.started_on ?? null) as unknown as Date | null,
      notes: dto.notes ?? null,
    });
  }

  // --- Assessment and billing ---

  /**
   * Records one assessment sitting: an event, a per-member outcome for each
   * gymnast assessed, and the resulting progress rows. Members judged to have
   * earned a priced badge are billed through the normal finance path.
   */
  async recordAssessment(
    dto: RecordAssessmentDto,
    assessedByUserId?: string,
  ): Promise<AssessmentResult> {
    const level = await this.awardsRepository.findOneLevel(dto.level_id);
    if (!level) {
      throw new NotFoundException('Award level not found');
    }

    const memberIds = dto.outcomes.map((outcome) => outcome.member_id);
    const uniqueIds = new Set(memberIds);
    if (uniqueIds.size !== memberIds.length) {
      throw new BadRequestException(
        `Each ${MEMBER_NOUN_LOWER} may only appear once per assessment`,
      );
    }

    // Resolve every member up front through the tenant-scoped repository, so an
    // id from another club is rejected before anything is written.
    const members = new Map<string, Member>();
    for (const id of uniqueIds) {
      const member = await this.membersRepository.findOne(id);
      if (!member) {
        throw new NotFoundException(`${MEMBER_NOUN_LOWER} ${id} not found`);
      }
      members.set(id, member);
    }

    const event = await this.awardsRepository.createEvent({
      level_id: dto.level_id,
      assessed_at: dto.assessed_at as unknown as Date,
      assessed_by_user_id: assessedByUserId ?? null,
      notes: dto.notes ?? null,
    });

    const warnings: string[] = [];
    let awarded = 0;
    let invoicesRaised = 0;
    const billFees = dto.bill_fees !== false;

    for (const outcomeDto of dto.outcomes) {
      const member = members.get(outcomeDto.member_id)!;
      const outcome = await this.awardsRepository.createOutcome({
        event_id: event.event_id,
        member_id: outcomeDto.member_id,
        outcome: outcomeDto.outcome,
        notes: outcomeDto.notes ?? null,
      });

      const isAwarded = outcomeDto.outcome === AssessmentOutcomeResult.AWARDED;
      // Any invoice already raised for this gymnast on this badge. A coach
      // re-recording a sitting, or a double submit, must not charge a family
      // twice for one badge, and must not lose the link to the first invoice.
      const existing = await this.awardsRepository.findOneProgress(
        outcomeDto.member_id,
        dto.level_id,
      );
      let invoiceId: string | null = existing?.invoice_id ?? null;

      if (isAwarded) {
        awarded++;
        if (billFees && !invoiceId) {
          const billing = await this.billBadgeFee(member, level, dto.assessed_at);
          invoiceId = billing.invoiceId;
          if (billing.warning) warnings.push(billing.warning);
          if (invoiceId) invoicesRaised++;
        }
      }

      if (invoiceId) {
        await this.awardsRepository.updateOutcomeInvoice(outcome.outcome_id, invoiceId);
      }

      await this.awardsRepository.upsertProgress(outcomeDto.member_id, dto.level_id, {
        status: this.statusForOutcome(outcomeDto.outcome),
        assessed_on: dto.assessed_at as unknown as Date,
        awarded_on: isAwarded ? (dto.assessed_at as unknown as Date) : null,
        notes: outcomeDto.notes ?? null,
        // Only ever set the link, never clear it: the invoice still exists
        // whatever a later assessment concludes.
        ...(invoiceId ? { invoice_id: invoiceId } : {}),
      });
    }

    return { event, awarded, invoices_raised: invoicesRaised, warnings };
  }

  private statusForOutcome(outcome: AssessmentOutcomeResult): AwardProgressStatus {
    switch (outcome) {
      case AssessmentOutcomeResult.AWARDED:
        return AwardProgressStatus.AWARDED;
      case AssessmentOutcomeResult.NOT_YET:
        return AwardProgressStatus.ASSESSED;
      default:
        return AwardProgressStatus.WORKING_TOWARDS;
    }
  }

  /**
   * Raises the badge (and certificate) invoice for one awarded gymnast.
   *
   * Billing goes through InvoicesService.create rather than the repository on
   * purpose: create resolves the club's currency and tax, emails the family
   * and auto-attempts Direct Debit collection, which is the whole point of
   * billing badges through the normal finance path.
   *
   * A gymnast with no family cannot be billed. That is a warning, never an
   * error: the badge has been earned and the award stands regardless.
   */
  private async billBadgeFee(
    member: Member,
    level: AwardLevel,
    awardDate: string,
  ): Promise<{ invoiceId: string | null; warning: string | null }> {
    const badgeFee = this.toAmount(level.badge_fee);
    const certificateFee = this.toAmount(level.certificate_fee);
    if (badgeFee === null && certificateFee === null) {
      return { invoiceId: null, warning: null };
    }

    const memberName = `${member.first_name} ${member.last_name}`.trim();
    if (!member.family_id) {
      return {
        invoiceId: null,
        warning: `${memberName} was awarded ${level.name} but has no family on record, so no badge fee was billed`,
      };
    }

    const schemeName = level.scheme?.name ?? 'Award';
    const items = [];
    if (badgeFee !== null) {
      items.push({
        description: `${schemeName} ${level.name} badge`,
        unit_price: badgeFee,
        quantity: 1,
        ...(level.fee_structure_id ? { fee_structure_id: level.fee_structure_id } : {}),
      });
    }
    if (certificateFee !== null) {
      items.push({
        description: `${schemeName} ${level.name} certificate`,
        unit_price: certificateFee,
        quantity: 1,
        ...(level.fee_structure_id ? { fee_structure_id: level.fee_structure_id } : {}),
      });
    }

    try {
      const invoice = await this.invoicesService.create({
        family_id: member.family_id,
        issued_date: awardDate,
        due_date: this.addDays(awardDate, BADGE_INVOICE_TERMS_DAYS),
        notes: `${schemeName} ${level.name} for ${memberName}`,
        items,
      });
      return { invoiceId: invoice.invoice_id, warning: null };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to raise a badge invoice for ${memberName} on level ${level.level_id}: ${err.message}`,
        err.stack,
      );
      return {
        invoiceId: null,
        warning: `${memberName} was awarded ${level.name} but the badge fee could not be billed: ${err.message}`,
      };
    }
  }

  /** Decimal columns come back from the driver as strings; coerce and drop zero/null. */
  private toAmount(value: number | string | null): number | null {
    if (value === null || value === undefined) return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
  }

  private addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate.split('T')[0]}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  // --- Assessment history ---

  async listEvents(levelId?: string, limit = 50): Promise<AssessmentEvent[]> {
    return this.awardsRepository.findEvents(levelId, limit);
  }

  async getEvent(eventId: string): Promise<AssessmentEvent> {
    const event = await this.awardsRepository.findOneEvent(eventId);
    if (!event) {
      throw new NotFoundException('Assessment not found');
    }
    return event;
  }

  // --- Rise CSV bridge ---

  /**
   * Every awarded (and optionally assessed) badge as a Rise-compatible CSV.
   * The club keys this into Rise Hub by hand, because Rise Hub has no API.
   */
  async exportRiseCsv(
    options: { schemeId?: string; includeAssessed?: boolean } = {},
  ): Promise<string> {
    const schemes = await this.listSchemes(true);
    const schemesById = new Map(schemes.map((scheme) => [scheme.scheme_id, scheme]));
    const levels = await this.awardsRepository.findAllLevels();
    const levelsById = new Map(levels.map((level) => [level.level_id, level]));

    const wanted: AwardProgressStatus[] = options.includeAssessed
      ? [AwardProgressStatus.AWARDED, AwardProgressStatus.ASSESSED]
      : [AwardProgressStatus.AWARDED];

    const members = await this.membersRepository.findAll();
    const progressRows = await this.awardsRepository.findProgressByMembers(
      members.map((member) => member.member_id),
    );
    const membersById = new Map(members.map((member) => [member.member_id, member]));

    const rows: RiseCsvRow[] = [];
    for (const progress of progressRows) {
      if (!wanted.includes(progress.status)) continue;

      const level = levelsById.get(progress.level_id);
      if (!level) continue;
      if (options.schemeId && level.scheme_id !== options.schemeId) continue;

      const member = membersById.get(progress.member_id);
      if (!member) continue;

      rows.push({
        first_name: member.first_name,
        last_name: member.last_name,
        dob: toDateKey(member.dob) ?? '',
        bg_membership_number: member.registration_number ?? '',
        scheme: schemesById.get(level.scheme_id)?.name ?? '',
        level: level.name,
        award_date: toDateKey(progress.awarded_on ?? progress.assessed_on) ?? '',
      });
    }

    rows.sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name) ||
        a.level.localeCompare(b.level),
    );

    return toRiseCsv(rows);
  }

  /**
   * Dry run of a Rise CSV import: resolves every row to a member and a level
   * and reports what could not be matched, without writing anything.
   */
  async previewRiseImport(dto: RiseCsvImportDto): Promise<RiseImportPreview> {
    const parsed = parseRiseCsv(dto.csv);
    const members = await this.membersRepository.findAll();
    const schemes = await this.listSchemes(true);
    const rows: RiseImportPreviewRow[] = [];

    for (const { lineNumber, ...row } of parsed.rows) {
      const errors: string[] = [];
      const match = this.matchMember(row, members);
      if (!match.member) {
        errors.push(
          `No ${MEMBER_NOUN_LOWER} matched this row by BG membership number or by name and date of birth`,
        );
      }

      const level = this.matchLevel(row, schemes, dto.scheme_id);
      if (!level) {
        errors.push(`No award level matched "${row.scheme}" / "${row.level}"`);
      }

      if (row.award_date && !toDateKey(row.award_date)) {
        errors.push(`Award date "${row.award_date}" is not a date this importer understands`);
      }

      rows.push({
        ...row,
        row_number: lineNumber,
        member_id: match.member?.member_id ?? null,
        matched_on: match.matchedOn,
        level_id: level?.level_id ?? null,
        errors,
      });
    }

    const matched = rows.filter((row) => row.errors.length === 0).length;

    return {
      rows,
      matched,
      unmatched: rows.length - matched,
      unknown_headers: parsed.unknownHeaders,
      missing_headers: parsed.missingHeaders,
    };
  }

  /**
   * Applies a Rise CSV. Rows that resolve cleanly become awarded progress
   * rows; anything ambiguous is skipped and reported rather than guessed at.
   */
  async importRiseCsv(dto: RiseCsvImportDto): Promise<RiseImportResult> {
    const preview = await this.previewRiseImport(dto);
    const warnings: string[] = [];
    let imported = 0;
    let skipped = 0;
    let invoicesRaised = 0;

    for (const row of preview.rows) {
      if (row.errors.length > 0 || !row.member_id || !row.level_id) {
        skipped++;
        warnings.push(`Row ${row.row_number}: ${row.errors.join('; ') || 'could not be resolved'}`);
        continue;
      }

      const awardDate = toDateKey(row.award_date) ?? new Date().toISOString().split('T')[0];
      let invoiceId: string | null = null;

      if (dto.bill_fees) {
        const member = await this.membersRepository.findOne(row.member_id);
        const level = await this.awardsRepository.findOneLevel(row.level_id);
        if (member && level) {
          const existing = await this.awardsRepository.findOneProgress(row.member_id, row.level_id);
          // Never bill twice for a badge this club has already awarded.
          if (existing?.invoice_id) {
            invoiceId = existing.invoice_id;
          } else {
            const billing = await this.billBadgeFee(member, level, awardDate);
            invoiceId = billing.invoiceId;
            if (billing.warning) warnings.push(`Row ${row.row_number}: ${billing.warning}`);
            if (invoiceId) invoicesRaised++;
          }
        }
      }

      await this.awardsRepository.upsertProgress(row.member_id, row.level_id, {
        status: AwardProgressStatus.AWARDED,
        assessed_on: awardDate as unknown as Date,
        awarded_on: awardDate as unknown as Date,
        ...(invoiceId ? { invoice_id: invoiceId } : {}),
      });
      imported++;
    }

    return { imported, skipped, invoices_raised: invoicesRaised, warnings };
  }

  /**
   * Matches an import row to a member the way the data-import module does:
   * on the BG membership number first, then on first name, last name and date
   * of birth. An ambiguous registration number is treated as no match rather
   * than guessing which gymnast the row means.
   */
  private matchMember(
    row: RiseCsvRow,
    members: Member[],
  ): { member: Member | null; matchedOn: 'registration_number' | 'name_and_dob' | null } {
    const registrationNumber = row.bg_membership_number.trim();
    if (registrationNumber) {
      const candidates = members.filter(
        (member) => (member.registration_number ?? '').trim() === registrationNumber,
      );
      if (candidates.length === 1) {
        return { member: candidates[0], matchedOn: 'registration_number' };
      }
      if (candidates.length > 1) {
        return { member: null, matchedOn: null };
      }
    }

    const firstName = row.first_name.trim().toLowerCase();
    const lastName = row.last_name.trim().toLowerCase();
    const dob = toDateKey(row.dob);
    if (!firstName || !lastName || !dob) {
      return { member: null, matchedOn: null };
    }

    const matched = members.filter(
      (member) =>
        member.first_name.trim().toLowerCase() === firstName &&
        member.last_name.trim().toLowerCase() === lastName &&
        toDateKey(member.dob) === dob,
    );

    return matched.length === 1
      ? { member: matched[0], matchedOn: 'name_and_dob' }
      : { member: null, matchedOn: null };
  }

  /** Matches an import row's scheme and level columns onto a level, by name. */
  private matchLevel(
    row: RiseCsvRow,
    schemes: SchemeWithLevels[],
    schemeId?: string,
  ): AwardLevel | null {
    const levelName = row.level.trim().toLowerCase();
    if (!levelName) return null;

    const schemeName = row.scheme.trim().toLowerCase();
    const candidateSchemes = schemeId
      ? schemes.filter((scheme) => scheme.scheme_id === schemeId)
      : schemeName
        ? schemes.filter((scheme) => scheme.name.trim().toLowerCase() === schemeName)
        : schemes;

    const matches = candidateSchemes.flatMap((scheme) =>
      scheme.levels.filter((level) => level.name.trim().toLowerCase() === levelName),
    );

    return matches.length === 1 ? matches[0] : null;
  }

  /** Whether this club has installed British Gymnastics Rise. */
  async hasRiseScheme(): Promise<boolean> {
    const schemes = await this.awardsRepository.findAllSchemes(true);
    return schemes.some((scheme) => scheme.source === AwardSchemeSource.BG_RISE);
  }
}
