import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { AuditLog, AuditAction, AuditEntityType } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class AuditLogsRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Create an audit log entry.
   *
   * Audit writes can originate from non-request paths (e.g. login/logout flows
   * that run before a tenant context is established, or background jobs), so we
   * use getClubIdOrNull() rather than getClubId() to avoid throwing off-request.
   * Resolution order for club_id:
   *   1. any club_id explicitly supplied on the DTO (so callers that know the
   *      audited entity's club can pass it on non-request paths);
   *   2. the active tenant context, when present;
   *   3. otherwise we cannot derive a club. The audit_logs.club_id column is NOT
   *      NULL (Phase 1), so a system audit with no club source cannot be stored.
   *      We surface this rather than silently writing an empty/invalid uuid.
   * See REPORT for the full tension write-up.
   */
  async create(createDto: CreateAuditLogDto): Promise<AuditLog> {
    const clubId = createDto.club_id ?? this.tenantContext.getClubIdOrNull();

    if (!clubId) {
      throw new Error(
        'Cannot write audit log: no club_id available. audit_logs.club_id is NOT NULL, ' +
          'but this write originated outside a tenant context and the DTO carried no ' +
          'club_id. Supply club_id explicitly (e.g. derived from the audited entity) ' +
          'for non-request audit writes.',
      );
    }

    const auditLog = this.auditLogRepository.create({ ...createDto, club_id: clubId });
    return await this.auditLogRepository.save(auditLog);
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    return await this.scoped.scopedFind(this.auditLogRepository, {
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string): Promise<AuditLog | null> {
    // An audit_log_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.auditLogRepository, {
      where: { audit_log_id: id },
    });
  }

  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return await this.scoped.scopedFind(this.auditLogRepository, {
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByEntity(
    entityType: AuditEntityType,
    entityId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return await this.scoped.scopedFind(this.auditLogRepository, {
      where: { entity_type: entityType, entity_id: entityId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    return await this.scoped.scopedFind(this.auditLogRepository, {
      where: { action },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return await this.scoped.scopedFind(this.auditLogRepository, {
      where: {
        created_at: Between(startDate, endDate),
      },
      order: { created_at: 'DESC' },
    });
  }

  async findRecent(hours: number = 24): Promise<AuditLog[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return await this.scoped.scopedFind(this.auditLogRepository, {
      where: {
        created_at: MoreThan(since),
      },
      order: { created_at: 'DESC' },
    });
  }

  async count(): Promise<number> {
    return await this.auditLogRepository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return await this.auditLogRepository.count({
      where: { user_id: userId, club_id: this.tenantContext.getClubId() },
    });
  }

  async countByAction(action: AuditAction): Promise<number> {
    return await this.auditLogRepository.count({
      where: { action, club_id: this.tenantContext.getClubId() },
    });
  }

  async countByEntityType(entityType: AuditEntityType): Promise<number> {
    return await this.auditLogRepository.count({
      where: { entity_type: entityType, club_id: this.tenantContext.getClubId() },
    });
  }

  /**
   * Delete old audit logs (for data retention compliance).
   *
   * This is invoked by a weekly @Cron in AuditLogsService that runs with NO
   * tenant context. Retention cleanup is intentionally cross-club (it purges by
   * age across the whole table), so it does NOT scope by club_id. This is the
   * one deliberately unscoped write in this module; it never returns data to a
   * caller, only deletes rows past the 7-year retention window.
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.auditLogRepository.delete({
      created_at: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }
}
