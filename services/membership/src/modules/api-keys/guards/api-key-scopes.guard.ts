import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyScope } from '@club-manager/shared-types';
import { API_KEY_SCOPES_KEY } from '../decorators/api-key-scopes.decorator';
import { ApiKeyRequest } from './api-key.guard';

/**
 * Enforces the @ApiKeyScopes(...) declaration on a route (TEM-32).
 *
 * Fails closed in both directions that matter:
 *
 *  - A route on the key-authenticated surface that declares no scope is
 *    refused, rather than being open to every key. Forgetting the decorator
 *    should break the route loudly, not widen it silently.
 *  - A request with no authenticated key on it is refused, so this guard can
 *    never be the reason an unauthenticated caller gets through if it is ever
 *    mounted without ApiKeyGuard in front of it.
 */
@Injectable()
export class ApiKeyScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }

    const required = this.reflector.getAllAndOverride<ApiKeyScope[] | undefined>(
      API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      throw new ForbiddenException('This endpoint declares no API key scope');
    }

    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const granted = request.apiKey?.scopes;

    if (!Array.isArray(granted)) {
      throw new ForbiddenException('This API key does not grant access to this endpoint');
    }

    // Every required scope must be held. Routes declare a single scope today,
    // but requiring all of them is the safe reading of a list.
    const permitted = required.every((scope) => granted.includes(scope));
    if (!permitted) {
      throw new ForbiddenException('This API key does not grant access to this endpoint');
    }

    return true;
  }
}
