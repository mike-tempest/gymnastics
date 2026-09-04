import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogsRepository } from './audit-logs.repository';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLog, AuditAction, AuditEntityType } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly RETENTION_DAYS = 2555; // 7 years (UK financial records retention)

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  /**
   * Create an audit log entry
   */
  async log(createDto: CreateAuditLogDto): Promise<AuditLog> {
    return await this.auditLogsRepository.create(createDto);
  }

  /**
   * Convenience method for logging with minimal data
   */
  async logAction(
    userId: string,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId?: string,
    description?: string,
    changes?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return await this.log({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      changes,
    });
  }

  /**
   * Log a login event.
   *
   * `clubId` is required because login is a public route: it runs before any
   * tenant context exists, and `audit_logs.club_id` is NOT NULL. The caller
   * takes it from the freshly resolved user.
   */
  async logLogin(
    userId: string,
    userEmail: string,
    clubId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return await this.log({
      club_id: clubId,
      user_id: userId,
      user_email: userEmail,
      action: AuditAction.LOGIN,
      entity_type: AuditEntityType.USER,
      entity_id: userId,
      description: `User ${userEmail} logged in`,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  /**
   * Log a logout event. See `logLogin` for why `clubId` is explicit.
   */
  async logLogout(userId: string, userEmail: string, clubId: string): Promise<AuditLog> {
    return await this.log({
      club_id: clubId,
      user_id: userId,
      user_email: userEmail,
      action: AuditAction.LOGOUT,
      entity_type: AuditEntityType.USER,
      entity_id: userId,
      description: `User ${userEmail} logged out`,
    });
  }

  /**
   * Log a completed signup: a new club and its first admin.
   *
   * This is the single most important activation event to capture, since it is
   * the head of the funnel every later metric is measured against.
   */
  async logClubSignup(
    userId: string,
    userEmail: string,
    clubId: string,
    clubName: string,
  ): Promise<AuditLog> {
    return await this.log({
      club_id: clubId,
      user_id: userId,
      user_email: userEmail,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.CLUB,
      entity_id: clubId,
      description: `Club ${clubName} registered by ${userEmail}`,
      metadata: { club_name: clubName },
    });
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findAll(limit, offset);
  }

  async findOne(id: string): Promise<AuditLog | null> {
    return await this.auditLogsRepository.findOne(id);
  }

  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findByUser(userId, limit);
  }

  async findByEntity(
    entityType: AuditEntityType,
    entityId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findByEntity(entityType, entityId, limit);
  }

  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findByAction(action, limit);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findByDateRange(startDate, endDate);
  }

  async findRecent(hours: number = 24): Promise<AuditLog[]> {
    return await this.auditLogsRepository.findRecent(hours);
  }

  async getStatistics(): Promise<{
    total: number;
    byAction: Record<AuditAction, number>;
    byEntityType: Record<AuditEntityType, number>;
  }> {
    const total = await this.auditLogsRepository.count();

    const byAction = {} as Record<AuditAction, number>;
    for (const action of Object.values(AuditAction)) {
      byAction[action] = await this.auditLogsRepository.countByAction(action);
    }

    const byEntityType = {} as Record<AuditEntityType, number>;
    for (const entityType of Object.values(AuditEntityType)) {
      byEntityType[entityType] = await this.auditLogsRepository.countByEntityType(entityType);
    }

    return { total, byAction, byEntityType };
  }

  /**
   * Scheduled job to clean up old audit logs
   * Runs weekly on Sunday at 4:00 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldLogs(): Promise<void> {
    this.logger.log(
      `Running scheduled audit log cleanup (retention: ${this.RETENTION_DAYS} days)...`,
    );

    try {
      const deletedCount = await this.auditLogsRepository.deleteOlderThan(this.RETENTION_DAYS);
      this.logger.log(
        `Cleaned up ${deletedCount} audit logs older than ${this.RETENTION_DAYS} days`,
      );
    } catch (error) {
      this.logger.error('Error cleaning up audit logs:', error);
    }
  }
}
