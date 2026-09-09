import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DBSCheck, DBSStatus } from './entities/dbs-check.entity';
import { CreateDBSCheckDto } from './dto/create-dbs-check.dto';
import { UpdateDBSCheckDto } from './dto/update-dbs-check.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class DBSRepository {
  constructor(
    @InjectRepository(DBSCheck)
    private readonly dbsCheckRepository: Repository<DBSCheck>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createDto: CreateDBSCheckDto, createdBy: string): Promise<DBSCheck> {
    const subject = await this.scoped.scopedFindOne(
      this.dbsCheckRepository.manager.getRepository(User),
      {
        where: { user_id: createDto.user_id },
        select: { user_id: true },
      },
    );
    if (!subject) throw new NotFoundException('Staff member not found');
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createDto as CreateDBSCheckDto & { club_id?: string };
    const dbsCheck = this.dbsCheckRepository.create(
      this.scoped.stampCreate<DBSCheck>({
        ...rest,
        created_by_user_id: createdBy,
      }),
    );
    return await this.dbsCheckRepository.save(dbsCheck);
  }

  async findAll(): Promise<DBSCheck[]> {
    return await this.scoped.scopedFind(this.dbsCheckRepository, {
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DBSCheck | null> {
    // A dbs_check_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.dbsCheckRepository, {
      where: { dbs_check_id: id },
      relations: ['user'],
    });
  }

  async findByUser(userId: string): Promise<DBSCheck[]> {
    return await this.scoped.scopedFind(this.dbsCheckRepository, {
      where: { user_id: userId },
      order: { issue_date: 'DESC' },
    });
  }

  async findLatestByUser(userId: string): Promise<DBSCheck | null> {
    const checks = await this.findByUser(userId);
    return checks.length > 0 ? checks[0] : null;
  }

  async findExpiringSoon(daysAhead: number = 90): Promise<DBSCheck[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.scoped.scopedFind(this.dbsCheckRepository, {
      where: {
        expiry_date: LessThan(futureDate),
        status: DBSStatus.VALID,
      },
      relations: ['user'],
      order: { expiry_date: 'ASC' },
    });
  }

  async findExpired(): Promise<DBSCheck[]> {
    const today = new Date();

    return await this.scoped.scopedFind(this.dbsCheckRepository, {
      where: {
        expiry_date: LessThan(today),
        status: DBSStatus.VALID, // Should be marked as expired
      },
      relations: ['user'],
    });
  }

  async update(
    id: string,
    updateDto: UpdateDBSCheckDto,
    verifiedBy?: string,
  ): Promise<DBSCheck | null> {
    // Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateDto as UpdateDBSCheckDto & { club_id?: string };
    const updateData: Record<string, unknown> = { ...rest };

    if (verifiedBy && updateDto.status) {
      updateData.verified_by_user_id = verifiedBy;
      updateData.last_verified_date = new Date();
    }

    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated.
    await this.dbsCheckRepository.update(
      { dbs_check_id: id, club_id: this.tenantContext.getClubId() },
      updateData,
    );
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.dbsCheckRepository.delete({
      dbs_check_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async markAsExpired(id: string): Promise<void> {
    await this.dbsCheckRepository.update(
      { dbs_check_id: id, club_id: this.tenantContext.getClubId() },
      {
        status: DBSStatus.EXPIRED,
        is_valid: false,
      },
    );
  }

  async markAsExpiringSoon(id: string): Promise<void> {
    await this.dbsCheckRepository.update(
      { dbs_check_id: id, club_id: this.tenantContext.getClubId() },
      {
        status: DBSStatus.EXPIRING_SOON,
      },
    );
  }

  async count(): Promise<number> {
    return await this.dbsCheckRepository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async countByStatus(status: DBSStatus): Promise<number> {
    return await this.dbsCheckRepository.count({
      where: { status, club_id: this.tenantContext.getClubId() },
    });
  }
}
