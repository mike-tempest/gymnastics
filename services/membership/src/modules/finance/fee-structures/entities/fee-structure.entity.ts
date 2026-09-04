import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FeeFrequency {
  MONTHLY = 'monthly',
  TERM = 'term',
  ANNUAL = 'annual',
  ONE_TIME = 'one_time',
}

export enum AppliesToType {
  CLUB = 'club',
  SQUAD = 'squad',
  SWIMMER = 'swimmer',
}

@Entity('fee_structures')
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  fee_structure_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /**
   * ISO 4217 currency the fee amount is denominated in. Stamped from the owning
   * club on creation. Defaults to GBP for existing rows.
   */
  @Column({ type: 'varchar', length: 3, default: 'GBP' })
  currency: string;

  /**
   * Stored as varchar rather than a Postgres enum so new frequencies (such as
   * 'term') can be added without ALTER TYPE, which cannot run inside the
   * transaction TypeORM wraps migrations in. The FeeFrequency enum is still
   * enforced at the TypeScript/DTO layer via class-validator's IsEnum.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: FeeFrequency.MONTHLY,
  })
  frequency: FeeFrequency;

  @Column({
    type: 'enum',
    enum: AppliesToType,
    default: AppliesToType.CLUB,
  })
  applies_to_type: AppliesToType;

  @Column({ type: 'uuid', nullable: true })
  applies_to_id: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
