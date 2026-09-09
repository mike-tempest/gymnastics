import 'reflect-metadata';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { User } from './entities/user.entity';
import { DBSCheck } from '../compliance/dbs/entities/dbs-check.entity';
import { UsersRepository } from './users.repository';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

// Build real PostgreSQL query metadata without requiring a running database.
class MetadataDataSource extends DataSource {
  async prepare(): Promise<void> {
    await this.buildMetadatas();
  }
}

describe('Password selection', () => {
  let source: MetadataDataSource;

  beforeAll(async () => {
    source = new MetadataDataSource({
      type: 'postgres',
      entities: [User, DBSCheck],
    });
    await source.prepare();
  });

  afterEach(() => jest.restoreAllMocks());

  it('omits hashes from ordinary user reads', () => {
    const sql = source.getRepository(User).createQueryBuilder('user').getSql();
    expect(sql).toContain('"user"."email"');
    expect(sql).not.toContain('password_hash');
  });

  it.each(['join', 'query'] as const)(
    'omits hashes from DBS user relations with the %s loading strategy',
    (relationLoadStrategy) => {
      const sql = source
        .getRepository(DBSCheck)
        .createQueryBuilder('check')
        .setFindOptions({ relations: ['user'], relationLoadStrategy })
        .getSql();
      expect(sql).not.toContain('password_hash');
      if (relationLoadStrategy === 'join') expect(sql).toContain('."email"');
    },
  );

  it('explicitly selects credentials only for the parameterised login lookup', async () => {
    let sql: string | undefined;
    let parameters: Record<string, unknown> | undefined;
    jest.spyOn(SelectQueryBuilder.prototype, 'getOne').mockImplementation(async function (
      this: SelectQueryBuilder<User>,
    ) {
      sql = this.getSql();
      parameters = this.getParameters();
      return null;
    });
    const repository = new UsersRepository(source.getRepository(User), {} as TenantContextService);
    const email = "person'@example.com";
    expect(await repository.findCredentialsByEmail(email)).toBeNull();
    expect(sql).toContain('"user"."password_hash"');
    expect(sql).toContain('"user"."email" = $1');
    expect(parameters).toEqual({ email });
  });

  it('still includes the hash in inserts and password updates', () => {
    const repository = source.getRepository(User);
    const insert = repository.createQueryBuilder().insert().values({ password_hash: 'hash' });
    const update = repository
      .createQueryBuilder()
      .update()
      .set({ password_hash: 'replacement' })
      .where('user_id = :id', { id: 'user-id' });
    expect(insert.getSql()).toContain('"password_hash"');
    expect(insert.getQueryAndParameters()[1]).toContain('hash');
    expect(update.getSql()).toContain('"password_hash" =');
    expect(update.getQueryAndParameters()[1]).toContain('replacement');
  });
});
