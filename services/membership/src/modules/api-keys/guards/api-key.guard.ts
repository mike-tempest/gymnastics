import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_CLUB_ID_KEY } from '../../../common/tenancy/tenant-context.service';
import { ApiKeysService, AuthenticatedApiKey } from '../api-keys.service';

/**
 * The header a club sends its read API key in.
 *
 * X-API-Key rather than `Authorization: Bearer`, deliberately. The bearer
 * scheme on this service already means "a short-lived user JWT", and the
 * passport strategy behind JwtAuthGuard parses it. Putting a second,
 * differently-shaped credential in the same header would mean every guard had
 * to sniff the value to work out which kind it was, and a sniffing mistake in
 * either direction is an auth bug. A separate header keeps the two schemes
 * from ever being confused for one another.
 */
export const API_KEY_HEADER = 'x-api-key';

/** The request shape this guard populates. */
export interface ApiKeyRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  /**
   * Populated so the rest of the request behaves exactly like an
   * authenticated one for tenancy purposes. Deliberately carries no
   * `user_id` and no `role`: see the class comment.
   */
  user?: { club_id: string };
  apiKey?: AuthenticatedApiKey;
}

/**
 * Authenticates a request with a club-scoped read API key (TEM-32).
 *
 * What it does, and why each part matters:
 *
 *  - Reads the credential from the X-API-Key header only. A missing,
 *    malformed, unknown or revoked key is a flat 401 with the same message
 *    every time, so the response never distinguishes "no such key" from
 *    "wrong secret".
 *  - Verification happens in ApiKeysService against a stored digest, compared
 *    in constant time. No raw key and no hash is logged anywhere.
 *  - On success it sets `req.user.club_id` and writes the same CLS key the
 *    JWT path writes. This is the point of the whole guard: TenantScopedHelper
 *    and the Postgres RLS policy read the tenant from exactly one place, so a
 *    key-authenticated request is scoped by precisely the same machinery as a
 *    user-authenticated one, and a key cannot reach another club's rows.
 *
 * It writes CLS itself rather than relying on the global TenantInterceptor.
 * The interceptor would in fact pick `req.user.club_id` up, since interceptors
 * run after guards, but leaning on that ordering for a security property is
 * fragile. Setting it here makes the guarantee local and unconditional; the
 * interceptor then sets the identical value and the write is a no-op.
 *
 * Note what `req.user` deliberately lacks. There is no `user_id`, so the
 * global AuditInterceptor skips the request instead of inventing an actor,
 * and no `role`, so RolesGuard denies a key-authenticated request outright if
 * one ever reaches a controller that expects a human.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return false;
    }

    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const presented = ApiKeyGuard.readHeader(request);

    if (!presented) {
      throw new UnauthorizedException('A valid API key is required');
    }

    const authenticated = await this.apiKeysService.authenticate(presented);
    if (!authenticated) {
      // One message for every failure mode. Telling a caller whether the
      // prefix existed would turn the API into a key-enumeration oracle.
      throw new UnauthorizedException('A valid API key is required');
    }

    request.apiKey = authenticated;
    request.user = { club_id: authenticated.club_id };
    this.cls.set(CLS_CLUB_ID_KEY, authenticated.club_id);

    return true;
  }

  /**
   * Pulls the credential out of the header. Express lower-cases header names
   * and may hand back an array when a header is repeated; a repeated
   * credential header is ambiguous, so it is rejected rather than guessed at.
   */
  private static readHeader(request: ApiKeyRequest): string | null {
    const raw = request.headers?.[API_KEY_HEADER];
    if (typeof raw !== 'string') {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
