import 'reflect-metadata';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';
import { DBSCheck } from '../compliance/dbs/entities/dbs-check.entity';
import { UsersRepository } from './users.repository';
import { UsersController } from './users.controller';
import { DBSController } from '../compliance/dbs/dbs.controller';
import { CredentialsController } from '../compliance/credentials/credentials.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('Staff directory isolation and compliance permissions', () => {
  let source: MetadataSource;
  beforeAll(async () => {
    source = new MetadataSource({ type: 'postgres', entities: [User, DBSCheck] });
    await source.prepare();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['club-a', 'club-b'])(
    'limits directory SQL to active staff in %s and four public fields',
    async (clubId) => {
      let query = '';
      let parameters: unknown[] = [];
      jest.spyOn(SelectQueryBuilder.prototype, 'getMany').mockImplementation(async function (
        this: SelectQueryBuilder<User>,
      ) {
        [query, parameters] = this.getQueryAndParameters();
        return [];
      });
      const repository = new UsersRepository(source.getRepository(User), {
        getClubId: () => clubId,
      } as TenantContextService);
      await repository.findStaffDirectory();
      expect(query).toContain('"club_id" =');
      expect(query).toContain('"active" =');
      expect(query).toContain('"role" IN');
      expect(parameters).toContain(clubId);
      expect(parameters).toContain(true);
      expect(parameters).toContain(UserRole.WELFARE_OFFICER);
      expect(parameters).not.toContain(UserRole.PARENT);
      expect(parameters).not.toContain(UserRole.MEMBER_ADULT);
      const selected = query.split(' FROM ')[0];
      expect(selected.match(/ AS /g)).toHaveLength(4);
      expect(selected).not.toMatch(/email|password_hash|family_id|club_id|last_login/);
    },
  );

  it('fails closed without a tenant context', async () => {
    const find = jest.spyOn(source.getRepository(User), 'find');
    const repository = new UsersRepository(source.getRepository(User), {
      getClubId: () => {
        throw new Error('Missing tenant');
      },
    } as unknown as TenantContextService);
    await expect(repository.findStaffDirectory()).rejects.toThrow('Missing tenant');
    expect(find).not.toHaveBeenCalled();
  });

  const guard = new RolesGuard(new Reflector());
  function permitted(controller: object, handler: (...args: never[]) => unknown, role: UserRole) {
    return guard.canActivate({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext);
  }

  it.each([UserRole.WELFARE_OFFICER, UserRole.SUPER_ADMIN, UserRole.TREASURER])(
    '%s can select staff and record both kinds of evidence',
    (role) => {
      expect(permitted(UsersController, UsersController.prototype.findStaffDirectory, role)).toBe(
        true,
      );
      expect(permitted(DBSController, DBSController.prototype.create, role)).toBe(true);
      expect(permitted(CredentialsController, CredentialsController.prototype.create, role)).toBe(
        true,
      );
    },
  );
  it.each([
    UserRole.PARENT,
    UserRole.MEMBER_ADULT,
    UserRole.HEAD_COACH,
    UserRole.SQUAD_COACH,
    UserRole.COMPETITION_SECRETARY,
  ])('%s cannot write safeguarding evidence through the coach hierarchy', (role) => {
    expect(permitted(DBSController, DBSController.prototype.create, role)).toBe(false);
    for (const handler of [
      CredentialsController.prototype.create,
      CredentialsController.prototype.update,
      CredentialsController.prototype.remove,
    ]) {
      expect(permitted(CredentialsController, handler, role)).toBe(false);
    }
  });
  it.each([UserRole.PARENT, UserRole.MEMBER_ADULT])(
    '%s cannot read the staff directory',
    (role) => {
      expect(permitted(UsersController, UsersController.prototype.findStaffDirectory, role)).toBe(
        false,
      );
    },
  );
  it('keeps the general user list closed to Welfare Officers', () => {
    expect(
      permitted(UsersController, UsersController.prototype.findAll, UserRole.WELFARE_OFFICER),
    ).toBe(false);
  });
});
