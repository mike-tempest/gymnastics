import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

/**
 * The CLS key under which the active tenant's club_id is stored.
 *
 * The TenantInterceptor sets this from `req.user.club_id` on authenticated
 * requests. Public/unauthenticated routes leave it unset.
 */
export const CLS_CLUB_ID_KEY = 'clubId';

/**
 * Provides access to the active request's tenant (`club_id`).
 *
 * Inject this anywhere you need the current club. On a scoped (authenticated)
 * request `getClubId()` returns the logged-in user's club. On a public route
 * where no club is in context it throws, so call `getClubIdOrNull()` instead
 * when you must tolerate an unauthenticated caller.
 *
 * Registered as part of the global `TenantModule`, so it is injectable from any
 * module without re-importing.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  /**
   * Returns the active tenant's club_id.
   *
   * @throws InternalServerErrorException if no club_id is present in the
   * current context. This indicates a scoped query was run outside an
   * authenticated request (a programming error), not a client error.
   */
  getClubId(): string {
    const clubId = this.cls.get<string | undefined>(CLS_CLUB_ID_KEY);
    if (!clubId) {
      throw new InternalServerErrorException(
        'No tenant context available: club_id is not set for this request. ' +
          'This usually means a tenant-scoped query ran on a public/unauthenticated ' +
          'route, or the request was not processed by the TenantInterceptor.',
      );
    }
    return clubId;
  }

  /**
   * Returns the active tenant's club_id, or null if none is set.
   *
   * Safe to call on public/unauthenticated routes.
   */
  getClubIdOrNull(): string | null {
    return this.cls.get<string | undefined>(CLS_CLUB_ID_KEY) ?? null;
  }
}
