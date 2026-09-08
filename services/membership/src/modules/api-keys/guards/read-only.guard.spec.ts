import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyScope } from '@club-manager/shared-types';
import { ReadOnlyApiGuard } from './read-only.guard';
import { ApiKeyScopesGuard } from './api-key-scopes.guard';
import { API_KEY_SCOPES_KEY } from '../decorators/api-key-scopes.decorator';

/** Builds an http ExecutionContext for the given request. */
function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('ReadOnlyApiGuard', () => {
  const guard = new ReadOnlyApiGuard();

  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])('allows %s', (method) => {
    expect(guard.canActivate(httpContext({ method }))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'patch'])('refuses %s', (method) => {
    expect(() => guard.canActivate(httpContext({ method }))).toThrow(
      'API keys grant read-only access',
    );
  });

  it('refuses a request with no method at all rather than defaulting to allow', () => {
    expect(() => guard.canActivate(httpContext({}))).toThrow();
  });

  it('refuses a non-http context', () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});

describe('ApiKeyScopesGuard', () => {
  /** Reflector stub returning a fixed scope declaration for the route. */
  function guardFor(declared: ApiKeyScope[] | undefined): ApiKeyScopesGuard {
    const reflector = {
      getAllAndOverride: (key: string) => (key === API_KEY_SCOPES_KEY ? declared : undefined),
    } as unknown as Reflector;
    return new ApiKeyScopesGuard(reflector);
  }

  it('allows a key that holds the declared scope', () => {
    const guard = guardFor([ApiKeyScope.MEMBERS_READ]);
    const request = { apiKey: { scopes: [ApiKeyScope.MEMBERS_READ, ApiKeyScope.SQUADS_READ] } };

    expect(guard.canActivate(httpContext(request))).toBe(true);
  });

  it('refuses a key that holds other scopes but not this one', () => {
    const guard = guardFor([ApiKeyScope.INVOICES_READ]);
    const request = { apiKey: { scopes: [ApiKeyScope.MEMBERS_READ] } };

    expect(() => guard.canActivate(httpContext(request))).toThrow(
      'This API key does not grant access to this endpoint',
    );
  });

  it('requires every declared scope, not just one of them', () => {
    const guard = guardFor([ApiKeyScope.MEMBERS_READ, ApiKeyScope.AWARDS_READ]);
    const request = { apiKey: { scopes: [ApiKeyScope.MEMBERS_READ] } };

    expect(() => guard.canActivate(httpContext(request))).toThrow();
  });

  it('fails closed when a route forgets to declare a scope', () => {
    const guard = guardFor(undefined);
    const request = { apiKey: { scopes: [ApiKeyScope.MEMBERS_READ] } };

    expect(() => guard.canActivate(httpContext(request))).toThrow(
      'This endpoint declares no API key scope',
    );
  });

  it('fails closed on an empty scope declaration', () => {
    const guard = guardFor([]);
    const request = { apiKey: { scopes: [ApiKeyScope.MEMBERS_READ] } };

    expect(() => guard.canActivate(httpContext(request))).toThrow();
  });

  it('refuses a request that carries no authenticated key', () => {
    const guard = guardFor([ApiKeyScope.MEMBERS_READ]);

    expect(() => guard.canActivate(httpContext({}))).toThrow(
      'This API key does not grant access to this endpoint',
    );
  });
});
