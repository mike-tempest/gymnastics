import { Injectable, NotFoundException } from '@nestjs/common';
import { ClubsRepository } from './clubs.repository';
import { Club } from './entities/club.entity';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class ClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(club: Partial<Club>): Promise<Club> {
    return await this.clubsRepository.create(club);
  }

  async findAll(): Promise<Club[]> {
    return await this.clubsRepository.findAll();
  }

  async findOne(id: string): Promise<Club> {
    const club = await this.clubsRepository.findOne(id);
    if (!club) {
      throw new NotFoundException(`Club with ID ${id} not found`);
    }
    return club;
  }

  async findBySlug(slug: string): Promise<Club> {
    const club = await this.clubsRepository.findBySlug(slug);
    if (!club) {
      throw new NotFoundException(`Club with slug ${slug} not found`);
    }
    return club;
  }

  /**
   * Returns the calling tenant's club, resolved from the CLS tenant context
   * (set from the JWT's club_id by the TenantInterceptor). Never trusts a
   * client-supplied club id.
   */
  async findCurrent(): Promise<Club> {
    return await this.findOne(this.tenantContext.getClubId());
  }
}
