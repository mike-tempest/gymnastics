import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Discipline, SquadType, WaitingListStatus } from '@club-manager/shared-types';

/**
 * What a parent fills in on the club's public join page. Deliberately short:
 * the child, the parent, and roughly what they are after. Everything else is
 * asked for at enrolment, when the family actually exists.
 *
 * Priority flags are absent on purpose. A club decides who jumps the queue,
 * not the person joining it.
 */
export class JoinWaitingListDto {
  @IsString()
  @MaxLength(100)
  child_first_name: string;

  @IsString()
  @MaxLength(100)
  child_last_name: string;

  @IsDateString()
  child_dob: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  child_gender?: string;

  @IsString()
  @MaxLength(200)
  parent_name: string;

  @IsEmail()
  @MaxLength(255)
  parent_email: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  parent_phone?: string;

  @IsEnum(Discipline)
  @IsOptional()
  desired_discipline?: Discipline;

  @IsEnum(SquadType)
  @IsOptional()
  desired_squad_type?: SquadType;

  @IsUUID()
  @IsOptional()
  preferred_squad_id?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

/**
 * Adding an entry from the admin side, which is the same information plus the
 * priority flags a club is entitled to set.
 */
export class CreateWaitingListEntryDto extends JoinWaitingListDto {
  @IsBoolean()
  @IsOptional()
  is_existing_member_family?: boolean;

  @IsBoolean()
  @IsOptional()
  is_sibling?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority_boost?: number;
}

/** Editing an entry. Status changes go through their own endpoints. */
export class UpdateWaitingListEntryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  child_first_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  child_last_name?: string;

  @IsDateString()
  @IsOptional()
  child_dob?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  child_gender?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  parent_name?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  parent_email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  parent_phone?: string;

  @IsEnum(Discipline)
  @IsOptional()
  desired_discipline?: Discipline | null;

  @IsEnum(SquadType)
  @IsOptional()
  desired_squad_type?: SquadType | null;

  @IsUUID()
  @IsOptional()
  preferred_squad_id?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  is_existing_member_family?: boolean;

  @IsBoolean()
  @IsOptional()
  is_sibling?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority_boost?: number;
}

/** Narrowing applied to the admin listing. */
export class ListWaitingListQueryDto {
  @IsEnum(WaitingListStatus)
  @IsOptional()
  status?: WaitingListStatus;

  @IsEnum(Discipline)
  @IsOptional()
  discipline?: Discipline;

  @IsEnum(SquadType)
  @IsOptional()
  squad_type?: SquadType;
}

export class WithdrawWaitingListEntryDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
