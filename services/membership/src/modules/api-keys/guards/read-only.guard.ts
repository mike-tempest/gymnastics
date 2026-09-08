import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** The only verbs a key-authenticated request may ever use. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects any mutating verb on a route authenticated by an API key (TEM-32).
 *
 * Read-only is enforced in three independent layers, and this guard is the
 * second of them:
 *
 *  1. **Surface.** ApiKeyGuard is applied to exactly one controller, and that
 *    controller declares nothing but @Get handlers. A key has no mutating
 *    route to reach in the first place. This is the primary mechanism, chosen
 *    over annotating the existing internal controllers because it means no
 *    existing JWT or Roles route was touched at all, and because a public API
 *    contract deserves its own stable shapes rather than inheriting whatever
 *    the internal services happen to return today.
 *  2. **This guard.** It runs after ApiKeyGuard on that controller and refuses
 *    anything that is not a read verb. It exists for the future commit where
 *    somebody adds a @Post to the read controller without thinking: the route
 *    will 403 rather than quietly become a write endpoint.
 *  3. **Identity.** ApiKeyGuard populates `req.user` with a club_id but no
 *    role, so RolesGuard denies a key-authenticated request on any internal
 *    controller that expects a human.
 *
 * OPTIONS is allowed through because CORS preflight is not a mutation.
 */
@Injectable()
export class ReadOnlyApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }

    const request = context.switchToHttp().getRequest<{ method?: string }>();
    const method = (request?.method ?? '').toUpperCase();

    if (!READ_METHODS.has(method)) {
      throw new ForbiddenException('API keys grant read-only access');
    }

    return true;
  }
}
