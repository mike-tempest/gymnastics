import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './users.repository';

describe('Account repository tenant boundaries', () => {
  let club: string | null;
  let rows: Record<string, unknown>[];
  let repository: UsersRepository;
  const familyLookup = jest.fn();
  beforeEach(() => {
    club = 'club-a';
    rows = [
      { user_id: 'a', club_id: 'club-a', role: UserRole.PARENT, family_id: 'fa' },
      { user_id: 'b', club_id: 'club-b', role: UserRole.PARENT, family_id: 'fb' },
    ];
    const matching = (where: Record<string, unknown>) =>
      rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
    const orm = {
      find: async ({ where }: { where?: Record<string, unknown> }) =>
        where ? matching(where) : rows,
      findOne: async ({ where }: { where: Record<string, unknown> }) => matching(where)[0] ?? null,
      create: (value: Record<string, unknown>) => ({ user_id: 'new', ...value }),
      save: async (value: Record<string, unknown>) => {
        rows.push(value);
        return value;
      },
      update: async (where: Record<string, unknown>, value: Record<string, unknown>) => {
        matching(where).forEach((row) => Object.assign(row, value));
      },
      delete: async (where: Record<string, unknown>) => {
        const targets = matching(where);
        rows = rows.filter((row) => !targets.includes(row));
      },
      count: async ({ where }: { where: Record<string, unknown> }) => matching(where).length,
      manager: { getRepository: () => ({ findOne: familyLookup }) },
    };
    familyLookup.mockReset();
    familyLookup.mockImplementation(async ({ where }) =>
      where.family_id === 'fa' && where.club_id === 'club-a' ? { family_id: 'fa' } : null,
    );
    repository = new UsersRepository(
      orm as unknown as Repository<User>,
      {
        getClubId: () => {
          if (!club) throw new Error('Missing tenant');
          return club;
        },
      } as TenantContextService,
    );
  });

  it('scopes lists, ID, role, family and counts to the caller club', async () => {
    expect((await repository.findAll()).map((row) => row.user_id)).toEqual(['a']);
    expect(await repository.findOne('b')).toBeNull();
    expect((await repository.findByRole(UserRole.PARENT)).map((row) => row.user_id)).toEqual(['a']);
    expect(await repository.findByFamily('fb')).toEqual([]);
    expect(await repository.count()).toBe(1);
    club = 'club-b';
    expect((await repository.findAll()).map((row) => row.user_id)).toEqual(['b']);
  });
  it('does not update or delete a guessed foreign user ID', async () => {
    expect(await repository.update('b', { first_name: 'Changed' })).toBeNull();
    await repository.remove('b');
    expect(rows.find((row) => row.user_id === 'b')).toEqual({
      user_id: 'b',
      club_id: 'club-b',
      role: UserRole.PARENT,
      family_id: 'fb',
    });
  });
  it('stamps new users with the active club and rejects foreign family associations', async () => {
    const input = {
      first_name: 'Test',
      last_name: 'Only',
      email: 'test@example.test',
      password: 'Synthetic123',
      family_id: 'fa',
    };
    const created = await repository.create(input, 'hash');
    expect(created.club_id).toBe('club-a');
    await expect(repository.create({ ...input, family_id: 'fb' }, 'hash')).rejects.toThrow(
      'Family not found',
    );
    await expect(repository.update('a', { family_id: 'fb' })).rejects.toThrow('Family not found');
    expect(rows.find((row) => row.user_id === 'a')?.family_id).toBe('fa');
  });
  it('fails closed without tenant context while the explicit authentication lookup remains usable', async () => {
    club = null;
    await expect(repository.findAll()).rejects.toThrow('Missing tenant');
    await expect(repository.findOne('a')).rejects.toThrow('Missing tenant');
    await expect(repository.update('a', { first_name: 'Changed' })).rejects.toThrow(
      'Missing tenant',
    );
    await expect(repository.remove('a')).rejects.toThrow('Missing tenant');
    expect((await repository.findForAuthentication('a'))?.user_id).toBe('a');
  });
});
