import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Discipline, SquadType } from '@club-manager/shared-types';
import { SquadCapacityEvents } from '../../common/capacity/squad-capacity.events';
import { SquadFilters, SquadsRepository } from './squads.repository';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { Squad } from './entities/squad.entity';
import { Member } from '../members/entities/member.entity';

@Injectable()
export class SquadsService {
  constructor(
    private readonly squadsRepository: SquadsRepository,
    private readonly capacityEvents: SquadCapacityEvents,
  ) {}

  async create(createSquadDto: CreateSquadDto): Promise<Squad> {
    // Validate age range if both min and max are provided
    if (
      createSquadDto.min_age !== undefined &&
      createSquadDto.max_age !== undefined &&
      createSquadDto.min_age > createSquadDto.max_age
    ) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age');
    }

    try {
      return await this.squadsRepository.create(createSquadDto);
    } catch (error: unknown) {
      throw error;
    }
  }

  /**
   * Bulk create squads with validation per row.
   * Processes each squad individually and collects errors; the batch is never aborted.
   * Duplicate squad names are rejected case-insensitively, both against the club's
   * existing squads and against earlier rows in the same payload.
   * Returns successfully created squads and any errors encountered (rows are 1-based).
   */
  async bulkCreate(createSquadDtos: CreateSquadDto[]): Promise<{
    created: Squad[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const created: Squad[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Existing squad names for the active club (the repository scopes by tenant)
    const existingSquads = await this.squadsRepository.findAllNames();
    const seenNames = new Set(existingSquads.map((squad) => squad.squad_name.toLowerCase()));

    for (let i = 0; i < createSquadDtos.length; i++) {
      const dto = createSquadDtos[i];
      const nameKey = dto.squad_name.toLowerCase();

      if (seenNames.has(nameKey)) {
        errors.push({
          row: i + 1,
          message: `A squad named "${dto.squad_name}" already exists`,
        });
        continue;
      }
      seenNames.add(nameKey);

      try {
        const squad = await this.create(dto);
        created.push(squad);
      } catch (error: unknown) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Failed to create squad',
        });
      }
    }

    return { created, errors };
  }

  /**
   * Lists squads for the active club. Type and discipline compose, so a
   * request can ask for the recreational trampoline classes specifically.
   */
  async findAll(filters: SquadFilters = {}): Promise<Squad[]> {
    const squads = await this.squadsRepository.findAll(filters);

    // Add member_count to each squad
    return squads.map((squad) => ({
      ...squad,
      member_count: squad.members ? squad.members.length : 0,
    })) as Squad[];
  }

  async findOne(id: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(id);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${id} not found`);
    }

    // Add member_count
    return {
      ...squad,
      member_count: squad.members ? squad.members.length : 0,
    } as Squad;
  }

  async update(id: string, updateSquadDto: UpdateSquadDto): Promise<Squad> {
    const squad = await this.findOne(id); // This will throw if not found

    // Validate age range if both min and max are provided
    const minAge = updateSquadDto.min_age ?? squad.min_age;
    const maxAge = updateSquadDto.max_age ?? squad.max_age;

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age');
    }

    try {
      const updated = await this.squadsRepository.update(id, updateSquadDto);
      if (!updated) {
        throw new NotFoundException(`Squad with ID ${id} not found`);
      }
      // Raising the capacity opens places, so the waiting list gets to fill
      // them. The signal is advisory; the subscriber recounts for itself.
      const capacityRaised =
        updateSquadDto.max_capacity !== undefined &&
        (squad.max_capacity === null || updateSquadDto.max_capacity > squad.max_capacity);
      if (capacityRaised) {
        await this.capacityEvents.emitPlaceMayHaveOpened(id);
      }
      return {
        ...updated,
        member_count: updated.members ? updated.members.length : 0,
      } as Squad;
    } catch (error: unknown) {
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.squadsRepository.remove(id);
  }

  async assignMember(squadId: string, memberId: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(squadId);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    // Check capacity
    if (squad.max_capacity && squad.members && squad.members.length >= squad.max_capacity) {
      throw new BadRequestException(`Squad is at full capacity (${squad.max_capacity} members)`);
    }

    const updatedSquad = await this.squadsRepository.assignMember(squadId, memberId);
    if (!updatedSquad) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    return {
      ...updatedSquad,
      member_count: updatedSquad.members ? updatedSquad.members.length : 0,
    } as Squad;
  }

  async removeMember(squadId: string, memberId: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(squadId);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    const updatedSquad = await this.squadsRepository.removeMember(squadId, memberId);
    if (!updatedSquad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    // A member leaving is the commonest way a place opens.
    await this.capacityEvents.emitPlaceMayHaveOpened(squadId);

    return {
      ...updatedSquad,
      member_count: updatedSquad.members ? updatedSquad.members.length : 0,
    } as Squad;
  }

  async getMembersBySquad(squadId: string): Promise<Member[]> {
    await this.findOne(squadId); // Verify squad exists
    return await this.squadsRepository.getMembersBySquad(squadId);
  }

  /**
   * Squad counts for the club: the total, the recreational/competitive split,
   * and the spread across disciplines.
   *
   * Every squad type and every discipline is present as a key, zero included,
   * so a caller can render a full breakdown without having to know the lists.
   * Squads with nothing recorded are counted under `unclassified` and
   * `noDiscipline` rather than being dropped, so the parts always sum to the
   * total.
   */
  async getStatistics() {
    const classifications = await this.squadsRepository.findAllClassifications();

    const byType: Record<string, number> = { unclassified: 0 };
    for (const type of Object.values(SquadType)) {
      byType[type] = 0;
    }

    const byDiscipline: Record<string, number> = { noDiscipline: 0 };
    for (const discipline of Object.values(Discipline)) {
      byDiscipline[discipline] = 0;
    }

    for (const squad of classifications) {
      const typeKey = squad.squad_type ?? 'unclassified';
      byType[typeKey] = (byType[typeKey] ?? 0) + 1;

      const disciplineKey = squad.discipline ?? 'noDiscipline';
      byDiscipline[disciplineKey] = (byDiscipline[disciplineKey] ?? 0) + 1;
    }

    return {
      total: classifications.length,
      by_type: byType,
      by_discipline: byDiscipline,
    };
  }
}
