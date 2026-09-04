import { IsUUID, IsEnum, IsString, IsOptional, IsObject, IsIP } from 'class-validator';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';

export class CreateAuditLogDto {
  /**
   * The club the audited action belongs to.
   *
   * Optional because request-path callers can leave it to the repository, which
   * falls back to the active tenant context. It must be supplied explicitly on
   * non-request paths (login, background jobs) where no tenant context exists,
   * since `audit_logs.club_id` is NOT NULL.
   */
  @IsUUID()
  @IsOptional()
  club_id?: string;

  @IsUUID()
  user_id: string;

  @IsString()
  @IsOptional()
  user_email?: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsEnum(AuditEntityType)
  entity_type: AuditEntityType;

  @IsUUID()
  @IsOptional()
  entity_id?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  changes?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsIP()
  @IsOptional()
  ip_address?: string;

  @IsString()
  @IsOptional()
  user_agent?: string;
}
