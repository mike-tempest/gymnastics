import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
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
