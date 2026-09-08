import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { EntityTarget, ObjectLiteral } from 'typeorm';

import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { Club } from '../clubs/entities/club.entity';
import { Member } from '../members/entities/member.entity';
import { Squad } from '../squads/entities/squad.entity';
import { EXPORT_FILES } from './export.manifest';
import { ExportService, MAX_ROWS_PER_FILE } from './export.service';
import {
  FakeAuditLogsService,
  FakeClsService,
  FakeTable,
  LiveColumnRows,
  makeFakeDataSource,
  readArchive,
} from './export.test-harness';

const CLUB_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const CLUB_ROW = {
  id: CLUB_A,
  name: 'Kestrel Vale Gymnastics',
  slug: 'kestrel-vale',
  programme_flags: ['pre_school', 'parkour'],
  created_at: new Date('2026-01-04T09:00:00.000Z'),
  tax_rate: null,
};

const CLUB_TABLE: FakeTable = {
  columns: ['id', 'name', 'slug', 'programme_flags', 'created_at', 'tax_rate'],
  primaryKey: 'id',
  rows: [CLUB_ROW],
};

function memberTable(rows: ObjectLiteral[]): FakeTable {
  return {
    columns: ['member_id', 'club_id', 'first_name', 'last_name', 'dob'],
    primaryKey: 'member_id',
    rows,
  };
}

/** Collects entity/table pairs into the map the fake DataSource expects. */
function tables(
  ...entries: Array<[EntityTarget<ObjectLiteral>, FakeTable]>
): Map<EntityTarget<ObjectLiteral>, FakeTable> {
  return new Map(entries);
}

async function buildService(
  seeded: Map<EntityTarget<ObjectLiteral>, FakeTable>,
  liveColumns: LiveColumnRows = [],
): Promise<{ service: ExportService; audit: FakeAuditLogsService }> {
  const fake = makeFakeDataSource(seeded, liveColumns);
  const cls = new FakeClsService();
  cls.setClub(CLUB_A);
  const audit = new FakeAuditLogsService();

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ExportService,
      TenantScopedHelper,
      TenantContextService,
      { provide: ClsService, useValue: cls },
      { provide: getDataSourceToken(), useValue: fake.dataSource },
      { provide: AuditLogsService, useValue: audit },
    ],
  }).compile();

  return { service: moduleRef.get(ExportService), audit };
}

describe('ExportService', () => {
  it('writes one CSV per manifest entry, plus the club record and a README', async () => {
    const { service } = await buildService(tables([Club, CLUB_TABLE]));

    const { buffer } = await service.buildClubExport();
    const files = readArchive(buffer);

    expect(Object.keys(files).sort()).toEqual(
      [
        'README.txt',
        'club.csv',
        'squad-members.csv',
        ...EXPORT_FILES.map((spec) => spec.filename),
      ].sort(),
    );
  });

  it('exports the squad roster, which has no entity of its own', async () => {
    const { service } = await buildService(
      tables(
        [Club, CLUB_TABLE],
        [
          Squad,
          {
            columns: ['squad_id', 'club_id', 'squad_name'],
            primaryKey: 'squad_id',
            rows: [{ squad_id: 'squad-1', club_id: CLUB_A, squad_name: 'Explore 3' }],
            rawRows: [
              { club_id: CLUB_A, squad_id: 'squad-1', member_id: 'member-2' },
              { club_id: CLUB_A, squad_id: 'squad-1', member_id: 'member-1' },
              { club_id: 'another-club', squad_id: 'squad-9', member_id: 'member-9' },
            ],
          },
        ],
      ),
    );

    const files = readArchive((await service.buildClubExport()).buffer);

    expect(files['squad-members.csv']).toBe(
      'squad_id,member_id\nsquad-1,member-1\nsquad-1,member-2\n',
    );
  });

  it('names the archive by the day it was taken', async () => {
    const { service } = await buildService(tables([Club, CLUB_TABLE]));

    const { filename } = await service.buildClubExport();

    expect(filename).toMatch(/^club-data-export-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it('writes an empty table as a header row rather than an empty file', async () => {
    const { service } = await buildService(tables([Club, CLUB_TABLE], [Member, memberTable([])]));

    const files = readArchive((await service.buildClubExport()).buffer);

    expect(files['members.csv']).toBe('member_id,club_id,first_name,last_name,dob\n');
  });

  it('renders dates, jsonb and nulls in a form a spreadsheet can read', async () => {
    const { service } = await buildService(tables([Club, CLUB_TABLE]));

    const files = readArchive((await service.buildClubExport()).buffer);
    const [, row] = files['club.csv'].trimEnd().split('\n');

    // jsonb as JSON, the date in full ISO 8601, and a null as an empty cell.
    expect(row).toContain('"[""pre_school"",""parkour""]"');
    expect(row).toContain('2026-01-04T09:00:00.000Z');
    expect(row.endsWith(',')).toBe(true);
  });

  it('guards a value a spreadsheet would evaluate as a formula', async () => {
    const { service } = await buildService(
      tables(
        [Club, CLUB_TABLE],
        [
          Member,
          memberTable([
            {
              member_id: 'member-1',
              club_id: CLUB_A,
              first_name: '=HYPERLINK("http://evil.example","click")',
              last_name: 'Nolan, Jr',
              dob: '2016-04-02',
            },
          ]),
        ],
      ),
    );

    const files = readArchive((await service.buildClubExport()).buffer);

    expect(files['members.csv']).toContain("'=HYPERLINK");
    expect(files['members.csv']).toContain('"Nolan, Jr"');
  });

  it('pages through a table larger than one query', async () => {
    const rows = Array.from({ length: 4_500 }, (_, index) => ({
      // Padded so the fake repository's lexical sort matches a numeric one.
      member_id: `member-${String(index).padStart(5, '0')}`,
      club_id: CLUB_A,
      first_name: `First${index}`,
      last_name: 'Nolan',
      dob: '2016-04-02',
    }));
    const { service } = await buildService(tables([Club, CLUB_TABLE], [Member, memberTable(rows)]));

    const files = readArchive((await service.buildClubExport()).buffer);
    const lines = files['members.csv'].trimEnd().split('\n');

    expect(lines).toHaveLength(4_501);
    expect(lines[1]).toContain('member-00000');
    expect(lines[4_500]).toContain('member-04499');
  });

  it('tells the club in the README what the archive holds and what it does not', async () => {
    const { service } = await buildService(tables([Club, CLUB_TABLE]));

    const files = readArchive((await service.buildClubExport()).buffer);

    expect(files['README.txt']).toContain('YOUR CLUB DATA');
    for (const spec of EXPORT_FILES) {
      expect(files['README.txt']).toContain(spec.filename);
    }
    expect(files['README.txt']).toContain('Wellbeing and cycle logs');
    expect(files['README.txt']).toContain('Passwords');
    // Nothing was cut short, so no truncation section is written.
    expect(files['README.txt']).not.toContain('TRUNCATED FILES');
  });

  it('keeps the row cap high enough that no real club meets it by accident', () => {
    expect(MAX_ROWS_PER_FILE).toBeGreaterThanOrEqual(100_000);
  });

  it('skips a column the entity declares but the database does not have', async () => {
    // An entity can carry a column no migration ever created. Selecting it
    // fails the query, and one drifted column in one unrelated table must not
    // cost the club its whole export.
    const { service } = await buildService(
      tables([
        Club,
        { ...CLUB_TABLE, tableName: 'clubs', columns: [...CLUB_TABLE.columns, 'never_migrated'] },
      ]),
      [
        { table_name: 'clubs', column_name: 'id' },
        { table_name: 'clubs', column_name: 'name' },
        { table_name: 'clubs', column_name: 'slug' },
        { table_name: 'clubs', column_name: 'programme_flags' },
        { table_name: 'clubs', column_name: 'created_at' },
        { table_name: 'clubs', column_name: 'tax_rate' },
      ],
    );

    const files = readArchive((await service.buildClubExport()).buffer);

    expect(files['club.csv']).not.toContain('never_migrated');
    expect(files['club.csv']).toContain('Kestrel Vale Gymnastics');
  });

  it('records who took the export, because the interceptor does not log reads', async () => {
    const { service, audit } = await buildService(tables([Club, CLUB_TABLE]));

    await service.buildClubExport({ userId: 'user-1', userEmail: 'admin@example.invalid' });

    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      club_id: CLUB_A,
      user_id: 'user-1',
      // audit_logs.user_email is NOT NULL, so a missing email would make the
      // trail fail silently rather than record anything.
      user_email: 'admin@example.invalid',
      action: 'EXPORT',
      entity_type: 'CLUB',
    });
  });

  it('still returns the archive when the audit entry cannot be written', async () => {
    const { service, audit } = await buildService(tables([Club, CLUB_TABLE]));
    jest.spyOn(audit, 'log').mockRejectedValue(new Error('audit table unavailable'));

    const { buffer } = await service.buildClubExport({
      userId: 'user-1',
      userEmail: 'admin@example.invalid',
    });

    expect(readArchive(buffer)['club.csv']).toContain('Kestrel Vale Gymnastics');
  });
});
