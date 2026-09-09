import { Repository } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { DBSRepository } from './dbs.repository';
import { DBSCheck, DBSCheckType } from './entities/dbs-check.entity';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';

describe('DBS subject attribution', () => {
  const tenant = new TenantContextService({ get: () => 'club-a' } as unknown as ClsService);
  const scoped = new TenantScopedHelper(tenant);
  const subjects = [
    { user_id: 'staff-a', club_id: 'club-a' },
    { user_id: 'staff-b', club_id: 'club-b' },
  ];
  const holderRepository = {
    findOne: jest.fn(({ where }) =>
      Promise.resolve(
        subjects.find((row) => row.user_id === where.user_id && row.club_id === where.club_id) ??
          null,
      ),
    ),
  };
  const raw = {
    manager: { getRepository: () => holderRepository },
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
  };
  const repository = new DBSRepository(raw as unknown as Repository<DBSCheck>, scoped, tenant);
  const dto = {
    certificate_number: 'TEST',
    check_type: DBSCheckType.ENHANCED,
    issue_date: '2026-09-01',
  };
  beforeEach(() => jest.clearAllMocks());
  it('attributes a check to staff in the current club', async () => {
    const result = await repository.create({ ...dto, user_id: 'staff-a' }, 'officer-a');
    expect(result).toMatchObject({
      club_id: 'club-a',
      user_id: 'staff-a',
      created_by_user_id: 'officer-a',
    });
  });
  it.each(['staff-b', 'missing'])('rejects %s before creating any check', async (user_id) => {
    await expect(repository.create({ ...dto, user_id }, 'officer-a')).rejects.toThrow(
      'Staff member not found',
    );
    expect(raw.save).not.toHaveBeenCalled();
  });
});
