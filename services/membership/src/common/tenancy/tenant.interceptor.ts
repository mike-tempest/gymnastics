import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { CLS_CLUB_ID_KEY } from './tenant-context.service';

/**
 * Global interceptor that lifts the authenticated user's `club_id` into the
 * CLS (AsyncLocalStorage) request context as `clubId`.
 *
 * It runs after the per-controller `JwtAuthGuard` has populated `req.user`, so
 * by the time this interceptor executes the user (if any) is attached. Because
 * auth is applied per-controller rather than globally, many routes are public
 * and have no `req.user`. In that case we set nothing and the request proceeds
 * normally; `TenantContextService.getClubId()` will throw only if a scoped
 * query is then attempted, while `getClubIdOrNull()` stays safe.
 *
 * The CLS store itself is provided by `ClsModule.forRoot({ middleware })`
 * registered in app.module.ts, which establishes the context before guards and
 * interceptors run.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only HTTP requests carry a user; tolerate other contexts gracefully.
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<{ user?: { club_id?: string } }>();
      const clubId = request?.user?.club_id;
      if (clubId) {
        this.cls.set(CLS_CLUB_ID_KEY, clubId);
      }
    }

    return next.handle();
  }
}
