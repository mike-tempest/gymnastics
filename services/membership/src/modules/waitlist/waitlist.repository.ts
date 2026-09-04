import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, LessThanOrEqual, Not, ObjectLiteral, Repository } from 'typeorm';
import { WaitlistEntry } from './entities/waitlist.entity';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Data-access layer for the waitlist module, with tenant enforcement.
 *
 * UNAUTHENTICATED / PUBLIC PATHS (see waitlist.controller):
 *   - POST /waitlist        (join)     -> create()
 *   - GET  /waitlist/count             -> count()
 * Both carry NO tenant context, so they must NOT call getClubId(). They use
 * getClubIdOrNull() instead. See the per-method notes below and the flag in the
 * task report: the public marketing signup has no authenticated club, yet the
 * waitlist table now has club_id NOT NULL + FK (Phase 1). How a public signup's
 * club_id is ultimately resolved is a product decision that has been surfaced
 * rather than silently hard-coded here.
 *
 * AUTHENTICATED PATHS:
 *   - GET  /waitlist                   -> findAll() (scoped to the caller's club)
 *   - POST /waitlist/process-drips     -> drip queries (batch; see note)
 */
@Injectable()
export class WaitlistRepository {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly repository: Repository<WaitlistEntry>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Build a new (unsaved) entity.
   *
   * PUBLIC PATH: this runs on the unauthenticated POST /waitlist route, so we use
   * getClubIdOrNull(). When a club is in context (e.g. an in-app signup) it is
   * stamped; on a public website signup there is none and club_id is left for a
   * later resolution decision (see class doc). We deliberately never trust a
   * club_id supplied in the payload.
   */
  createEntity(data: Partial<WaitlistEntry>): WaitlistEntry {
    const { club_id: _ignored, ...rest } = data;
    const contextClubId = this.tenantContext.getClubIdOrNull();
    return this.repository.create({
      ...rest,
      ...(contextClubId ? { club_id: contextClubId } : {}),
    });
  }

  async save(entry: WaitlistEntry): Promise<WaitlistEntry> {
    return this.repository.save(entry);
  }

  /**
   * Update by id. Scoped to the active club when there is a tenant context.
   *
   * Callers here are the fire-and-forget confirmation email (reached from the
   * public create path -> no context) and processDrips (authenticated batch).
   * When no context is present we fall back to an id-only predicate so the public
   * confirmation-timestamp write still succeeds; the id is a server-generated
   * UUID, so there is no cross-tenant guessing surface.
   */
  async update(id: string, partial: Partial<WaitlistEntry>): Promise<void> {
    const { club_id: _ignored, ...rest } = partial;
    const contextClubId = this.tenantContext.getClubIdOrNull();
    const criteria: FindOptionsWhere<WaitlistEntry> = contextClubId
      ? { id, club_id: contextClubId }
      : { id };
    await this.repository.update(criteria, rest as ObjectLiteral);
  }

  /**
   * AUTHENTICATED: list entries for the caller's club only.
   */
  async findAll(): Promise<WaitlistEntry[]> {
    return this.scoped.scopedFind(this.repository, { order: { createdAt: 'DESC' } });
  }

  /**
   * PUBLIC PATH: GET /waitlist/count is unauthenticated. When a tenant context is
   * present (in-app callers) the count is scoped; on the public website route it
   * falls back to the global count so the public signup-counter keeps working.
   */
  async count(): Promise<number> {
    const contextClubId = this.tenantContext.getClubIdOrNull();
    if (contextClubId) {
      return this.repository.count({ where: { club_id: contextClubId } });
    }
    return this.repository.count();
  }

  /**
   * Drip eligibility queries.
   *
   * processDrips is an authenticated maintenance/batch endpoint that fans out
   * across entries. When a tenant context is present each query is scoped to that
   * club; this keeps an admin from dripping other clubs' entries. If ever invoked
   * without a context (e.g. a future cron), it falls back to a global sweep and
   * the club_id filter is omitted (flagged as a non-request path).
   */
  async findDripEligible(
    sentColumn: 'confirmationSentAt' | 'drip1SentAt' | 'drip2SentAt',
    pendingColumn: 'drip1SentAt' | 'drip2SentAt' | 'drip3SentAt',
    olderThan: Date,
  ): Promise<WaitlistEntry[]> {
    const where: FindOptionsWhere<WaitlistEntry> = {
      [sentColumn]: Not(IsNull()),
      [pendingColumn]: IsNull(),
      createdAt: LessThanOrEqual(olderThan),
    };
    const contextClubId = this.tenantContext.getClubIdOrNull();
    if (contextClubId) {
      where.club_id = contextClubId;
    }
    return this.repository.find({ where });
  }
}
