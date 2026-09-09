import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The published shapes of the club read API (TEM-32).
 *
 * These are deliberately their own classes rather than the TypeORM entities.
 * A club builds against this contract, so it should not shift the next time
 * an internal column is added, renamed or given a relation. Mapping through
 * an explicit shape also makes it obvious, in one place, exactly what leaves
 * the building.
 *
 * Two categories of field are held back on purpose:
 *
 *  - **Special-category health data.** A member's medical notes are excluded.
 *    A read key is a long-lived machine credential that a club may paste into
 *    a spreadsheet tool or a third party's integration; health data should
 *    move deliberately, through the full export, not incidentally through
 *    every integration a club ever wires up.
 *  - **Third-party contact details.** Emergency contacts belong to people who
 *    are not the club's members and who never agreed to be in an integration.
 *
 * Everything held back is still available through the club's full export.
 */

export class ApiMemberDto {
  @ApiProperty({ format: 'uuid' })
  member_id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  family_id: string | null;

  @ApiProperty({ example: 'Amelia' })
  first_name: string;

  @ApiProperty({ example: 'Okafor' })
  last_name: string;

  @ApiProperty({ format: 'date', example: '2014-03-19' })
  dob: string;

  @ApiProperty({ example: 'female' })
  gender: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  squad_id: string | null;

  @ApiProperty({
    nullable: true,
    example: 'womens_artistic',
    description: 'British Gymnastics discipline, where one is recorded.',
  })
  discipline: string | null;

  @ApiProperty({
    nullable: true,
    description: 'BG membership number, where one is recorded.',
  })
  registration_number: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at: string;

  @ApiProperty({ format: 'date-time' })
  updated_at: string;
}

export class ApiFamilyDto {
  @ApiProperty({ format: 'uuid' })
  family_id: string;

  @ApiProperty({ example: 'Okafor' })
  family_name: string;

  @ApiProperty()
  primary_contact_name: string;

  @ApiProperty({ format: 'email' })
  primary_contact_email: string;

  @ApiProperty({ nullable: true })
  primary_contact_phone: string | null;

  @ApiProperty({ nullable: true })
  city: string | null;

  @ApiProperty({ nullable: true })
  postcode: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at: string;

  @ApiProperty({ format: 'date-time' })
  updated_at: string;
}

export class ApiSquadDto {
  @ApiProperty({ format: 'uuid' })
  squad_id: string;

  @ApiProperty({ example: 'Development WAG' })
  squad_name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true, type: Number })
  min_age: number | null;

  @ApiProperty({ nullable: true, type: Number })
  max_age: number | null;

  @ApiProperty({ nullable: true })
  coach_name: string | null;

  @ApiProperty({ nullable: true })
  training_times: string | null;

  @ApiProperty({ nullable: true, type: Number })
  max_capacity: number | null;

  @ApiProperty({ nullable: true })
  squad_type: string | null;

  @ApiProperty({ nullable: true })
  level: string | null;

  @ApiProperty({ nullable: true })
  discipline: string | null;

  @ApiPropertyOptional({
    type: Number,
    description: 'Members currently assigned, when the service reports it.',
  })
  member_count?: number;
}

export class ApiSessionDto {
  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  squad_id: string | null;

  @ApiProperty({ example: 'Tuesday development' })
  session_name: string;

  @ApiProperty({ format: 'date', example: '2026-09-15' })
  session_date: string;

  @ApiProperty({ example: '17:30:00' })
  start_time: string;

  @ApiProperty({ example: '19:00:00' })
  end_time: string;

  @ApiProperty({ nullable: true })
  location: string | null;

  @ApiProperty({ nullable: true })
  coach_name: string | null;

  @ApiProperty({ nullable: true, type: Number })
  max_participants: number | null;

  @ApiProperty({ example: 'scheduled' })
  status: string;
}

export class ApiAttendanceDto {
  @ApiProperty({ format: 'uuid' })
  attendance_id: string;

  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'uuid' })
  member_id: string;

  @ApiProperty({ example: 'present' })
  status: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  checked_in_at: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at: string;
}

export class ApiInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  invoice_id: string;

  @ApiProperty({ format: 'uuid' })
  family_id: string;

  @ApiProperty({ example: 'INV-2026-0184' })
  invoice_number: string;

  @ApiProperty({
    type: Number,
    description: 'Decimal columns are returned as numbers, to two places.',
  })
  subtotal: number;

  @ApiProperty({ type: Number })
  tax_amount: number;

  @ApiProperty({ type: Number })
  total_amount: number;

  @ApiProperty({ example: 'GBP' })
  currency: string;

  @ApiProperty({ format: 'date' })
  issued_date: string;

  @ApiProperty({ format: 'date' })
  due_date: string;

  @ApiProperty({ example: 'sent' })
  status: string;

  @ApiProperty({ nullable: true, example: '2026-09' })
  billing_period: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at: string;
}

export class ApiMandateDto {
  @ApiProperty({ format: 'uuid' })
  mandate_id: string;

  @ApiProperty({ format: 'uuid' })
  family_id: string;

  @ApiProperty({ example: 'gocardless' })
  provider: string;

  @ApiProperty({ example: 'bacs' })
  scheme: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ format: 'date-time' })
  created_at: string;

  @ApiProperty({ format: 'date-time' })
  updated_at: string;
}

export class ApiAwardLevelDto {
  @ApiProperty({ format: 'uuid' })
  level_id: string;

  @ApiProperty({ example: 'Discover 3' })
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: Number })
  sort_order: number;

  @ApiProperty()
  active: boolean;
}

export class ApiAwardSchemeDto {
  @ApiProperty({ format: 'uuid' })
  scheme_id: string;

  @ApiProperty({ example: 'BG Rise' })
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({
    example: 'bg-rise',
    description: 'Where the scheme came from: bg-rise, legacy-proficiency or custom.',
  })
  source: string;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ type: [ApiAwardLevelDto] })
  levels: ApiAwardLevelDto[];
}

export class ApiAwardProgressDto {
  @ApiProperty({ format: 'uuid' })
  progress_id: string;

  @ApiProperty({ format: 'uuid' })
  member_id: string;

  @ApiProperty({ format: 'uuid' })
  level_id: string;

  @ApiProperty({ example: 'awarded' })
  status: string;

  @ApiProperty({ format: 'date', nullable: true })
  started_on: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  assessed_on: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  awarded_on: string | null;
}
