import {
  describeRequest,
  normalisePath,
  resolveAction,
  resolveEntityId,
  resolveEntityType,
  shouldAudit,
} from './audit-route.util';
import {
  AuditAction,
  AuditEntityType,
} from '../../modules/compliance/audit-logs/entities/audit-log.entity';

describe('audit-route.util', () => {
  describe('normalisePath', () => {
    it('strips the global api prefix, leading slashes and query strings', () => {
      expect(normalisePath('/api/swimmers?page=2')).toBe('swimmers');
      expect(normalisePath('/api/squads/')).toBe('squads');
      expect(normalisePath('swimmers')).toBe('swimmers');
    });
  });

  describe('resolveAction', () => {
    it('maps HTTP methods to audit actions', () => {
      expect(resolveAction('POST')).toBe(AuditAction.CREATE);
      expect(resolveAction('put')).toBe(AuditAction.UPDATE);
      expect(resolveAction('PATCH')).toBe(AuditAction.UPDATE);
      expect(resolveAction('DELETE')).toBe(AuditAction.DELETE);
      expect(resolveAction('GET')).toBe(AuditAction.VIEW);
    });

    it('returns null for methods that are not audited', () => {
      expect(resolveAction('OPTIONS')).toBeNull();
      expect(resolveAction('HEAD')).toBeNull();
    });
  });

  describe('resolveEntityType', () => {
    it.each([
      ['/api/swimmers', AuditEntityType.SWIMMER],
      ['/api/squads/abc', AuditEntityType.SQUAD],
      ['/api/sessions', AuditEntityType.SESSION],
      ['/api/attendance', AuditEntityType.ATTENDANCE],
      ['/api/families', AuditEntityType.FAMILY],
      ['/api/clubs', AuditEntityType.CLUB],
      ['/api/invoices', AuditEntityType.INVOICE],
      ['/api/fee-structures', AuditEntityType.FEE_STRUCTURE],
      ['/api/payments', AuditEntityType.PAYMENT],
      ['/api/mandates', AuditEntityType.MANDATE],
      ['/api/communications', AuditEntityType.MESSAGE],
      ['/api/competitions', AuditEntityType.COMPETITION],
      ['/api/waitlist', AuditEntityType.WAITLIST],
      ['/api/wellbeing', AuditEntityType.WELLBEING],
      ['/api/import/swimmers', AuditEntityType.DOCUMENT],
    ])('maps %s to %s', (url, expected) => {
      expect(resolveEntityType(url)).toBe(expected);
    });

    it('prefers the most specific prefix', () => {
      // `compliance/dbs` must win over the broader `compliance` entry.
      expect(resolveEntityType('/api/compliance/dbs/123')).toBe(AuditEntityType.DBS_CHECK);
      expect(resolveEntityType('/api/compliance/consents')).toBe(AuditEntityType.CONSENT);
      expect(resolveEntityType('/api/compliance/safeguarding')).toBe(AuditEntityType.REPORT);
      expect(resolveEntityType('/api/admin/settings')).toBe(AuditEntityType.SETTINGS);
      expect(resolveEntityType('/api/finance/payments')).toBe(AuditEntityType.PAYMENT);
    });

    it('does not match a prefix that is only a partial segment', () => {
      // `/api/sessions-archive` must not be filed as SESSION.
      expect(resolveEntityType('/api/sessions-archive')).toBeNull();
    });

    it('returns null for unmapped routes', () => {
      expect(resolveEntityType('/api/something-new')).toBeNull();
      expect(resolveEntityType('/')).toBeNull();
    });
  });

  describe('resolveEntityId', () => {
    it('extracts a uuid from the path', () => {
      const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
      expect(resolveEntityId(`/api/swimmers/${id}`)).toBe(id);
      expect(resolveEntityId(`/api/swimmers/${id}/notes`)).toBe(id);
    });

    it('returns undefined when no segment is a uuid', () => {
      // entity_id is a uuid column, so non-uuid segments must never be written.
      expect(resolveEntityId('/api/swimmers/search')).toBeUndefined();
      expect(resolveEntityId('/api/sessions/upcoming')).toBeUndefined();
      expect(resolveEntityId('/api/swimmers/42')).toBeUndefined();
    });
  });

  describe('shouldAudit', () => {
    it('audits mutations regardless of the view flag', () => {
      expect(shouldAudit('POST', '/api/swimmers', false)).toBe(true);
      expect(shouldAudit('PATCH', '/api/squads/1', false)).toBe(true);
      expect(shouldAudit('DELETE', '/api/sessions/1', false)).toBe(true);
    });

    it('only audits reads when views are enabled', () => {
      expect(shouldAudit('GET', '/api/swimmers', false)).toBe(false);
      expect(shouldAudit('GET', '/api/swimmers', true)).toBe(true);
    });

    it('never audits health, metrics or the audit log itself', () => {
      // Auditing audit-log reads would let one dashboard visit write hundreds
      // of rows, and health is polled continuously by the platform.
      expect(shouldAudit('GET', '/api/health', true)).toBe(false);
      expect(shouldAudit('GET', '/health', true)).toBe(false);
      expect(shouldAudit('GET', '/api/compliance/audit-logs', true)).toBe(false);
      expect(shouldAudit('GET', '/api/compliance/audit-logs/statistics', true)).toBe(false);
    });

    it('never audits auth routes, which AuthService records explicitly', () => {
      expect(shouldAudit('POST', '/api/auth/login', false)).toBe(false);
      expect(shouldAudit('POST', '/api/auth/register-club', false)).toBe(false);
    });

    it('never audits webhooks, which have no acting user', () => {
      expect(shouldAudit('POST', '/api/webhooks/stripe', false)).toBe(false);
      expect(shouldAudit('POST', '/api/webhooks/gocardless', false)).toBe(false);
    });

    it('does not audit routes it cannot attribute to an entity', () => {
      expect(shouldAudit('POST', '/api/something-new', false)).toBe(false);
    });
  });

  describe('describeRequest', () => {
    it('produces a readable summary without the query string', () => {
      expect(describeRequest('POST', '/api/swimmers?foo=1')).toBe(
        'CREATE SWIMMER via POST /api/swimmers',
      );
    });
  });
});
