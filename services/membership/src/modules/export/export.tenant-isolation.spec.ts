import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { EntityTarget, ObjectLiteral } from 'typeorm';

import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { Club } from '../clubs/entities/club.entity';
import { Consent } from '../compliance/consents/entities/consent.entity';
import { Family } from '../families/entities/family.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { Member } from '../members/entities/member.entity';
import { Squad } from '../squads/entities/squad.entity';
import { User } from '../users/entities/user.entity';
import { EXPORT_FILES } from './export.manifest';
import { ExportService } from './export.service';
import {
  FakeAuditLogsService,
  FakeClsService,
  FakeTable,
  makeFakeDataSource,
  readArchive,
} from './export.test-harness';

/**
 * Cross-tenant isolation test for the full club data export (TEM-31).
 *
 * This is the single most important property of the feature. The export
 * touches every tenant-owned table at once, so one unscoped read here would
 * hand one club another club's medical notes, safeguarding records and
 * contact details in a single file a club is invited to download.
 *
 * It drives the real ExportService through the real TenantScopedHelper and
 * TenantContextService, over fake repositories that genuinely honour the
 * `club_id` merged into the where clause, and then unzips the archive the
 * service produced and reads every byte of it. The assertions prove:
 *
 *  - every table read carries `club_id = getClubId()`
 *  - no club B identifier or value appears anywhere in club A's archive
 *  - the club record, which is the tenant root and has no club_id column, is
 *    still fetched by the tenant's own primary key
 *  - redacted columns are neither selected nor written
 */

const CLUB_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** Values that must never cross from club B's rows into club A's archive. */
const CLUB_B_MARKERS = [
  CLUB_B,
  'member-in-club-b',
  'Bramwell',
  'family-in-club-b',
  'parent-b@example.invalid',
  'user-in-club-b',
  'invoice-in-club-b',
  'INV-B-0001',
  'consent-in-club-b',
  'Fairbourne Gymnastics',
  'fairbourne',
  'squad-in-club-b',
];

function table(columns: string[], primaryKey: string, rows: ObjectLiteral[]): FakeTable {
  return { columns, primaryKey, rows };
}

function buildTables(): Map<EntityTarget<ObjectLiteral>, FakeTable> {
  return new Map<EntityTarget<ObjectLiteral>, FakeTable>([
    [
      Club,
      table('id,name,slug,contact_email'.split(','), 'id', [
        {
          id: CLUB_A,
          name: 'Kestrel Vale Gymnastics',
          slug: 'kestrel-vale',
          contact_email: 'office@kestrelvale.example.invalid',
        },
        {
          id: CLUB_B,
          name: 'Fairbourne Gymnastics',
          slug: 'fairbourne',
          contact_email: 'office@fairbourne.example.invalid',
        },
      ]),
    ],
    [
      Member,
      table('member_id,club_id,first_name,last_name,medical_notes'.split(','), 'member_id', [
        {
          member_id: 'member-in-club-a-1',
          club_id: CLUB_A,
          first_name: 'Ava',
          last_name: 'Nolan',
          medical_notes: 'Mild asthma',
        },
        {
          member_id: 'member-in-club-a-2',
          club_id: CLUB_A,
          first_name: 'Ben',
          last_name: 'Okafor',
          medical_notes: null,
        },
        {
          member_id: 'member-in-club-b',
          club_id: CLUB_B,
          first_name: 'Cara',
          last_name: 'Bramwell',
          medical_notes: 'Nut allergy',
        },
      ]),
    ],
    [
      Family,
      table(
        'family_id,club_id,family_name,primary_contact_email,invite_token'.split(','),
        'family_id',
        [
          {
            family_id: 'family-in-club-a',
            club_id: CLUB_A,
            family_name: 'Nolan',
            primary_contact_email: 'parent-a@example.invalid',
            invite_token: 'secret-token-club-a',
          },
          {
            family_id: 'family-in-club-b',
            club_id: CLUB_B,
            family_name: 'Bramwell',
            primary_contact_email: 'parent-b@example.invalid',
            invite_token: 'secret-token-club-b',
          },
        ],
      ),
    ],
    [
      User,
      table('user_id,club_id,email,password_hash,role'.split(','), 'user_id', [
        {
          user_id: 'user-in-club-a',
          club_id: CLUB_A,
          email: 'admin-a@example.invalid',
          password_hash: '$2b$10$clubAhashclubAhashclubAhash',
          role: 'super_admin',
        },
        {
          user_id: 'user-in-club-b',
          club_id: CLUB_B,
          email: 'admin-b@example.invalid',
          password_hash: '$2b$10$clubBhashclubBhashclubBhash',
          role: 'super_admin',
        },
      ]),
    ],
    [
      Invoice,
      table('invoice_id,club_id,invoice_number,total_amount'.split(','), 'invoice_id', [
        {
          invoice_id: 'invoice-in-club-a',
          club_id: CLUB_A,
          invoice_number: 'INV-A-0001',
          total_amount: 45.5,
        },
        {
          invoice_id: 'invoice-in-club-b',
          club_id: CLUB_B,
          invoice_number: 'INV-B-0001',
          total_amount: 99.99,
        },
      ]),
    ],
    [
      Squad,
      {
        columns: ['squad_id', 'club_id', 'squad_name'],
        primaryKey: 'squad_id',
        rows: [
          { squad_id: 'squad-in-club-a', club_id: CLUB_A, squad_name: 'Explore 3' },
          { squad_id: 'squad-in-club-b', club_id: CLUB_B, squad_name: 'Discover 1' },
        ],
        // The squad roster join table, which is scoped through its squad.
        rawRows: [
          { club_id: CLUB_A, squad_id: 'squad-in-club-a', member_id: 'member-in-club-a-1' },
          { club_id: CLUB_B, squad_id: 'squad-in-club-b', member_id: 'member-in-club-b' },
        ],
      },
    ],
    [
      Consent,
      table('consent_id,club_id,member_id,consent_type,status'.split(','), 'consent_id', [
        {
          consent_id: 'consent-in-club-a',
          club_id: CLUB_A,
          member_id: 'member-in-club-a-1',
          consent_type: 'PHOTOGRAPHY',
          status: 'GRANTED',
        },
        {
          consent_id: 'consent-in-club-b',
          club_id: CLUB_B,
          member_id: 'member-in-club-b',
          consent_type: 'PHOTOGRAPHY',
          status: 'GRANTED',
        },
      ]),
    ],
  ]);
}

describe('ExportService tenant isolation', () => {
  let service: ExportService;
  let cls: FakeClsService;
  let whereLog: ObjectLiteral[];

  beforeEach(async () => {
    const fake = makeFakeDataSource(buildTables());
    whereLog = fake.whereLog;
    cls = new FakeClsService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getDataSourceToken(), useValue: fake.dataSource },
        { provide: AuditLogsService, useValue: new FakeAuditLogsService() },
      ],
    }).compile();

    service = moduleRef.get(ExportService);
  });

  it('exports only the calling club and never a row belonging to another', async () => {
    cls.setClub(CLUB_A);

    const { buffer } = await service.buildClubExport();
    const files = readArchive(buffer);
    const everything = Object.values(files).join('\n');

    for (const marker of CLUB_B_MARKERS) {
      expect(everything).not.toContain(marker);
    }

    expect(files['members.csv']).toContain('Ava,Nolan');
    expect(files['members.csv']).toContain('Ben,Okafor');
    expect(files['invoices.csv']).toContain('INV-A-0001');
    expect(files['consents.csv']).toContain('consent-in-club-a');
    // The squad roster is scoped through its squad rather than a club_id of
    // its own, so it gets its own assertion.
    expect(files['squad-members.csv']).toBe(
      'squad_id,member_id\nsquad-in-club-a,member-in-club-a-1\n',
    );
  });

  it('reads the club record by the tenant primary key, not by whichever row comes first', async () => {
    cls.setClub(CLUB_A);

    const { buffer } = await service.buildClubExport();
    const files = readArchive(buffer);

    expect(files['club.csv']).toContain('Kestrel Vale Gymnastics');
    expect(files['club.csv']).not.toContain('Fairbourne');
    // Exactly one club row: the header plus one line plus the trailing newline.
    expect(files['club.csv'].trimEnd().split('\n')).toHaveLength(2);
    expect(whereLog).toContainEqual({ id: CLUB_A });
  });

  it('scopes every table read to the active club', async () => {
    cls.setClub(CLUB_A);

    await service.buildClubExport();

    // Every read except the tenant root's own lookup carries the club filter.
    const scopedReads = whereLog.filter((where) => !('id' in where && where.id === CLUB_A));
    expect(scopedReads.length).toBeGreaterThanOrEqual(EXPORT_FILES.length);
    for (const where of scopedReads) {
      expect(where).toEqual({ club_id: CLUB_A });
    }
  });

  it('gives club B its own data and nothing of club A', async () => {
    cls.setClub(CLUB_B);

    const { buffer } = await service.buildClubExport();
    const files = readArchive(buffer);
    const everything = Object.values(files).join('\n');

    expect(files['members.csv']).toContain('Cara,Bramwell');
    expect(everything).not.toContain('member-in-club-a-1');
    expect(everything).not.toContain('Nolan');
    expect(everything).not.toContain('INV-A-0001');
    expect(everything).not.toContain('Kestrel Vale');
  });

  it('refuses to build an export with no tenant in context', async () => {
    await expect(service.buildClubExport()).rejects.toThrow(/tenant context/i);
  });

  it('never selects or writes a redacted column', async () => {
    cls.setClub(CLUB_A);

    const { buffer } = await service.buildClubExport();
    const files = readArchive(buffer);
    const everything = Object.values(files).join('\n');

    // The values themselves are absent, and so are the column headings, so
    // nobody reading the archive thinks the columns were merely blank.
    expect(everything).not.toContain('password_hash');
    expect(everything).not.toContain('clubAhash');
    expect(everything).not.toContain('invite_token');
    expect(everything).not.toContain('secret-token-club-a');

    // The surrounding rows are still exported in full.
    expect(files['users.csv']).toContain('admin-a@example.invalid');
    expect(files['families.csv']).toContain('parent-a@example.invalid');
  });
});
