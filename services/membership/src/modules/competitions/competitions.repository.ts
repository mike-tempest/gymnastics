import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Competition } from './entities/competition.entity';
import { CompetitionEntry } from './entities/competition-entry.entity';
import { CompetitionResult } from './entities/competition-result.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class CompetitionsRepository {
  constructor(
    @InjectRepository(Competition)
    private readonly competitionRepo: Repository<Competition>,
    @InjectRepository(CompetitionEntry)
    private readonly entryRepo: Repository<CompetitionEntry>,
    @InjectRepository(CompetitionResult)
    private readonly resultRepo: Repository<CompetitionResult>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Resolves the active tenant's club_id, and asserts the given competition
   * belongs to that club. Used to guard writes to child rows (entries,
   * results): a competition_id guessed from another club must not be writable.
   * Behaves as not-found when the competition is missing or cross-tenant.
   */
  private async assertCompetitionInClub(competitionId: string): Promise<string> {
    const clubId = this.tenantContext.getClubId();
    const competition = await this.competitionRepo.findOne({
      where: { competition_id: competitionId, club_id: clubId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    }
    return clubId;
  }

  // --- Competition CRUD ---

  async createCompetition(dto: CreateCompetitionDto): Promise<Competition> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = dto;
    const competition = this.competitionRepo.create(this.scoped.stampCreate<Competition>(rest));
    return await this.competitionRepo.save(competition);
  }

  async findAllCompetitions(): Promise<Competition[]> {
    return await this.scoped.scopedFind(this.competitionRepo, {
      order: { start_date: 'DESC' },
    });
  }

  async findCompetitionById(id: string): Promise<Competition | null> {
    // A competition_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.competitionRepo, {
      where: { competition_id: id },
      relations: ['entries', 'results'],
    });
  }

  async updateCompetition(id: string, dto: UpdateCompetitionDto): Promise<Competition | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = dto as UpdateCompetitionDto & {
      club_id?: string;
    };
    await this.competitionRepo.update(
      { competition_id: id, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findCompetitionById(id);
  }

  async removeCompetition(id: string): Promise<void> {
    await this.competitionRepo.delete({
      competition_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  // --- Entry CRUD ---

  async createEntry(competitionId: string, dto: CreateEntryDto): Promise<CompetitionEntry> {
    // Ensure the parent competition is in the caller's club before writing the
    // child row, and stamp the same club_id onto the entry.
    const clubId = await this.assertCompetitionInClub(competitionId);
    const entry = this.entryRepo.create({
      ...dto,
      competition_id: competitionId,
      club_id: clubId,
    });
    return await this.entryRepo.save(entry);
  }

  async createEntries(competitionId: string, dtos: CreateEntryDto[]): Promise<CompetitionEntry[]> {
    const clubId = await this.assertCompetitionInClub(competitionId);
    const entries = dtos.map((dto) =>
      this.entryRepo.create({
        ...dto,
        competition_id: competitionId,
        club_id: clubId,
      }),
    );
    return await this.entryRepo.save(entries);
  }

  async findEntriesByCompetition(competitionId: string): Promise<CompetitionEntry[]> {
    return await this.scoped.scopedFind(this.entryRepo, {
      where: { competition_id: competitionId },
      order: { created_at: 'ASC' },
    });
  }

  async findEntriesByMember(memberId: string): Promise<CompetitionEntry[]> {
    return await this.scoped.scopedFind(this.entryRepo, {
      where: { member_id: memberId },
      order: { created_at: 'DESC' },
    });
  }

  // --- Result CRUD ---

  async createResult(result: Partial<CompetitionResult>): Promise<CompetitionResult> {
    // A result must reference a competition in the caller's club; the club_id
    // is stamped from that parent, never from the supplied payload.
    const { club_id: _ignored, competition_id } = result;
    if (!competition_id) {
      throw new NotFoundException('competition_id is required to create a result');
    }
    const clubId = await this.assertCompetitionInClub(competition_id);
    const entity = this.resultRepo.create({ ...result, club_id: clubId });
    return await this.resultRepo.save(entity);
  }

  async createResults(results: Partial<CompetitionResult>[]): Promise<CompetitionResult[]> {
    if (results.length === 0) {
      return [];
    }
    // All results in a bulk import target a single competition; verify each
    // referenced competition is in the caller's club and stamp it from there.
    const clubIdByCompetition = new Map<string, string>();
    const entities: CompetitionResult[] = [];
    for (const result of results) {
      const { club_id: _ignored, competition_id } = result;
      if (!competition_id) {
        throw new NotFoundException('competition_id is required to create a result');
      }
      let clubId = clubIdByCompetition.get(competition_id);
      if (!clubId) {
        clubId = await this.assertCompetitionInClub(competition_id);
        clubIdByCompetition.set(competition_id, clubId);
      }
      entities.push(this.resultRepo.create({ ...result, club_id: clubId }));
    }
    return await this.resultRepo.save(entities);
  }

  async findResultsByIds(resultIds: string[]): Promise<CompetitionResult[]> {
    if (resultIds.length === 0) {
      return [];
    }
    return await this.scoped.scopedFind(this.resultRepo, {
      where: { result_id: In(resultIds) },
    });
  }

  async findResultById(resultId: string): Promise<CompetitionResult | null> {
    return await this.scoped.scopedFindOne(this.resultRepo, {
      where: { result_id: resultId },
    });
  }

  async updateResult(
    resultId: string,
    changes: Partial<CompetitionResult>,
  ): Promise<CompetitionResult | null> {
    // Scope the affected-row predicate by club_id, and never allow the club,
    // competition or member of an existing result to be reassigned.
    const { club_id: _club, competition_id: _competition, member_id: _member, ...rest } = changes;
    await this.resultRepo.update(
      { result_id: resultId, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findResultById(resultId);
  }

  async removeResult(resultId: string): Promise<void> {
    await this.resultRepo.delete({
      result_id: resultId,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async findResultsByCompetition(competitionId: string): Promise<CompetitionResult[]> {
    return await this.scoped.scopedFind(this.resultRepo, {
      where: { competition_id: competitionId },
      order: { distance: 'ASC', stroke: 'ASC', place: 'ASC' },
    });
  }

  async findResultsByMember(memberId: string): Promise<CompetitionResult[]> {
    // The competition relation carries the meet name, date and course, which
    // the member profile and progression views need alongside each time.
    return await this.scoped.scopedFind(this.resultRepo, {
      where: { member_id: memberId },
      relations: ['competition'],
      order: { created_at: 'DESC' },
    });
  }
}
