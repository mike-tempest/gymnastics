import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Discipline, ProgrammeFlag, SquadType } from '@club-manager/shared-types';
import { Member } from '../../members/entities/member.entity';

@Entity('squads')
export class Squad {
  @PrimaryGeneratedColumn('uuid')
  squad_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 100 })
  squad_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  min_age: number | null;

  @Column({ type: 'int', nullable: true })
  max_age: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  coach_name: string | null;

  @Column({ type: 'text', nullable: true })
  training_times: string | null;

  @Column({ type: 'int', nullable: true })
  max_capacity: number | null;

  // Recreational badge class or competitive squad. Both kinds live in this one
  // table; the value only ever drives filtering and reporting.
  @Column({ type: 'varchar', length: 20, nullable: true })
  squad_type: SquadType | null;

  // Free-form recreational level label, e.g. "Rise Explore" or a club's own
  // badge level. Deliberately not an enum: award schemes are data, and clubs
  // that run their own scheme must be able to type their own level names.
  @Column({ type: 'varchar', length: 100, nullable: true })
  level: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  discipline: Discipline | null;

  // Participation programmes this squad serves. A pre-school class can also be
  // a parkour class, so this is a list rather than a single value.
  @Column({ type: 'jsonb', nullable: true })
  programme_flags: ProgrammeFlag[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToMany(() => Member, { eager: false })
  @JoinTable({
    name: 'squad_members',
    joinColumn: {
      name: 'squad_id',
      referencedColumnName: 'squad_id',
    },
    inverseJoinColumn: {
      name: 'member_id',
      referencedColumnName: 'member_id',
    },
  })
  members: Member[];
}
