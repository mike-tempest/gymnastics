/**
 * Test-only harness for the export module. Not imported by any runtime code.
 *
 * It builds an in-memory stand-in for the DataSource the ExportService reads
 * through: fake repositories that carry just enough TypeORM metadata for the
 * service's column discovery, and a `find` that actually honours the
 * `club_id` merged into the where clause by TenantScopedHelper. Honouring it
 * is the whole point: a fake that ignored the filter would let a cross-tenant
 * bug pass the isolation spec.
 */
import { unzipSync } from 'fflate';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

import { CLS_CLUB_ID_KEY } from '../../common/tenancy/tenant-context.service';

/** Minimal in-memory ClsService, matching the other tenancy specs. */
export class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  setClub(clubId: string): void {
    this.set(CLS_CLUB_ID_KEY, clubId);
  }
}

/** Records the audit entries the export writes, without touching a database. */
export class FakeAuditLogsService {
  readonly entries: ObjectLiteral[] = [];

  async log(dto: ObjectLiteral): Promise<ObjectLiteral> {
    this.entries.push(dto);
    return dto;
  }
}

/** One faked table: its column names, its primary key and its rows. */
export interface FakeTable {
  columns: readonly string[];
  primaryKey: string;
  rows: ObjectLiteral[];
  /** Database table name, needed only when a spec exercises schema drift. */
  tableName?: string;
  /**
   * Raw rows served by createQueryBuilder().getRawMany(), used for the
   * squad_members join table, which has no entity of its own. Each row needs
   * a `club_id` so the fake can honour the scoped builder's predicate.
   */
  rawRows?: ObjectLiteral[];
}

/** Every `where` clause the fake repositories were asked to run. */
export type WhereLog = ObjectLiteral[];

function matches(row: ObjectLiteral, where: ObjectLiteral): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function buildRepository(table: FakeTable, whereLog: WhereLog): Repository<ObjectLiteral> {
  const columnMetadata = table.columns.map((name) => ({
    propertyName: name,
    databaseName: name,
    propertyPath: name,
    getEntityValue: (row: ObjectLiteral) => row[name],
  }));

  const project = (row: ObjectLiteral, select?: string[]): ObjectLiteral => {
    const keep = select ?? [...table.columns];
    const projected: ObjectLiteral = {};
    for (const key of keep) projected[key] = row[key];
    return projected;
  };

  const repo = {
    metadata: {
      tableName: table.tableName ?? 'unnamed_fake_table',
      columns: columnMetadata,
      primaryColumns: columnMetadata.filter((column) => column.propertyName === table.primaryKey),
    },
    find: async (options: ObjectLiteral = {}) => {
      whereLog.push(options.where as ObjectLiteral);
      const filtered = table.rows.filter((row) =>
        matches(row, (options.where ?? {}) as ObjectLiteral),
      );
      const sorted = [...filtered].sort((left, right) =>
        String(left[table.primaryKey]).localeCompare(String(right[table.primaryKey])),
      );
      const skip = (options.skip as number) ?? 0;
      const take = (options.take as number) ?? sorted.length;
      return sorted.slice(skip, skip + take).map((row) => project(row, options.select as string[]));
    },
    findOne: async (options: ObjectLiteral = {}) => {
      whereLog.push(options.where as ObjectLiteral);
      const found = table.rows.find((row) => matches(row, (options.where ?? {}) as ObjectLiteral));
      return found ? project(found, options.select as string[]) : null;
    },
    createQueryBuilder: () => buildQueryBuilder(table.rawRows ?? [], whereLog),
  };

  return repo as unknown as Repository<ObjectLiteral>;
}

/**
 * A chainable stand-in for SelectQueryBuilder covering the calls the squad
 * roster query makes. Like the repository fake it actually applies the
 * `club_id` the scoped builder puts in the where clause, and records it.
 */
function buildQueryBuilder(rawRows: ObjectLiteral[], whereLog: WhereLog) {
  let clubId: string | undefined;
  let limit = Number.MAX_SAFE_INTEGER;
  let offset = 0;

  const builder = {
    where: (_sql: string, params: ObjectLiteral) => {
      clubId = params.clubId as string;
      whereLog.push({ club_id: clubId });
      return builder;
    },
    innerJoin: () => builder,
    select: () => builder,
    addSelect: () => builder,
    orderBy: () => builder,
    addOrderBy: () => builder,
    limit: (value: number) => {
      limit = value;
      return builder;
    },
    offset: (value: number) => {
      offset = value;
      return builder;
    },
    getRawMany: async () => {
      const filtered = rawRows.filter((row) => row.club_id === clubId);
      const sorted = [...filtered].sort(
        (left, right) =>
          String(left.squad_id).localeCompare(String(right.squad_id)) ||
          String(left.member_id).localeCompare(String(right.member_id)),
      );
      return sorted
        .slice(offset, offset + limit)
        .map((row) => ({ squad_id: row.squad_id, member_id: row.member_id }));
    },
  };

  return builder;
}

export interface FakeDataSourceResult {
  dataSource: DataSource;
  /** Every where clause any repository was asked to run, in call order. */
  whereLog: WhereLog;
}

/**
 * Rows the fake `query()` returns for the information_schema lookup, shaped
 * as {table_name, column_name}. Empty means "no schema information", which is
 * how the service is told to trust the entity metadata instead.
 */
export type LiveColumnRows = Array<{ table_name: string; column_name: string }>;

/**
 * Builds a DataSource whose getRepository() serves the supplied tables.
 * Any entity without an entry gets an empty table with the default columns,
 * so the manifest can grow without every spec having to describe every table.
 */
export function makeFakeDataSource(
  tables: Map<EntityTarget<ObjectLiteral>, FakeTable>,
  liveColumns: LiveColumnRows = [],
  defaults: Omit<FakeTable, 'rows'> = { columns: ['id', 'club_id'], primaryKey: 'id' },
): FakeDataSourceResult {
  const whereLog: WhereLog = [];
  const built = new Map<EntityTarget<ObjectLiteral>, Repository<ObjectLiteral>>();

  const dataSource = {
    getRepository: (entity: EntityTarget<ObjectLiteral>) => {
      const existing = built.get(entity);
      if (existing) return existing;
      const table = tables.get(entity) ?? { ...defaults, rows: [] };
      const repo = buildRepository(table, whereLog);
      built.set(entity, repo);
      return repo;
    },
    query: async () => liveColumns,
  };

  return { dataSource: dataSource as unknown as DataSource, whereLog };
}

/** Unzips an archive built by the service into filename to text. */
export function readArchive(buffer: Buffer): Record<string, string> {
  const entries = unzipSync(new Uint8Array(buffer));
  const files: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(entries)) {
    files[name] = Buffer.from(bytes).toString('utf8');
  }
  return files;
}
