import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  PRINT = 'PRINT',
}

export enum AuditEntityType {
  USER = 'USER',
  SWIMMER = 'SWIMMER',
  FAMILY = 'FAMILY',
  SQUAD = 'SQUAD',
  SESSION = 'SESSION',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  DBS_CHECK = 'DBS_CHECK',
  CONSENT = 'CONSENT',
  MESSAGE = 'MESSAGE',
  DOCUMENT = 'DOCUMENT',
  // Added by ExtendAuditEntityTypes1744202900000 so every audited route maps to
  // an honest entity type rather than a loosely related one.
  ATTENDANCE = 'ATTENDANCE',
  CLUB = 'CLUB',
  COMPETITION = 'COMPETITION',
  WAITLIST = 'WAITLIST',
  WELLBEING = 'WELLBEING',
  SETTINGS = 'SETTINGS',
  FEE_STRUCTURE = 'FEE_STRUCTURE',
  MANDATE = 'MANDATE',
  REPORT = 'REPORT',
}

@Entity('audit_logs')
@Index(['entity_type', 'entity_id'])
@Index(['user_id', 'created_at'])
@Index(['action', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  audit_log_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  user_id: string; // Who performed the action

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_email: string; // Cached for easier querying

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditEntityType,
  })
  entity_type: AuditEntityType;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string; // ID of the affected entity

  @Column({ type: 'text', nullable: true })
  description: string; // Human-readable description

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @CreateDateColumn()
  created_at: Date;
}
