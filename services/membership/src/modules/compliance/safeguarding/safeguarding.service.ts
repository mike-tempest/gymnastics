import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ChecklistItem } from './entities/checklist-item.entity';
import { SafeguardingOfficer } from './entities/safeguarding-officer.entity';
import { Incident, IncidentStatus } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateOfficerDto } from './dto/create-officer.dto';
import { UpdateOfficerDto } from './dto/update-officer.dto';
import { getSafeguardingTemplate } from './safeguarding-templates';
import { ClubsService } from '../../clubs/clubs.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';

/** Postgres error code for a unique constraint violation. */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; driverError?: { code?: string } };
  return err?.code === PG_UNIQUE_VIOLATION || err?.driverError?.code === PG_UNIQUE_VIOLATION;
}

@Injectable()
export class SafeguardingService {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly checklistRepository: Repository<ChecklistItem>,
    @InjectRepository(SafeguardingOfficer)
    private readonly officerRepository: Repository<SafeguardingOfficer>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly dataSource: DataSource,
    private readonly clubsService: ClubsService,
    private readonly tenantContext: TenantContextService,
    private readonly scoped: TenantScopedHelper,
  ) {}

  /**
   * Returns the active club's safeguarding checklist in template order.
   *
   * On first access for a club the checklist is empty, so we seed it from the
   * template for the club's governing body and return the persisted rows.
   * Subsequent calls read the stored rows, so ids and completion state are
   * stable across requests.
   */
  async getChecklist(): Promise<ChecklistItem[]> {
    const existing = await this.scoped.scopedFind(this.checklistRepository, {
      order: { sort_order: 'ASC' },
    });
    if (existing.length > 0) {
      return existing;
    }

    return this.seedChecklist();
  }

  /**
   * Seeds the club's checklist from its governing body's template inside a
   * transaction. The unique index on (club_id, requirement) makes concurrent
   * first-loads safe: if another request seeded the rows first, the insert
   * fails on the constraint and we return the already-persisted set.
   */
  private async seedChecklist(): Promise<ChecklistItem[]> {
    const clubId = this.tenantContext.getClubId();
    const club = await this.clubsService.findCurrent();
    const template = getSafeguardingTemplate(club.governing_body);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ChecklistItem);
        const items = template.map((item, index) =>
          repo.create({
            club_id: clubId,
            requirement: item.requirement,
            description: item.description,
            completed: false,
            sort_order: index,
          }),
        );
        return repo.save(items);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // A concurrent request won the seeding race; return its rows.
        return this.scoped.scopedFind(this.checklistRepository, {
          order: { sort_order: 'ASC' },
        });
      }
      throw error;
    }
  }

  /**
   * Toggles the completion state of a single checklist item. The affected-row
   * predicate is scoped by club_id so a guessed id from another club cannot be
   * mutated.
   */
  async updateChecklistItem(id: string, completed: boolean): Promise<ChecklistItem> {
    await this.checklistRepository.update(
      { id, club_id: this.tenantContext.getClubId() },
      { completed },
    );

    const updated = await this.scoped.scopedFindOne(this.checklistRepository, {
      where: { id },
    });
    if (!updated) {
      throw new NotFoundException(`Checklist item with ID ${id} not found`);
    }
    return updated;
  }

  /**
   * Returns the active club's safeguarding officers.
   */
  async getOfficers(): Promise<SafeguardingOfficer[]> {
    return this.scoped.scopedFind(this.officerRepository, {
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Creates a safeguarding officer for the active club. club_id is stamped
   * from the tenant context; the DTO never carries a club_id. dbs_expiry is
   * passed through as its ISO date string so the date-only column stores the
   * calendar date exactly as submitted (a Date object round-trips through the
   * server timezone and can shift a day).
   */
  async createOfficer(createOfficerDto: CreateOfficerDto): Promise<SafeguardingOfficer> {
    const officer = this.officerRepository.create(
      this.scoped.stampCreate<SafeguardingOfficer>({ ...createOfficerDto }),
    );
    return this.officerRepository.save(officer);
  }

  /**
   * Updates a safeguarding officer belonging to the active club. The
   * affected-row predicate is scoped by club_id so an id from another club
   * cannot be mutated. An empty patch is a no-op read rather than an error.
   */
  async updateOfficer(
    id: string,
    updateOfficerDto: UpdateOfficerDto,
  ): Promise<SafeguardingOfficer> {
    const updateData: Record<string, unknown> = { ...updateOfficerDto };

    if (Object.keys(updateData).length > 0) {
      await this.officerRepository.update(
        { id, club_id: this.tenantContext.getClubId() },
        updateData,
      );
    }

    const updated = await this.scoped.scopedFindOne(this.officerRepository, {
      where: { id },
    });
    if (!updated) {
      throw new NotFoundException(`Safeguarding officer with ID ${id} not found`);
    }
    return updated;
  }

  /**
   * Deletes a safeguarding officer belonging to the active club. Scoped by
   * club_id so an id from another club resolves to not-found.
   */
  async deleteOfficer(id: string): Promise<void> {
    const result = await this.officerRepository.delete({
      id,
      club_id: this.tenantContext.getClubId(),
    });
    if (!result.affected) {
      throw new NotFoundException(`Safeguarding officer with ID ${id} not found`);
    }
  }

  /**
   * Persists a new safeguarding incident for the active club. club_id is
   * stamped from the tenant context; the DTO never carries a club_id. The
   * incident date is a date-only column, so the ISO date string from the DTO
   * is stored as submitted.
   */
  async createIncident(createIncidentDto: CreateIncidentDto): Promise<Incident> {
    const incident = this.incidentRepository.create(
      this.scoped.stampCreate<Incident>({
        date: createIncidentDto.date,
        category: createIncidentDto.category,
        summary: createIncidentDto.summary,
        status: createIncidentDto.status || IncidentStatus.OPEN,
        reported_by: createIncidentDto.reported_by,
      }),
    );
    return this.incidentRepository.save(incident);
  }

  /**
   * Returns the active club's incidents, newest first.
   */
  async getIncidents(): Promise<Incident[]> {
    return this.scoped.scopedFind(this.incidentRepository, {
      order: { date: 'DESC', created_at: 'DESC' },
    });
  }
}
