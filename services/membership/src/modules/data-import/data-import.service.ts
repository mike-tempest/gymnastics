import { Injectable, Logger } from '@nestjs/common';
import { MEMBER_NOUN_LOWER } from '../../common/brand';
import { FamiliesRepository } from '../families/families.repository';
import { MembersRepository } from '../members/members.repository';
import { SquadsRepository } from '../squads/squads.repository';
import { Family } from '../families/entities/family.entity';
import { Member } from '../members/entities/member.entity';
import { CreateFamilyDto } from '../families/dto/create-family.dto';
import { CreateMemberDto } from '../members/dto/create-member.dto';
import { UpdateMemberDto } from '../members/dto/update-member.dto';
import { ImportMembersDto } from './dto/import-members.dto';
import { MemberImportRowDto } from './dto/member-import-row.dto';

export type RowAction = 'create' | 'update' | 'error';
export type FamilyAction = 'create' | 'match';

export interface ImportPreviewRowResult {
  row: number;
  action: RowAction;
  family_action: FamilyAction;
  errors: string[];
}

export interface ImportPreviewResponse {
  summary: {
    families_to_create: number;
    families_matched: number;
    members_to_create: number;
    members_to_update: number;
    squads_matched: string[];
    squads_missing: string[];
  };
  row_results: ImportPreviewRowResult[];
}

export interface ImportOutcomeResponse {
  summary: {
    families_created: number;
    members_created: number;
    members_updated: number;
  };
  errors: Array<{ row: number; message: string }>;
}

interface RowPlan {
  row: number; // 1-based position in the submitted rows array
  data: MemberImportRowDto;
  errors: string[];
  memberAction: 'create' | 'update';
  existingMemberId: string | null;
  existingSquadId: string | null;
  // Set when the squad is unknown and create_missing_squads is enabled.
  squadToCreate: string | null;
  // Registration identity (registration_number plus governing body) used to collapse
  // several payload rows describing the same member into one record.
  seKey: string | null;
}

type MatchedFamily = Pick<Family, 'family_id' | 'family_name' | 'primary_contact_email'>;

interface FamilyPlan {
  email: string; // lowercase parent_email used as the grouping key
  rows: RowPlan[];
  existingFamily: MatchedFamily | null;
  createFamilyDto: CreateFamilyDto;
}

interface ImportPlan {
  familyPlans: FamilyPlan[];
  rowPlans: RowPlan[]; // in submitted row order
  squadsMatched: string[];
  squadsMissing: string[];
}

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(
    private readonly familiesRepository: FamiliesRepository,
    private readonly membersRepository: MembersRepository,
    private readonly squadsRepository: SquadsRepository,
  ) {}

  /**
   * Dry run: validates and resolves every row exactly as an import would,
   * but persists nothing.
   */
  async previewMembers(dto: ImportMembersDto): Promise<ImportPreviewResponse> {
    const plan = await this.buildPlan(dto);

    let familiesToCreate = 0;
    let familiesMatched = 0;
    for (const familyPlan of plan.familyPlans) {
      if (familyPlan.existingFamily) {
        familiesMatched++;
      } else if (familyPlan.rows.some((row) => row.errors.length === 0)) {
        // A family is only created when at least one of its rows can import.
        familiesToCreate++;
      }
    }

    const importableRows = plan.rowPlans.filter((row) => row.errors.length === 0);

    return {
      summary: {
        families_to_create: familiesToCreate,
        families_matched: familiesMatched,
        members_to_create: importableRows.filter((row) => row.memberAction === 'create').length,
        members_to_update: importableRows.filter((row) => row.memberAction === 'update').length,
        squads_matched: plan.squadsMatched,
        squads_missing: plan.squadsMissing,
      },
      row_results: plan.familyPlans
        .flatMap((familyPlan) =>
          familyPlan.rows.map(
            (row): ImportPreviewRowResult => ({
              row: row.row,
              action: row.errors.length > 0 ? 'error' : row.memberAction,
              family_action: familyPlan.existingFamily ? 'match' : 'create',
              errors: row.errors,
            }),
          ),
        )
        .sort((a, b) => a.row - b.row),
    };
  }

  /**
   * Performs the import. Per-row failures are collected and reported; the
   * batch is never aborted part-way. Parent invites are deliberately NOT
   * sent for imported families.
   */
  async importMembers(dto: ImportMembersDto): Promise<ImportOutcomeResponse> {
    const plan = await this.buildPlan(dto);

    let familiesCreated = 0;
    let membersCreated = 0;
    let membersUpdated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // Squads created during this import, keyed by lowercase name, so several
    // rows referencing the same new squad share a single created squad.
    const createdSquads = new Map<string, string>();
    // Members created during this import, keyed by registration identity, so
    // a later row with the same (registration_number, governing_body) updates the
    // member created earlier instead of violating the unique constraint.
    const createdMembersBySeKey = new Map<string, string>();

    for (const familyPlan of plan.familyPlans) {
      for (const rowPlan of familyPlan.rows) {
        if (rowPlan.errors.length > 0) {
          errors.push({ row: rowPlan.row, message: rowPlan.errors.join('; ') });
        }
      }

      const importableRows = familyPlan.rows.filter((row) => row.errors.length === 0);
      if (importableRows.length === 0) {
        continue;
      }

      let familyId: string;
      if (familyPlan.existingFamily) {
        familyId = familyPlan.existingFamily.family_id;
      } else {
        try {
          const family = await this.familiesRepository.create(familyPlan.createFamilyDto);
          familiesCreated++;
          familyId = family.family_id;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to create family';
          for (const rowPlan of importableRows) {
            errors.push({ row: rowPlan.row, message });
          }
          continue;
        }
      }

      for (const rowPlan of importableRows) {
        try {
          const squadId = await this.resolveSquadIdForImport(rowPlan, createdSquads);

          // The target may be an existing member, or one created earlier in
          // this batch under the same (registration_number, governing_body) identity.
          const targetMemberId =
            rowPlan.existingMemberId ??
            (rowPlan.seKey ? (createdMembersBySeKey.get(rowPlan.seKey) ?? null) : null);

          if (targetMemberId) {
            await this.membersRepository.update(
              targetMemberId,
              this.toMemberUpdateFields(rowPlan.data, familyId, squadId),
            );
            membersUpdated++;
          } else {
            const member = await this.membersRepository.create(
              this.toMemberCreateFields(rowPlan.data, familyId, squadId),
            );
            if (rowPlan.seKey) {
              createdMembersBySeKey.set(rowPlan.seKey, member.member_id);
            }
            membersCreated++;
          }
        } catch (error: unknown) {
          errors.push({
            row: rowPlan.row,
            message:
              error instanceof Error ? error.message : `Failed to import ${MEMBER_NOUN_LOWER}`,
          });
        }
      }
    }

    errors.sort((a, b) => a.row - b.row);

    this.logger.log(
      `Members import complete: ${familiesCreated} families created, ` +
        `${membersCreated} members created, ${membersUpdated} members updated, ` +
        `${errors.length} row errors`,
    );

    return {
      summary: {
        families_created: familiesCreated,
        members_created: membersCreated,
        members_updated: membersUpdated,
      },
      errors,
    };
  }

  /**
   * Resolves every row against current club data without persisting anything.
   * Shared by preview and import so both take identical decisions.
   */
  private async buildPlan(dto: ImportMembersDto): Promise<ImportPlan> {
    const [clubMembers, clubSquads] = await Promise.all([
      this.membersRepository.findAll(),
      // Ids and names only: name matching never needs the members relation.
      this.squadsRepository.findAllNames(),
    ]);

    const squadsByName = new Map(
      clubSquads.map((squad) => [squad.squad_name.trim().toLowerCase(), squad]),
    );
    const squadsMatched = new Set<string>();
    const squadsMissing = new Set<string>();

    // Group rows by lowercase parent email: one family per email address.
    const familyPlansByEmail = new Map<string, FamilyPlan>();
    const rowPlans: RowPlan[] = [];
    // First payload row seen for each registration identity, so later rows
    // describing the same member collapse onto it instead of tripping the
    // (governing_body, registration_number) unique constraint at insert time.
    const batchSeKeys = new Map<string, RowPlan>();

    for (let i = 0; i < dto.rows.length; i++) {
      const data = dto.rows[i];
      const rowPlan: RowPlan = {
        row: i + 1,
        data,
        errors: [],
        memberAction: 'create',
        existingMemberId: null,
        existingSquadId: null,
        squadToCreate: null,
        seKey: null,
      };

      // Squad resolution (case-insensitive against the club's squads)
      const squadName = data.squad_name?.trim();
      if (squadName) {
        const existingSquad = squadsByName.get(squadName.toLowerCase());
        if (existingSquad) {
          rowPlan.existingSquadId = existingSquad.squad_id;
          squadsMatched.add(existingSquad.squad_name);
        } else {
          squadsMissing.add(squadName);
          if (dto.options.create_missing_squads) {
            rowPlan.squadToCreate = squadName;
          } else {
            rowPlan.errors.push(
              `Squad "${squadName}" does not exist and create_missing_squads is disabled`,
            );
          }
        }
      }

      // Member upsert resolution
      this.resolveMemberMatch(rowPlan, clubMembers, batchSeKeys);

      rowPlans.push(rowPlan);

      const email = data.parent_email.trim().toLowerCase();
      let familyPlan = familyPlansByEmail.get(email);
      if (!familyPlan) {
        familyPlan = {
          email,
          rows: [],
          existingFamily: await this.familiesRepository.findByPrimaryContactEmail(email),
          createFamilyDto: this.toCreateFamilyDto(data),
        };
        familyPlansByEmail.set(email, familyPlan);
      }
      familyPlan.rows.push(rowPlan);
    }

    return {
      familyPlans: Array.from(familyPlansByEmail.values()),
      rowPlans,
      squadsMatched: Array.from(squadsMatched),
      squadsMissing: Array.from(squadsMissing),
    };
  }

  /**
   * Resolves an import row against existing club members and earlier rows in
   * the same batch.
   *
   * Registration numbers are unique per governing body, not globally, so when
   * the row provides governing_body the match is on the (registration_number,
   * governing_body) pair. Without a governing_body the match is on registration_number
   * alone, but if several members share that registration_number across governing
   * bodies the row errors rather than guessing. Rows without an registration_number
   * match on first name, last name and dob (case-insensitive).
   *
   * A second payload row with the same registration identity collapses onto
   * the first: it becomes an update of the same member instead of a
   * duplicate insert that would trip the unique constraint.
   */
  private resolveMemberMatch(
    rowPlan: RowPlan,
    clubMembers: Member[],
    batchSeKeys: Map<string, RowPlan>,
  ): void {
    const data = rowPlan.data;
    const registrationNumber = data.registration_number?.trim();

    if (registrationNumber) {
      const body = data.governing_body ?? null;
      rowPlan.seKey = `${registrationNumber.toLowerCase()}|${body ?? ''}`;

      let matched: Member | null = null;
      if (body) {
        matched =
          clubMembers.find(
            (member) =>
              member.registration_number === registrationNumber && member.governing_body === body,
          ) ?? null;
      } else {
        const candidates = clubMembers.filter(
          (member) => member.registration_number === registrationNumber,
        );
        if (candidates.length > 1) {
          rowPlan.errors.push(
            `Registration number ${registrationNumber} matches more than one ${MEMBER_NOUN_LOWER} across ` +
              `governing bodies; supply governing_body to identify which ${MEMBER_NOUN_LOWER} this row is for`,
          );
          return;
        }
        matched = candidates[0] ?? null;
      }

      if (matched) {
        rowPlan.memberAction = 'update';
        rowPlan.existingMemberId = matched.member_id;
      }

      // Collapse onto an earlier batch row with the same registration
      // identity. When that row creates the member, the id is resolved at
      // import time from the created-members cache via seKey.
      const priorRow = batchSeKeys.get(rowPlan.seKey);
      if (priorRow) {
        rowPlan.memberAction = 'update';
        rowPlan.existingMemberId = rowPlan.existingMemberId ?? priorRow.existingMemberId;
      } else {
        batchSeKeys.set(rowPlan.seKey, rowPlan);
      }
      return;
    }

    const firstName = data.member_first_name.trim().toLowerCase();
    const lastName = data.member_last_name.trim().toLowerCase();
    const dob = this.toDateKey(data.dob);

    const matched =
      clubMembers.find(
        (member) =>
          member.first_name.trim().toLowerCase() === firstName &&
          member.last_name.trim().toLowerCase() === lastName &&
          this.toDateKey(member.dob) === dob,
      ) ?? null;

    if (matched) {
      rowPlan.memberAction = 'update';
      rowPlan.existingMemberId = matched.member_id;
    }
  }

  private toCreateFamilyDto(data: MemberImportRowDto): CreateFamilyDto {
    // The family name defaults to the member's last name when not supplied.
    const familyName = data.family_name?.trim() || data.member_last_name.trim();
    return {
      family_name: familyName,
      primary_contact_name: data.parent_name.trim(),
      primary_contact_email: data.parent_email.trim(),
      primary_contact_phone: data.parent_phone?.trim() || undefined,
      address_line1: data.address_line1?.trim() || undefined,
      address_line2: data.address_line2?.trim() || undefined,
      city: data.city?.trim() || undefined,
      postcode: data.postcode?.trim() || undefined,
    };
  }

  private toMemberCreateFields(
    data: MemberImportRowDto,
    familyId: string,
    squadId: string | null,
  ): CreateMemberDto {
    return {
      first_name: data.member_first_name.trim(),
      last_name: data.member_last_name.trim(),
      dob: data.dob,
      gender: this.normaliseGender(data.gender),
      family_id: familyId,
      registration_number: data.registration_number?.trim() || null,
      governing_body: data.governing_body ?? null,
      squad_id: squadId ?? undefined,
      medical_notes: data.medical_notes,
      emergency_contact: data.emergency_contact,
    };
  }

  private toMemberUpdateFields(
    data: MemberImportRowDto,
    familyId: string,
    squadId: string | null,
  ): UpdateMemberDto {
    // Fill or overwrite only the fields the row actually provides. Fields the
    // row omits (including the squad) are left untouched on the member.
    const fields: UpdateMemberDto = {
      first_name: data.member_first_name.trim(),
      last_name: data.member_last_name.trim(),
      dob: data.dob,
      gender: this.normaliseGender(data.gender),
      family_id: familyId,
    };
    if (data.registration_number?.trim()) {
      fields.registration_number = data.registration_number.trim();
    }
    if (data.governing_body) {
      fields.governing_body = data.governing_body;
    }
    if (squadId) {
      fields.squad_id = squadId;
    }
    if (data.medical_notes !== undefined) {
      fields.medical_notes = data.medical_notes;
    }
    if (data.emergency_contact !== undefined) {
      fields.emergency_contact = data.emergency_contact;
    }
    return fields;
  }

  /**
   * Returns the squad id for an importable row, creating the squad when the
   * plan marked it for creation. Newly created squads are cached so multiple
   * rows referencing the same name share one squad.
   */
  private async resolveSquadIdForImport(
    rowPlan: RowPlan,
    createdSquads: Map<string, string>,
  ): Promise<string | null> {
    if (rowPlan.existingSquadId) {
      return rowPlan.existingSquadId;
    }
    if (!rowPlan.squadToCreate) {
      return null;
    }

    const key = rowPlan.squadToCreate.toLowerCase();
    const cached = createdSquads.get(key);
    if (cached) {
      return cached;
    }

    const squad = await this.squadsRepository.create({ squad_name: rowPlan.squadToCreate });
    createdSquads.set(key, squad.squad_id);
    return squad.squad_id;
  }

  private normaliseGender(gender: string): string {
    if (gender === 'Male') {
      return 'M';
    }
    if (gender === 'Female') {
      return 'F';
    }
    return gender;
  }

  private toDateKey(value: string | Date): string {
    if (value instanceof Date) {
      // Use local date components: the pg driver materialises date columns as
      // local-midnight Date objects, so toISOString() would shift the day for
      // timezones ahead of UTC (e.g. BST).
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(value).slice(0, 10);
  }
}
