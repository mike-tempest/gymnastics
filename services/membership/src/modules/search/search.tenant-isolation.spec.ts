import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { UserRole } from '../users/entities/user.entity';
import { SearchService } from './search.service';
import { SearchQuery } from './search.controller';

describe('Global search tenant and role boundaries', () => {
  const query = jest.fn().mockResolvedValue([]);
  const service = new SearchService(
    { query } as unknown as DataSource,
    { getClubId: () => 'club-a' } as TenantContextService,
  );
  beforeEach(() => query.mockClear());
  it.each([
    UserRole.SUPER_ADMIN,
    UserRole.TREASURER,
    UserRole.HEAD_COACH,
    UserRole.SQUAD_COACH,
    UserRole.WELFARE_OFFICER,
    UserRole.PARENT,
  ])('binds the authenticated club for %s', async (role) => {
    await service.search('Ada', { role, club_id: 'club-a', family_id: 'family-a' });
    expect(query).toHaveBeenCalled();
    for (const [sql, parameters] of query.mock.calls) {
      expect(sql).toContain('club_id = $1');
      expect(parameters[0]).toBe('club-a');
      expect(parameters[2]).toBe(role === UserRole.PARENT ? 'family-a' : null);
    }
  });
  it('rejects mismatched tenant context and parents without a family', async () => {
    for (const user of [
      { role: UserRole.SUPER_ADMIN, club_id: 'other', family_id: '' },
      { role: UserRole.PARENT, club_id: 'club-a', family_id: '' },
    ])
      expect((await service.search('Ada', user)).results).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
  it('excludes families for coaches and sessions for Welfare Officers', async () => {
    await service.search('Ada', { role: UserRole.SQUAD_COACH, club_id: 'club-a', family_id: '' });
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM families'))).toBe(false);
    query.mockClear();
    await service.search('Ada', {
      role: UserRole.WELFARE_OFFICER,
      club_id: 'club-a',
      family_id: '',
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('FROM members');
  });
  it('treats SQL and wildcard characters as bound literal values', async () => {
    await service.search("O'Brien%_\\", {
      role: UserRole.SUPER_ADMIN,
      club_id: 'club-a',
      family_id: '',
    });
    expect(query.mock.calls[0][0]).not.toContain("O'Brien");
    expect(query.mock.calls[0][1][1]).toBe("%O'Brien\\%\\_\\\\%");
  });
  it('rejects caller-supplied scope and unbounded queries', async () => {
    expect(
      await validate(plainToInstance(SearchQuery, { q: 'Ada', club_id: 'other' }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toHaveLength(0);
    expect(await validate(plainToInstance(SearchQuery, { q: 'a'.repeat(101) }))).not.toHaveLength(
      0,
    );
  });
});
