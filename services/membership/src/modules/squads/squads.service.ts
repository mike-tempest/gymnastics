import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SquadsRepository } from './squads.repository';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { Squad } from './entities/squad.entity';
import { Swimmer } from '../swimmers/entities/swimmer.entity';

@Injectable()
export class SquadsService {
  constructor(private readonly squadsRepository: SquadsRepository) {}

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

  async findAll(): Promise<Squad[]> {
    const squads = await this.squadsRepository.findAll();

    // Add swimmer_count to each squad
    return squads.map((squad) => ({
      ...squad,
      swimmer_count: squad.swimmers ? squad.swimmers.length : 0,
    })) as Squad[];
  }

  async findOne(id: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(id);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${id} not found`);
    }

    // Add swimmer_count
    return {
      ...squad,
      swimmer_count: squad.swimmers ? squad.swimmers.length : 0,
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
      return {
        ...updated,
        swimmer_count: updated.swimmers ? updated.swimmers.length : 0,
      } as Squad;
    } catch (error: unknown) {
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.squadsRepository.remove(id);
  }

  async assignSwimmer(squadId: string, swimmerId: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(squadId);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    // Check capacity
    if (squad.max_capacity && squad.swimmers && squad.swimmers.length >= squad.max_capacity) {
      throw new BadRequestException(`Squad is at full capacity (${squad.max_capacity} swimmers)`);
    }

    const updatedSquad = await this.squadsRepository.assignSwimmer(squadId, swimmerId);
    if (!updatedSquad) {
      throw new NotFoundException(`Swimmer with ID ${swimmerId} not found`);
    }

    return {
      ...updatedSquad,
      swimmer_count: updatedSquad.swimmers ? updatedSquad.swimmers.length : 0,
    } as Squad;
  }

  async removeSwimmer(squadId: string, swimmerId: string): Promise<Squad> {
    const squad = await this.squadsRepository.findOne(squadId);
    if (!squad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    const updatedSquad = await this.squadsRepository.removeSwimmer(squadId, swimmerId);
    if (!updatedSquad) {
      throw new NotFoundException(`Squad with ID ${squadId} not found`);
    }

    return {
      ...updatedSquad,
      swimmer_count: updatedSquad.swimmers ? updatedSquad.swimmers.length : 0,
    } as Squad;
  }

  async getSwimmersBySquad(squadId: string): Promise<Swimmer[]> {
    await this.findOne(squadId); // Verify squad exists
    return await this.squadsRepository.getSwimmersBySquad(squadId);
  }

  async getStatistics() {
    const total = await this.squadsRepository.count();
    return {
      total,
    };
  }
}
