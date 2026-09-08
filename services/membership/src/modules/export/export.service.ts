import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { zip } from 'fflate';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';

import { csvBodyLine, csvHeaderLine, CsvValue } from '../../common/csv/csv-writer';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { AuditAction, AuditEntityType } from '../compliance/audit-logs/entities/audit-log.entity';
import { Club } from '../clubs/entities/club.entity';
import { Squad } from '../squads/entities/squad.entity';
import { EXPORT_FILES, ExportFileSpec } from './export.manifest';

/**
 * Rows read from the database in one go. Small enough that a wide table does
 * not spike memory, large enough that a 20,000-row register is four queries.
 */
const PAGE_SIZE = 2_000;

/**
 * Hard cap on the rows written to any single CSV.
 *
 * The archive is assembled in memory, in the same way the invoice PDF path
 * buffers, so it has to be bounded rather than merely large. A club that hits
 * this in a table is told so, by name, in README.txt, rather than being handed
 * a file that is quietly short.
 */
export const MAX_ROWS_PER_FILE = 200_000;

/**
 * Hard cap on the total uncompressed CSV text held in memory for one export.
 * At 64 MiB an average club's whole history fits many times over, while a
 * pathological one cannot exhaust the service.
 */
export const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

/** Wording used in README.txt when the whole-archive budget cut a file short. */
const SIZE_LIMIT_REASON = 'the size limit for one export';

/**
 * The columns the live database has, by table name, or null when that could
 * not be established and the entity metadata should simply be trusted.
 */
type LiveColumns = Map<string, Set<string>> | null;

/** Who asked for the export, recorded in the audit trail. */
export interface ExportRequester {
  userId?: string;
  userEmail?: string;
}

/**
 * A CSV built for the archive, plus what had to be left out of it.
 *
 * The content is held as encoded bytes rather than a string so the text is
 * released as soon as each file is finished, instead of every file's string
 * and its buffer being live at once when the archive is zipped.
 */
interface BuiltFile {
  filename: string;
  bytes: Buffer;
  rowCount: number;
  /** Set when the row cap or the byte budget stopped the file short. */
  truncatedBecause?: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Builds the club's whole record as a ZIP of CSVs.
   *
   * Every table is read through TenantScopedHelper, which injects
   * `club_id = <active tenant>` into the query, so the archive can only ever
   * hold the caller's own club. The single exception is the club record
   * itself, which is the tenant root and is read by primary key from the same
   * tenant context (see buildClubCsv).
   */
  async buildClubExport(
    downloadedBy: ExportRequester = {},
  ): Promise<{ buffer: Buffer; filename: string }> {
    const clubId = this.tenantContext.getClubId();
    const generatedAt = new Date();

    const files: BuiltFile[] = [];
    let bytesUsed = 0;

    const liveColumns = await this.loadLiveColumns();

    const club = await this.buildClubCsv(liveColumns);
    files.push(club);
    bytesUsed += club.bytes.length;

    for (const spec of EXPORT_FILES) {
      const built = await this.buildFile(spec, MAX_TOTAL_BYTES - bytesUsed, liveColumns);
      files.push(built);
      bytesUsed += built.bytes.length;
    }

    const squadMembers = await this.buildSquadMembersCsv(MAX_TOTAL_BYTES - bytesUsed);
    files.push(squadMembers);

    const archive: Record<string, Uint8Array> = {
      'README.txt': Buffer.from(this.buildReadme(files, generatedAt), 'utf8'),
    };
    for (const file of files) {
      archive[file.filename] = file.bytes;
    }

    const buffer = await this.compress(archive);
    const rowCount = files.reduce((total, file) => total + file.rowCount, 0);

    this.logger.log(
      `Club export built for club ${clubId}: ${files.length} files, ` +
        `${rowCount} rows, ${buffer.length} compressed bytes`,
    );

    // A bulk copy of every medical note, background check and safeguarding
    // record is the most sensitive read in the product. The global
    // AuditInterceptor skips GETs, so this route records itself.
    if (downloadedBy.userId) {
      await this.auditLogs
        .log({
          club_id: clubId,
          user_id: downloadedBy.userId,
          // audit_logs.user_email is NOT NULL, so it comes from the request
          // rather than being looked up again.
          user_email: downloadedBy.userEmail,
          action: AuditAction.EXPORT,
          entity_type: AuditEntityType.CLUB,
          entity_id: clubId,
          description: `Downloaded a full club data export (${files.length} files, ${rowCount} rows)`,
        })
        .catch((error: unknown) => {
          // Never fail the download because the trail could not be written.
          this.logger.error(
            `Could not record the club export in the audit log: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
    }

    return { buffer, filename: this.archiveName(generatedAt) };
  }

  /**
   * Deflates the archive off the event loop.
   *
   * fflate's async zip hands the work to a worker, so a large export does not
   * stall every other tenant's requests for the duration of the compression.
   */
  private compress(archive: Record<string, Uint8Array>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zip(archive, { level: 6 }, (error, zipped) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(Buffer.from(zipped.buffer, zipped.byteOffset, zipped.byteLength));
      });
    });
  }

  /**
   * The club record itself.
   *
   * `clubs` is the tenant root: it has no `club_id` column, so
   * TenantScopedHelper cannot scope it and would build an invalid predicate.
   * Reading it by primary key from the same tenant context is equivalent, and
   * returns exactly one row by construction.
   */
  private async buildClubCsv(liveColumns: LiveColumns): Promise<BuiltFile> {
    const repo = this.dataSource.getRepository(Club);
    const columns = this.columnsFor(repo, [], liveColumns);
    const club = await repo.findOne({
      where: { id: this.tenantContext.getClubId() },
      select: columns.map((column) => column.propertyName) as (keyof Club)[],
    });

    const lines = [csvHeaderLine(columns.map((column) => column.databaseName))];
    if (club) {
      lines.push(
        csvBodyLine(
          columns.map((c) => c.databaseName),
          this.toRecord(columns, club),
        ),
      );
    }

    return {
      filename: 'club.csv',
      bytes: Buffer.from(`${lines.join('\n')}\n`, 'utf8'),
      rowCount: club ? 1 : 0,
    };
  }

  /**
   * Which gymnasts are in which squads.
   *
   * `squad_members` is the only club-scoped table with no `club_id` of its
   * own: it is scoped through its squad, and TypeORM models it as a join
   * table rather than an entity, so it has no manifest entry. Without this
   * file a club that exported and left would have its squads and its
   * gymnasts but no way to say who trained where, which is exactly the kind
   * of quiet gap this feature exists to rule out.
   *
   * The rows are read through scopedQueryBuilder on `squads`, so the same
   * `club_id = <active tenant>` predicate applies as everywhere else.
   */
  private async buildSquadMembersCsv(byteBudget: number): Promise<BuiltFile> {
    const headers = ['squad_id', 'member_id'];
    const lines = [csvHeaderLine(headers)];
    let bytes = Buffer.byteLength(lines[0]) + 1;
    let rowCount = 0;
    let truncatedBecause: string | undefined;

    const squadRepo = this.dataSource.getRepository(Squad);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page: ObjectLiteral[] = await this.scoped
        .scopedQueryBuilder(squadRepo, 'squad')
        .innerJoin('squad.members', 'member')
        .select('squad.squad_id', 'squad_id')
        .addSelect('member.member_id', 'member_id')
        .orderBy('squad.squad_id', 'ASC')
        .addOrderBy('member.member_id', 'ASC')
        .limit(PAGE_SIZE)
        .offset(offset)
        .getRawMany();

      for (const row of page) {
        if (rowCount >= MAX_ROWS_PER_FILE) {
          truncatedBecause = this.rowLimitReason();
          break;
        }
        const line = csvBodyLine(headers, row);
        const lineBytes = Buffer.byteLength(line) + 1;
        if (bytes + lineBytes > byteBudget) {
          truncatedBecause = SIZE_LIMIT_REASON;
          break;
        }
        lines.push(line);
        bytes += lineBytes;
        rowCount++;
      }

      if (truncatedBecause || page.length < PAGE_SIZE) break;
    }

    return {
      filename: 'squad-members.csv',
      bytes: Buffer.from(`${lines.join('\n')}\n`, 'utf8'),
      rowCount,
      truncatedBecause,
    };
  }

  /** Reads one manifest entry into a CSV, paging so a big table is not held twice. */
  private async buildFile(
    spec: ExportFileSpec,
    byteBudget: number,
    liveColumns: LiveColumns,
  ): Promise<BuiltFile> {
    const repo = this.dataSource.getRepository(spec.entity);
    const columns = this.columnsFor(repo, spec.omit ?? [], liveColumns);
    const headers = columns.map((column) => column.databaseName);
    const select = columns.map((column) => column.propertyName);
    // Paging needs a stable sort, and the primary key is the one column every
    // one of these tables has and never changes.
    const orderBy = repo.metadata.primaryColumns[0].propertyName;

    const lines = [csvHeaderLine(headers)];
    let bytes = Buffer.byteLength(lines[0]) + 1;
    let rowCount = 0;
    let truncatedBecause: string | undefined;

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.scoped.scopedFind(repo, {
        select,
        order: { [orderBy]: 'ASC' },
        take: PAGE_SIZE,
        skip: offset,
      });

      for (const row of page) {
        if (rowCount >= MAX_ROWS_PER_FILE) {
          truncatedBecause = this.rowLimitReason();
          break;
        }
        const line = csvBodyLine(headers, this.toRecord(columns, row));
        const lineBytes = Buffer.byteLength(line) + 1;
        if (bytes + lineBytes > byteBudget) {
          truncatedBecause = SIZE_LIMIT_REASON;
          break;
        }
        lines.push(line);
        bytes += lineBytes;
        rowCount++;
      }

      if (truncatedBecause || page.length < PAGE_SIZE) break;
    }

    return {
      filename: spec.filename,
      bytes: Buffer.from(`${lines.join('\n')}\n`, 'utf8'),
      rowCount,
      truncatedBecause,
    };
  }

  /** Wording used in README.txt when a single file hit the row cap. */
  private rowLimitReason(): string {
    return `the ${MAX_ROWS_PER_FILE.toLocaleString('en-GB')} row limit for a single file`;
  }

  /**
   * The columns to export for an entity, taken from TypeORM's own metadata so
   * a column added later is exported without anyone having to remember to add
   * it here. Omitted columns are dropped before the SELECT is built, so they
   * are never read out of the database at all.
   *
   * Columns reached through a relation (a dotted property path) are skipped:
   * every entity in the manifest declares its foreign keys as plain columns,
   * which is what a club needs in order to join the CSVs back together.
   *
   * A column an entity declares but the database does not have is skipped
   * too, and logged. Selecting one would fail the query and cost the club its
   * whole export over a single drifted column in one unrelated table.
   */
  private columnsFor(
    repo: Repository<ObjectLiteral>,
    omit: readonly string[],
    liveColumns: LiveColumns,
  ): Array<{ propertyName: string; databaseName: string; read: (row: ObjectLiteral) => unknown }> {
    const seen = new Set<string>();
    const tableName = repo.metadata.tableName;
    const live = liveColumns?.get(tableName);

    return repo.metadata.columns
      .filter((column) => !column.propertyPath.includes('.'))
      .filter((column) => !omit.includes(column.propertyName))
      .filter((column) => !omit.includes(column.databaseName))
      .filter((column) => {
        if (!live || live.has(column.databaseName)) return true;
        this.logger.warn(
          `Skipping ${tableName}.${column.databaseName} in the club export: the entity ` +
            'declares the column but the database does not have it.',
        );
        return false;
      })
      .filter((column) => {
        if (seen.has(column.databaseName)) return false;
        seen.add(column.databaseName);
        return true;
      })
      .map((column) => ({
        propertyName: column.propertyName,
        databaseName: column.databaseName,
        read: (row: ObjectLiteral) => column.getEntityValue(row),
      }));
  }

  /**
   * The columns the database actually has, by table name.
   *
   * The entities and the schema can drift: a column declared on an entity
   * with no migration behind it exists in TypeScript and nowhere else, and
   * selecting it fails the query. Everything else in the service reads only
   * what a club is entitled to, so nothing here is tenant-specific.
   *
   * Returns null when the lookup yields nothing, which is the case in unit
   * tests with no database; the caller then trusts the entity metadata.
   */
  private async loadLiveColumns(): Promise<LiveColumns> {
    const rows: Array<{ table_name: string; column_name: string }> = await this.dataSource.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = current_schema()`,
    );

    if (!rows?.length) return null;

    const byTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = byTable.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      byTable.set(row.table_name, columns);
    }
    return byTable;
  }

  /** Reads one entity into a plain record keyed by database column name. */
  private toRecord(
    columns: ReturnType<ExportService['columnsFor']>,
    row: ObjectLiteral,
  ): Record<string, CsvValue> {
    const record: Record<string, CsvValue> = {};
    for (const column of columns) {
      record[column.databaseName] = column.read(row) as CsvValue;
    }
    return record;
  }

  /** The plain-English note that opens the archive. */
  private buildReadme(files: BuiltFile[], generatedAt: Date): string {
    const descriptions = new Map(EXPORT_FILES.map((spec) => [spec.filename, spec.description]));
    descriptions.set('club.csv', 'The club record: name, affiliation, tax and regional settings.');
    descriptions.set(
      'squad-members.csv',
      'Which gymnasts are in which squads. Join it to squads.csv and members.csv.',
    );

    const contents = files.map((file) => {
      const rows = `${file.rowCount.toLocaleString('en-GB')} row${file.rowCount === 1 ? '' : 's'}`;
      return `  ${file.filename} (${rows})\n    ${descriptions.get(file.filename) ?? ''}`;
    });

    const truncated = files.filter((file) => file.truncatedBecause);
    const truncationNote = truncated.length
      ? [
          '',
          'TRUNCATED FILES',
          'These files were cut short. Ask us and we will get you the rest.',
          ...truncated.map((file) => `  ${file.filename}: stopped at ${file.truncatedBecause}.`),
        ]
      : [];

    return [
      'YOUR CLUB DATA',
      '',
      `Exported ${generatedAt.toISOString()}.`,
      '',
      'This is your data. It is exported in full, as plain CSV, with no charge and',
      'no request required. Every file opens in Excel, Numbers, LibreOffice or any',
      'other spreadsheet, and the identifier columns let you join the files back',
      'together exactly as they are stored here.',
      '',
      'Text that a spreadsheet would otherwise treat as a formula is prefixed with',
      'an apostrophe. The spreadsheet removes it on opening, so what you see is the',
      'value as it was entered.',
      '',
      'CONTENTS',
      ...contents,
      '',
      'NOT INCLUDED',
      '  Passwords. Only irreversible hashes are stored and they are of no use to',
      '  anyone, so they are left out.',
      '  The links inside invitation and offer emails. Those are single-use',
      '  secrets rather than records. The invitations and offers themselves are',
      '  in family-invites.csv and waiting-list-offers.csv, minus the link.',
      '  Wellbeing and cycle logs. These are health records that gymnasts enter',
      '  for themselves. Who may read them in bulk is a decision for your club to',
      '  make with us, not something a general export should assume.',
      '  Access logs. An operational trail of who viewed what, not club records.',
      '  Marketing unsubscribes. That list is held per email address across the',
      "  whole product, not per club, so it is not one club's data to take.",
      '  Payment provider account status. That lives in your own provider',
      '  dashboard, which is your account rather than ours.',
      ...truncationNote,
      '',
    ].join('\n');
  }

  /** `club-data-export-2026-09-08.zip`. */
  private archiveName(generatedAt: Date): string {
    return `club-data-export-${generatedAt.toISOString().slice(0, 10)}.zip`;
  }
}
