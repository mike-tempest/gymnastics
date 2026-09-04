import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import { AuditLogsService } from '../../modules/compliance/audit-logs/audit-logs.service';
import {
  describeRequest,
  resolveAction,
  resolveEntityId,
  resolveEntityType,
  shouldAudit,
} from './audit-route.util';

/**
 * Keys whose values must never reach the audit trail. Matched case-insensitively
 * against a substring of the key, so `password`, `password_hash`,
 * `newPassword` and `access_token` are all covered.
 */
const REDACTED_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'account_number',
  'sort_code',
  'iban',
  'card',
  'cvv',
];

const REDACTED = '[REDACTED]';

/**
 * Global interceptor that records who did what, to which entity, and when.
 *
 * Design decisions worth knowing:
 *
 *  - **Only successful requests are audited.** The tap's next handler fires on
 *    success only, so a rejected or failed mutation never appears as though it
 *    happened.
 *  - **Auditing never breaks a request.** The write is fire-and-forget and every
 *    failure is swallowed into a log line. An audit outage must not take the
 *    product down with it.
 *  - **club_id comes from `req.user`, not CLS.** Both this and TenantInterceptor
 *    are registered as APP_INTERCEPTORs, and relying on their relative ordering
 *    to populate CLS first would be fragile. Reading the JWT payload directly
 *    removes that coupling entirely.
 *  - **Unauthenticated requests are skipped.** `audit_logs.user_id` and
 *    `club_id` are both NOT NULL, so there is nothing meaningful to write for an
 *    anonymous caller. Login is audited explicitly in AuthService instead, where
 *    the resolved user is in hand.
 *  - **Read traffic is opt-in** via `AUDIT_LOG_VIEWS`. Mutations are always
 *    recorded because they are the compliance-relevant events; GETs are far
 *    higher volume and are only useful for product analytics, so they are gated
 *    behind a flag that can be turned off if the table grows too fast.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private readonly logViews: boolean;

  constructor(
    private readonly auditLogsService: AuditLogsService,
    configService: ConfigService,
  ) {
    this.logViews = configService.get<string>('AUDIT_LOG_VIEWS', 'false').toLowerCase() === 'true';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const method = request?.method ?? '';
    const url = request?.originalUrl ?? request?.url ?? '';
    const startedAt = Date.now();

    if (!shouldAudit(method, url, this.logViews)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Deliberately not awaited: the response must not wait on an audit write.
        void this.record(request, method, url, Date.now() - startedAt);
      }),
    );
  }

  private async record(
    request: AuditableRequest,
    method: string,
    url: string,
    durationMs: number,
  ): Promise<void> {
    try {
      const user = request.user;
      // Both user_id and club_id are NOT NULL; without an authenticated user
      // there is no honest row to write.
      if (!user?.user_id || !user?.club_id) {
        return;
      }

      const action = resolveAction(method);
      const entityType = resolveEntityType(url);
      if (!action || !entityType) {
        return;
      }

      await this.auditLogsService.log({
        club_id: user.club_id,
        user_id: user.user_id,
        user_email: user.email,
        action,
        entity_type: entityType,
        entity_id: resolveEntityId(url),
        description: describeRequest(method, url),
        changes: this.redact(request.body),
        metadata: {
          method: method.toUpperCase(),
          path: url.split('?')[0],
          duration_ms: durationMs,
          role: user.role,
        },
        ip_address: this.resolveIp(request),
        user_agent: request.headers?.['user-agent'],
      });
    } catch (error) {
      // An audit failure must never surface to the caller or fail the request.
      this.logger.warn(
        `Failed to write audit log for ${method} ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Recursively strip credential-like values from a request body before it is
   * persisted. Returns undefined for empty bodies so we do not store `{}`.
   */
  private redact(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') return undefined;

    const walk = (value: unknown, depth: number): unknown => {
      if (depth > 5) return '[TRUNCATED]';
      if (Array.isArray(value)) {
        // Large bulk imports would otherwise copy the entire payload into the
        // audit row; record the shape instead of the contents.
        if (value.length > 20) return `[${value.length} items]`;
        return value.map((item) => walk(item, depth + 1));
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, inner]) => {
            const isSensitive = REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle));
            return [key, isSensitive ? REDACTED : walk(inner, depth + 1)];
          }),
        );
      }
      return value;
    };

    const redacted = walk(body, 0) as Record<string, unknown>;
    return Object.keys(redacted).length > 0 ? redacted : undefined;
  }

  /**
   * Prefer the proxy-forwarded client IP, since the service runs behind
   * Railway's load balancer where the socket address is always internal.
   * The column is varchar(45), so an IPv6 address still fits.
   */
  private resolveIp(request: AuditableRequest): string | undefined {
    const forwarded = request.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim().slice(0, 45);
    }
    return request.ip?.slice(0, 45);
  }
}

interface AuditableRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  user?: {
    user_id?: string;
    club_id?: string;
    email?: string;
    role?: string;
  };
}
