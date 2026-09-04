import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './entities/club.entity';

@Injectable()
export class ClubsRepository {
  constructor(
    @InjectRepository(Club)
    private readonly repository: Repository<Club>,
  ) {}

  async create(club: Partial<Club>): Promise<Club> {
    const entity = this.repository.create(club);
    return await this.repository.save(entity);
  }

  async findAll(): Promise<Club[]> {
    return await this.repository.find({
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Club | null> {
    return await this.repository.findOne({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Club | null> {
    return await this.repository.findOne({
      where: { slug },
    });
  }

  async count(): Promise<number> {
    return await this.repository.count();
  }

  /**
   * Persists changes to an already-loaded club entity. Callers must have
   * loaded the entity through a server-resolved id (e.g. from the tenant
   * context), never from client input.
   */
  async save(club: Club): Promise<Club> {
    return await this.repository.save(club);
  }
}
