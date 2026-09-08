import { Member } from '../members/entities/member.entity';
import { Family } from '../families/entities/family.entity';
import { Squad } from '../squads/entities/squad.entity';
import { Session } from '../sessions/entities/session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { SessionRosterEntry } from '../attendance/attendance.service';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { DirectDebitMandate } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { AwardScheme } from '../awards/entities/award-scheme.entity';
import { AwardLevel } from '../awards/entities/award-level.entity';
import { MemberAwardProgress } from '../awards/entities/member-award-progress.entity';
import {
  ApiAttendanceDto,
  ApiAwardLevelDto,
  ApiAwardProgressDto,
  ApiAwardSchemeDto,
  ApiFamilyDto,
  ApiInvoiceDto,
  ApiMandateDto,
  ApiMemberDto,
  ApiSessionDto,
  ApiSquadDto,
} from './dto/read-api.dto';

/**
 * Entity to published-shape mapping for the club read API (TEM-32).
 *
 * Every field that leaves the building passes through here, which is the
 * point: the contract a club builds against is visible in one file rather
 * than implied by whatever columns an entity happens to carry. Fields held
 * back deliberately (medical notes, emergency contacts) are documented on the
 * DTOs, and it is a one-line diff here to see if that ever changes.
 *
 * The conversions exist because pg is honest about SQL types: a `date` column
 * arrives as a string, a `timestamp` as a Date, and a `decimal` as a string
 * so precision is not silently lost. The API normalises all three.
 */

/** ISO date-time string, from either a Date or an already-serialised value. */
function isoDateTime(value: Date | string): string {
  return new Date(value).toISOString();
}

/** ISO date-time, or null. */
function isoDateTimeOrNull(value: Date | string | null | undefined): string | null {
  return value ? isoDateTime(value) : null;
}

/**
 * Calendar date as YYYY-MM-DD. A `date` column already arrives in that form,
 * so it is returned untouched; anything else is normalised through the
 * date-time form and truncated, which avoids a timezone shifting the day.
 */
function isoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/** Calendar date, or null. */
function isoDateOrNull(value: Date | string | null | undefined): string | null {
  return value ? isoDate(value) : null;
}

/**
 * Decimal columns arrive as strings. Parsed here so the published contract is
 * a JSON number, with a 0 fallback rather than a NaN for an unreadable value.
 */
function decimal(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toApiMember(member: Member): ApiMemberDto {
  return {
    member_id: member.member_id,
    family_id: member.family_id ?? null,
    first_name: member.first_name,
    last_name: member.last_name,
    dob: isoDate(member.dob),
    gender: member.gender,
    squad_id: member.squad_id ?? null,
    discipline: member.discipline ?? null,
    registration_number: member.registration_number ?? null,
    created_at: isoDateTime(member.created_at),
    updated_at: isoDateTime(member.updated_at),
  };
}

export function toApiFamily(family: Family): ApiFamilyDto {
  return {
    family_id: family.family_id,
    family_name: family.family_name,
    primary_contact_name: family.primary_contact_name,
    primary_contact_email: family.primary_contact_email,
    primary_contact_phone: family.primary_contact_phone ?? null,
    city: family.city ?? null,
    postcode: family.postcode ?? null,
    created_at: isoDateTime(family.created_at),
    updated_at: isoDateTime(family.updated_at),
  };
}

export function toApiSquad(squad: Squad & { member_count?: number }): ApiSquadDto {
  return {
    squad_id: squad.squad_id,
    squad_name: squad.squad_name,
    description: squad.description ?? null,
    min_age: squad.min_age ?? null,
    max_age: squad.max_age ?? null,
    coach_name: squad.coach_name ?? null,
    training_times: squad.training_times ?? null,
    max_capacity: squad.max_capacity ?? null,
    squad_type: squad.squad_type ?? null,
    level: squad.level ?? null,
    discipline: squad.discipline ?? null,
    ...(typeof squad.member_count === 'number' ? { member_count: squad.member_count } : {}),
  };
}

export function toApiSession(session: Session): ApiSessionDto {
  return {
    session_id: session.session_id,
    squad_id: session.squad_id ?? null,
    session_name: session.session_name,
    session_date: isoDate(session.session_date),
    start_time: session.start_time,
    end_time: session.end_time,
    location: session.location ?? null,
    coach_name: session.coach_name ?? null,
    max_participants: session.max_participants ?? null,
    status: session.status,
  };
}

export function toApiAttendance(attendance: Attendance): ApiAttendanceDto {
  return {
    attendance_id: attendance.attendance_id,
    session_id: attendance.session_id,
    member_id: attendance.member_id,
    status: attendance.status,
    checked_in_at: isoDateTimeOrNull(attendance.checked_in_at),
    created_at: isoDateTime(attendance.created_at),
  };
}

/**
 * Maps one entry of a session roster.
 *
 * A roster deliberately includes gymnasts who were never marked, so the
 * register can show them; those carry a null attendance_id and are not
 * attendance records. This returns null for them and the caller drops them,
 * so the API only ever publishes rows that actually exist in the table.
 */
export function toApiAttendanceFromRoster(entry: SessionRosterEntry): ApiAttendanceDto | null {
  // A real row always has all three. Checking them together rather than
  // trusting attendance_id alone keeps the published shape free of nulls in
  // fields the contract declares as always present.
  if (!entry.attendance_id || !entry.status || !entry.created_at) {
    return null;
  }

  return {
    attendance_id: entry.attendance_id,
    session_id: entry.session_id,
    member_id: entry.member_id,
    status: entry.status,
    checked_in_at: isoDateTimeOrNull(entry.checked_in_at),
    created_at: isoDateTime(entry.created_at),
  };
}

export function toApiInvoice(invoice: Invoice): ApiInvoiceDto {
  return {
    invoice_id: invoice.invoice_id,
    family_id: invoice.family_id,
    invoice_number: invoice.invoice_number,
    subtotal: decimal(invoice.subtotal),
    tax_amount: decimal(invoice.tax_amount),
    total_amount: decimal(invoice.total_amount),
    currency: invoice.currency,
    issued_date: isoDate(invoice.issued_date),
    due_date: isoDate(invoice.due_date),
    status: invoice.status,
    billing_period: invoice.billing_period ?? null,
    created_at: isoDateTime(invoice.created_at),
  };
}

/**
 * Mandate shape. Note what is absent: provider_mandate_id and
 * provider_customer_id are the club's identifiers inside GoCardless, and
 * handing them to every integration a club wires up widens the blast radius
 * of a leaked read key for no read-API benefit. Status and scheme are what a
 * reconciliation script actually needs.
 */
export function toApiMandate(mandate: DirectDebitMandate): ApiMandateDto {
  return {
    mandate_id: mandate.mandate_id,
    family_id: mandate.family_id,
    provider: mandate.provider,
    scheme: mandate.scheme,
    status: mandate.status,
    created_at: isoDateTime(mandate.created_at),
    updated_at: isoDateTime(mandate.updated_at),
  };
}

export function toApiAwardLevel(level: AwardLevel): ApiAwardLevelDto {
  return {
    level_id: level.level_id,
    name: level.name,
    description: level.description ?? null,
    sort_order: level.sort_order,
    active: level.active,
  };
}

export function toApiAwardScheme(
  scheme: AwardScheme & { levels?: AwardLevel[] },
): ApiAwardSchemeDto {
  return {
    scheme_id: scheme.scheme_id,
    name: scheme.name,
    description: scheme.description ?? null,
    source: scheme.source,
    active: scheme.active,
    levels: (scheme.levels ?? []).map(toApiAwardLevel),
  };
}

export function toApiAwardProgress(progress: MemberAwardProgress): ApiAwardProgressDto {
  return {
    progress_id: progress.progress_id,
    member_id: progress.member_id,
    level_id: progress.level_id,
    status: progress.status,
    started_on: isoDateOrNull(progress.started_on),
    assessed_on: isoDateOrNull(progress.assessed_on),
    awarded_on: isoDateOrNull(progress.awarded_on),
  };
}
