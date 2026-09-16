import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EditOccurrenceDto, SeriesDefinitionDto, TimetableDto } from './dto/timetable.dto';
import { localInstant, validDate, weeklyDates } from './timetable-calendar';
import { Session, SessionStatus } from './entities/session.entity';
import { UpdateSessionDto } from './dto/update-session.dto';

export interface Term {
  term_id: string;
  name: string;
  start_date: string;
  end_date: string;
  timezone: string;
}
export interface Series {
  series_id: string;
  definition: SeriesDefinitionDto;
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContextService,
  ) {}

  protected now(): Date {
    return new Date();
  }

  private hash(value: unknown): string {
    const canonical = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(canonical);
      if (input && typeof input === 'object')
        return Object.fromEntries(
          Object.entries(input)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        );
      return input;
    };
    return createHash('sha256')
      .update(JSON.stringify(canonical(value)))
      .digest('hex');
  }

  private async term(manager: EntityManager, id: string): Promise<Term> {
    const [term] = await manager.query(
      `SELECT term_id, name, start_date::text, end_date::text, timezone FROM timetable_terms WHERE term_id=$1 AND club_id=$2`,
      [id, this.tenant.getClubId()],
    );
    if (!term) throw new NotFoundException('Term not found');
    return term;
  }

  private async definitions(manager: EntityManager, id: string): Promise<Series[]> {
    return manager.query(
      'SELECT series_id, definition FROM session_series WHERE term_id=$1 AND club_id=$2 ORDER BY series_id',
      [id, this.tenant.getClubId()],
    );
  }

  async list() {
    const terms: Term[] = await this.db.query(
      `SELECT term_id, name, start_date::text, end_date::text, timezone FROM timetable_terms WHERE club_id=$1 ORDER BY start_date DESC`,
      [this.tenant.getClubId()],
    );
    return Promise.all(
      terms.map(async (term) => ({
        ...term,
        series: await this.definitions(this.db.manager, term.term_id),
      })),
    );
  }

  private async capacity(manager: EntityManager, definition: SeriesDefinitionDto) {
    const [squad] = await manager.query(
      `SELECT squad_id, squad_name, max_capacity FROM squads WHERE squad_id=$1 AND club_id=$2`,
      [definition.squad_id, this.tenant.getClubId()],
    );
    if (!squad) throw new NotFoundException('Squad not found');
    const members: { member_id: string }[] = await manager.query(
      `SELECT m.member_id FROM members m WHERE m.squad_id=$1 AND m.club_id=$2 ORDER BY m.member_id`,
      [definition.squad_id, this.tenant.getClubId()],
    );
    const limits = [squad.max_capacity, definition.max_participants].filter(
      (value): value is number => value != null,
    );
    const limit = limits.length ? Math.min(...limits) : null;
    return {
      squad_name: squad.squad_name as string,
      member_ids: members.map((m) => m.member_id),
      occupied: members.length,
      capacity: limit,
      places: limit === null ? null : limit - members.length,
    };
  }

  private validateDefinition(
    definition: SeriesDefinitionDto,
    start: string,
    end: string,
    timezone: string,
    validateTimes = true,
  ) {
    if (!definition.session_name?.trim() || definition.start_time >= definition.end_time)
      throw new BadRequestException('Enter a session name and an end time after the start');
    const dates = weeklyDates(start, end, definition.weekday);
    for (const excluded of definition.excluded_dates) {
      validDate(excluded);
      if (excluded < start || excluded > end)
        throw new BadRequestException('Exception dates must be within the term');
    }
    for (const date of dates.filter(
      (d) => validateTimes && !definition.excluded_dates.includes(d),
    )) {
      localInstant(date, definition.start_time, timezone);
      localInstant(date, definition.end_time, timezone);
    }
    return dates;
  }

  private async prepare(manager: EntityManager, dto: TimetableDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Enter a term name');
    weeklyDates(dto.start_date, dto.end_date, 0);
    const [club] = await manager.query('SELECT timezone FROM clubs WHERE id=$1', [
      this.tenant.getClubId(),
    ]);
    if (!club) throw new NotFoundException('Club not found');
    let source: Term | null = null;
    let definitions = dto.series;
    if (dto.source_term_id) {
      source = await this.term(manager, dto.source_term_id);
      if (dto.start_date <= source.end_date)
        throw new BadRequestException('The new term must start after the source term ends');
      const sourceSeries = await this.definitions(manager, source.term_id);
      // Holidays are dates in the new term, never silently copied from the old calendar.
      if (
        dto.series.length !== sourceSeries.length ||
        sourceSeries.some((s, i) => {
          const { excluded_dates: _oldDates, ...oldDefinition } = s.definition;
          const { excluded_dates: _newDates, ...newDefinition } = dto.series[i];
          return this.hash(oldDefinition) !== this.hash(newDefinition);
        })
      )
        throw new ConflictException('The source timetable changed. Reload it before rolling over.');
      definitions = sourceSeries.map((s, i) => ({
        ...s.definition,
        excluded_dates: dto.series[i].excluded_dates,
      }));
    }
    if (!definitions.length) throw new BadRequestException('Add at least one weekly session');
    const rows = [];
    for (const definition of definitions) {
      const dates = this.validateDefinition(
        definition,
        dto.start_date,
        dto.end_date,
        club.timezone,
      );
      const capacity = await this.capacity(manager, definition);
      const scheduled = dates.filter((date) => !definition.excluded_dates.includes(date));
      if (!scheduled.length)
        throw new BadRequestException('Each series needs at least one scheduled date');
      if (
        scheduled.some(
          (date) => localInstant(date, definition.start_time, club.timezone) <= this.now(),
        )
      )
        throw new BadRequestException('New timetable sessions must start in the future');
      rows.push({ definition, dates, scheduled, ...capacity });
    }
    const snapshot = {
      name: dto.name,
      start_date: dto.start_date,
      end_date: dto.end_date,
      timezone: club.timezone as string,
      source,
      rows,
    };
    return {
      ...snapshot,
      preview_token: this.hash(snapshot),
      can_commit: rows.every((row) => row.places === null || row.places >= 0),
    };
  }

  async preview(dto: TimetableDto) {
    return this.db.transaction('REPEATABLE READ', (manager) => this.prepare(manager, dto));
  }

  /** A short transaction serialises timetable commits and freezes roster/attendance snapshots. */
  private async lock(manager: EntityManager) {
    await manager.query(
      'LOCK TABLE timetable_operations, timetable_terms, session_series IN SHARE ROW EXCLUSIVE MODE',
    );
    await manager.query('LOCK TABLE squads, members IN SHARE MODE');
    await manager.query('LOCK TABLE attendance IN SHARE MODE');
    await manager.query('LOCK TABLE sessions IN SHARE ROW EXCLUSIVE MODE');
  }

  async commit(dto: TimetableDto) {
    if (!dto.operation_id || !dto.preview_token)
      throw new BadRequestException('Preview the timetable before saving');
    const { operation_id, preview_token: _token, ...request } = dto;
    const requestHash = this.hash(request);
    return this.db.transaction(async (manager) => {
      await this.lock(manager);
      const clubId = this.tenant.getClubId();
      const [previous] = await manager.query(
        'SELECT request_hash, result FROM timetable_operations WHERE club_id=$1 AND operation_id=$2',
        [clubId, operation_id],
      );
      if (previous) {
        if (previous.request_hash !== requestHash)
          throw new ConflictException('This save reference belongs to a different timetable');
        return previous.result;
      }
      // A new operation reference for the same rollover is still a safe retry.
      if (dto.source_term_id) {
        await this.term(manager, dto.source_term_id);
        const [existing] = await manager.query(
          'SELECT term_id FROM timetable_terms WHERE club_id=$1 AND source_term_id=$2 AND start_date=$3 AND end_date=$4',
          [clubId, dto.source_term_id, dto.start_date, dto.end_date],
        );
        if (existing) return { term_id: existing.term_id, already_created: true };
      }
      const preview = await this.prepare(manager, dto);
      if (preview.preview_token !== dto.preview_token)
        throw new ConflictException(
          'The timetable or current places changed. Preview again before saving.',
        );
      if (!preview.can_commit)
        throw new ConflictException('Resolve the capacity shortfall before saving');
      const [term] = await manager.query(
        `INSERT INTO timetable_terms(club_id,name,start_date,end_date,timezone,source_term_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING term_id`,
        [
          clubId,
          dto.name,
          dto.start_date,
          dto.end_date,
          preview.timezone,
          dto.source_term_id ?? null,
        ],
      );
      for (const row of preview.rows) {
        const [series] = await manager.query(
          'INSERT INTO session_series(club_id,term_id,definition) VALUES ($1,$2,$3) RETURNING series_id',
          [clubId, term.term_id, JSON.stringify(row.definition)],
        );
        for (const date of row.dates) {
          await manager.getRepository(Session).save(
            manager.getRepository(Session).create({
              ...this.fields(row.definition),
              club_id: clubId,
              series_id: series.series_id,
              occurrence_date: date,
              session_date: date as unknown as Date,
              status: row.definition.excluded_dates.includes(date)
                ? SessionStatus.CANCELLED
                : SessionStatus.SCHEDULED,
              cancellation_reason: row.definition.excluded_dates.includes(date)
                ? 'Holiday or club closure'
                : null,
            }),
          );
        }
      }
      const result = {
        term_id: term.term_id,
        session_count: preview.rows.reduce((count, row) => count + row.dates.length, 0),
      };
      await manager.query(
        'INSERT INTO timetable_operations(club_id,operation_id,request_hash,result) VALUES ($1,$2,$3,$4)',
        [clubId, operation_id, requestHash, JSON.stringify(result)],
      );
      return result;
    });
  }

  private fields(definition: SeriesDefinitionDto) {
    return {
      squad_id: definition.squad_id,
      session_name: definition.session_name,
      start_time: definition.start_time,
      end_time: definition.end_time,
      location: definition.location ?? null,
      description: definition.description ?? null,
      coach_name: definition.coach_name ?? null,
      max_participants: definition.max_participants ?? null,
    };
  }

  private async occurrence(manager: EntityManager, id: string) {
    const session = await manager
      .getRepository(Session)
      .findOneBy({ session_id: id, club_id: this.tenant.getClubId() });
    if (!session?.series_id) throw new NotFoundException('Recurring session not found');
    const [series] = await manager.query(
      'SELECT series_id, term_id, definition FROM session_series WHERE series_id=$1 AND club_id=$2',
      [session.series_id, this.tenant.getClubId()],
    );
    const term = await this.term(manager, series.term_id);
    return { session, series: series as Series, term };
  }

  private async protected(
    manager: EntityManager,
    session: Session,
    timezone: string,
  ): Promise<boolean> {
    const date = String(session.session_date).slice(0, 10);
    const [attendance] = await manager.query(
      'SELECT 1 FROM attendance WHERE session_id=$1 LIMIT 1',
      [session.session_id],
    );
    if (attendance || [SessionStatus.IN_PROGRESS, SessionStatus.COMPLETED].includes(session.status))
      return true;
    // Excluded DST gaps have no instant. Their local date still becomes history.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.now());
    if (date < today) return true;
    if (session.status === SessionStatus.CANCELLED && date > today) return false;
    try {
      return localInstant(date, session.start_time.slice(0, 5), timezone) <= this.now();
    } catch {
      return date <= today;
    }
  }

  async edit(id: string, dto: EditOccurrenceDto) {
    return this.db.transaction(async (manager) => {
      await this.lock(manager);
      const { session, series, term } = await this.occurrence(manager, id);
      if (dto.definition.squad_id !== session.squad_id)
        throw new BadRequestException(
          'A series keeps its squad. Create a new series for a different squad.',
        );
      if (dto.definition.weekday !== series.definition.weekday)
        throw new BadRequestException(
          'Use edit one to move an individual date, or create a new weekly slot',
        );
      if (dto.scope === 'future' && dto.session_date)
        throw new BadRequestException('A date move applies to one session only');
      this.validateDefinition(dto.definition, term.start_date, term.end_date, term.timezone, false);
      const capacity = await this.capacity(manager, dto.definition);
      if (capacity.places !== null && capacity.places < 0)
        throw new ConflictException('The current squad exceeds this capacity');
      const candidates =
        dto.scope === 'one'
          ? [session]
          : await manager
              .getRepository(Session)
              .createQueryBuilder('s')
              .where('s.club_id=:club AND s.series_id=:series AND s.occurrence_date>=:date', {
                club: this.tenant.getClubId(),
                series: session.series_id,
                date: session.occurrence_date,
              })
              .orderBy('s.occurrence_date', 'ASC')
              .getMany();
      const skipped: { session_id: string; date: string; reason: string }[] = [];
      let updated = 0;
      for (const candidate of candidates) {
        const isProtected = await this.protected(manager, candidate, term.timezone);
        if (isProtected || (dto.scope === 'future' && candidate.is_override)) {
          skipped.push({
            session_id: candidate.session_id,
            date: String(candidate.session_date).slice(0, 10),
            reason: isProtected ? 'History or attendance recorded' : 'Individual override',
          });
          continue;
        }
        const date = dto.session_date ?? String(candidate.session_date).slice(0, 10);
        validDate(date);
        if (date < term.start_date || date > term.end_date)
          throw new BadRequestException('The new date must be within the term');
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: term.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(this.now());
        if (date < today) throw new BadRequestException('The new date must be in the future');
        const cancelled = dto.definition.excluded_dates.includes(date);
        if (
          !cancelled &&
          localInstant(date, dto.definition.start_time, term.timezone) <= this.now()
        )
          throw new BadRequestException('The new start must be in the future');
        if (!cancelled) localInstant(date, dto.definition.end_time, term.timezone);
        await manager.getRepository(Session).update(
          { session_id: candidate.session_id, club_id: this.tenant.getClubId() },
          {
            ...this.fields(dto.definition),
            session_date: date as unknown as Date,
            status: cancelled ? SessionStatus.CANCELLED : SessionStatus.SCHEDULED,
            cancellation_reason: cancelled ? 'Holiday or club closure' : null,
            is_override: dto.scope === 'one',
          },
        );
        updated++;
      }
      if (dto.scope === 'one' && !updated)
        throw new ConflictException(
          'This session has started or has attendance recorded and cannot be rescheduled',
        );
      if (dto.scope === 'future' && updated)
        await manager.query(
          'UPDATE session_series SET definition=$1 WHERE series_id=$2 AND club_id=$3',
          [JSON.stringify(dto.definition), series.series_id, this.tenant.getClubId()],
        );
      return { updated, skipped };
    });
  }

  /** Existing session forms edit a recurring occurrence, never the entire series. */
  async editOne(id: string, patch: UpdateSessionDto) {
    const { session, series } = await this.occurrence(this.db.manager, id);
    if (patch.status && ![SessionStatus.SCHEDULED, SessionStatus.CANCELLED].includes(patch.status))
      throw new BadRequestException('Use the register to change attendance status');
    const date = patch.session_date ?? String(session.session_date).slice(0, 10);
    const excluded = series.definition.excluded_dates.filter((value) => value !== date);
    if ((patch.status ?? session.status) === SessionStatus.CANCELLED) excluded.push(date);
    const definition = {
      ...series.definition,
      ...this.fields({ ...series.definition, ...session } as SeriesDefinitionDto),
      ...patch,
      start_time: (patch.start_time ?? session.start_time).slice(0, 5),
      end_time: (patch.end_time ?? session.end_time).slice(0, 5),
      excluded_dates: excluded,
    } as SeriesDefinitionDto;
    await this.edit(id, { scope: 'one', definition, session_date: date });
    return this.db
      .getRepository(Session)
      .findOneByOrFail({ session_id: id, club_id: this.tenant.getClubId() });
  }
}
