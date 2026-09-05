import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLogsService } from '../../modules/compliance/audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditEntityType,
} from '../../modules/compliance/audit-logs/entities/audit-log.entity';

const USER = {
  user_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  club_id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  email: 'coach@club.org.uk',
  role: 'head_coach',
};

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeHandler(result: unknown = { ok: true }): CallHandler {
  return { handle: () => of(result) };
}

describe('AuditInterceptor', () => {
  let auditLogsService: { log: jest.Mock };

  const build = (viewsEnabled = false) => {
    const config = {
      get: (_key: string, fallback: string) => (viewsEnabled ? 'true' : fallback),
    } as unknown as ConfigService;
    return new AuditInterceptor(auditLogsService as unknown as AuditLogsService, config);
  };

  beforeEach(() => {
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
  });

  it('records a mutation with the acting user, club and entity', async () => {
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/members',
      user: USER,
      body: { first_name: 'Daisy' },
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      ip: '10.0.0.1',
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(auditLogsService.log).toHaveBeenCalledTimes(1);
    const entry = auditLogsService.log.mock.calls[0][0];
    expect(entry).toMatchObject({
      club_id: USER.club_id,
      user_id: USER.user_id,
      user_email: USER.email,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.MEMBER,
      changes: { first_name: 'Daisy' },
    });
    // The forwarded client IP wins over the internal socket address.
    expect(entry.ip_address).toBe('203.0.113.7');
    expect(entry.metadata).toMatchObject({ method: 'POST', path: '/api/members' });
    expect(typeof entry.metadata.duration_ms).toBe('number');
  });

  it('does not record when the handler errors', async () => {
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/members',
      user: USER,
      headers: {},
    });
    const failing: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(lastValueFrom(interceptor.intercept(context, failing))).rejects.toThrow('boom');

    // A rejected mutation must never appear in the trail as though it happened.
    expect(auditLogsService.log).not.toHaveBeenCalled();
  });

  it('never fails the request when the audit write throws', async () => {
    auditLogsService.log.mockRejectedValue(new Error('db down'));
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/squads',
      user: USER,
      headers: {},
    });

    await expect(
      lastValueFrom(interceptor.intercept(context, makeHandler({ id: 1 }))),
    ).resolves.toEqual({ id: 1 });
  });

  it('redacts credential-like fields from the recorded body', async () => {
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/users',
      user: USER,
      body: {
        email: 'new@club.org.uk',
        password: 'hunter2',
        nested: { access_token: 'abc', sort_code: '20-45-67', name: 'keep me' },
      },
      headers: {},
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    const { changes } = auditLogsService.log.mock.calls[0][0];
    expect(changes.password).toBe('[REDACTED]');
    expect(changes.nested.access_token).toBe('[REDACTED]');
    expect(changes.nested.sort_code).toBe('[REDACTED]');
    expect(changes.nested.name).toBe('keep me');
    expect(changes.email).toBe('new@club.org.uk');
  });

  it('summarises large arrays instead of copying a bulk payload', async () => {
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/import/members',
      user: USER,
      body: { rows: Array.from({ length: 64 }, (_, i) => ({ name: `member ${i}` })) },
      headers: {},
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    const { changes } = auditLogsService.log.mock.calls[0][0];
    expect(changes.rows).toBe('[64 items]');
  });

  it('skips unauthenticated requests, which have no club to attribute', async () => {
    const interceptor = build();
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/members',
      headers: {},
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(auditLogsService.log).not.toHaveBeenCalled();
  });

  it('skips GETs unless AUDIT_LOG_VIEWS is enabled', async () => {
    const context = () =>
      makeContext({ method: 'GET', originalUrl: '/api/members', user: USER, headers: {} });

    await lastValueFrom(build(false).intercept(context(), makeHandler()));
    expect(auditLogsService.log).not.toHaveBeenCalled();

    await lastValueFrom(build(true).intercept(context(), makeHandler()));
    expect(auditLogsService.log).toHaveBeenCalledTimes(1);
    expect(auditLogsService.log.mock.calls[0][0].action).toBe(AuditAction.VIEW);
  });

  it('ignores non-HTTP execution contexts', async () => {
    const interceptor = build();
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(auditLogsService.log).not.toHaveBeenCalled();
  });
});
