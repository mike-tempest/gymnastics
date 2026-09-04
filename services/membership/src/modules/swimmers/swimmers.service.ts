import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SwimmersRepository } from './swimmers.repository';
import { CreateSwimmerDto } from './dto/create-swimmer.dto';
import { UpdateSwimmerDto } from './dto/update-swimmer.dto';
import { Swimmer } from './entities/swimmer.entity';

@Injectable()
export class SwimmersService {
  private readonly logger = new Logger(SwimmersService.name);

  constructor(private readonly swimmersRepository: SwimmersRepository) {}

  async create(createSwimmerDto: CreateSwimmerDto): Promise<Swimmer> {
    try {
      return await this.swimmersRepository.create(createSwimmerDto);
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        // Unique constraint violation
        throw new BadRequestException('A swimmer with this registration number already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Swimmer[]> {
    return await this.swimmersRepository.findAll();
  }

  async findOne(id: string): Promise<Swimmer> {
    const swimmer = await this.swimmersRepository.findOne(id);
    if (!swimmer) {
      throw new NotFoundException(`Swimmer with ID ${id} not found`);
    }
    return swimmer;
  }

  async findByFamilyId(familyId: string): Promise<Swimmer[]> {
    return await this.swimmersRepository.findByFamilyId(familyId);
  }

  async findByClubId(clubId: string): Promise<Swimmer[]> {
    return await this.swimmersRepository.findByClubId(clubId);
  }

  async findBySquadId(squadId: string): Promise<Swimmer[]> {
    return await this.swimmersRepository.findBySquadId(squadId);
  }

  async update(id: string, updateSwimmerDto: UpdateSwimmerDto): Promise<Swimmer> {
    await this.findOne(id); // This will throw if not found

    try {
      const updated = await this.swimmersRepository.update(id, updateSwimmerDto);
      if (!updated) {
        throw new NotFoundException(`Swimmer with ID ${id} not found`);
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new BadRequestException('A swimmer with this registration number already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.swimmersRepository.remove(id);
  }

  async getStatistics() {
    const total = await this.swimmersRepository.count();
    return {
      total,
    };
  }

  /**
   * Bulk create swimmers with validation per row.
   * Processes each swimmer individually and collects errors.
   * Returns successfully created swimmers and any errors encountered.
   */
  async bulkCreate(createSwimmerDtos: CreateSwimmerDto[]): Promise<{
    created: Swimmer[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const created: Swimmer[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Process each swimmer individually to handle validation errors gracefully
    for (let i = 0; i < createSwimmerDtos.length; i++) {
      try {
        const swimmer = await this.create(createSwimmerDtos[i]);
        created.push(swimmer);
      } catch (error: unknown) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Failed to create swimmer',
        });
      }
    }

    return { created, errors };
  }
}
