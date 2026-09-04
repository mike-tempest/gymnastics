import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { InvoicesRepository } from './invoices.repository';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

/**
 * Cross-tenant isolation test for the invoices repository (Group C, finance).
 *
 * Modelled on src/modules/swimmers/swimmers.tenant-isolation.spec.ts. It drives
 * the real InvoicesRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the TypeORM repositories so no
 * live database is needed. It proves the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id and overrides any supplied club_id
 *  - invoice_items (child rows) are stamped with the active club_id
 *  - update/delete scope the affected-row predicate by club_id
 *
 * It also proves the non-request (webhook / cron) variants do NOT touch the CLS
 * context: they must work with no club in scope and scope by an explicitly
 * supplied club_id derived from the loaded entity.
 */

/** Minimal in-memory fake of ClsService, matching the swimmers reference test. */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

const CLUB_A = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_B = 'club-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const INVOICE_IN_A = 'invoice-1111-in-club-a';
const INVOICE_IN_B = 'invoice-2222-in-club-b';

describe('InvoicesRepository tenant isolation', () => {
  let repo: InvoicesRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repositories were asked to do.
  let findCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let savedInvoices: ObjectLiteral[];
  let savedItems: ObjectLiteral[];

  // A tiny in-memory data set spanning two clubs to prove cross-tenant reads
  // never leak. The fake honours the club_id merged into the where clause.
  const rows: Array<Partial<Invoice>> = [
    {
      invoice_id: INVOICE_IN_A,
      invoice_number: 'INV-A',
      club_id: CLUB_A,
      status: InvoiceStatus.PENDING,
    },
    {
      invoice_id: INVOICE_IN_B,
      invoice_number: 'INV-B',
      club_id: CLUB_B,
      status: InvoiceStatus.PENDING,
    },
  ];

  function matches(row: Partial<Invoice>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof Invoice] === value);
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOneCalls = [];
    updateCalls = [];
    deleteCalls = [];
    savedInvoices = [];
    savedItems = [];

    const fakeInvoiceRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where);
        // Unscoped reads pass `where` undefined or without club_id.
        const where = options.where ?? {};
        return Promise.resolve(rows.filter((r) => matches(r, where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedInvoices.push(entity);
        return Promise.resolve({ invoice_id: 'new-id', ...entity });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        updateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      delete: jest.fn((criteria: ObjectLiteral) => {
        deleteCalls.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
      count: jest.fn(() => Promise.resolve(1)),
    } as unknown as Repository<Invoice>;

    const fakeItemRepo = {
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedItems.push(entity);
        return Promise.resolve({ item_id: 'new-item-id', ...entity });
      }),
    } as unknown as Repository<InvoiceItem>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Invoice), useValue: fakeInvoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: fakeItemRepo },
      ],
    }).compile();

    repo = module.get(InvoicesRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].invoice_id).toBe(INVOICE_IN_A);
    });

    it('findByFamily merges club_id with the family filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByFamily('family-x');

      expect(findCalls[0]).toEqual({ family_id: 'family-x', club_id: CLUB_A });
    });

    it('findByStatus merges club_id with the status filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByStatus(InvoiceStatus.PENDING);

      expect(findCalls[0]).toEqual({ status: InvoiceStatus.PENDING, club_id: CLUB_A });
    });
  });

  describe('findOne behaves as not-found across tenants', () => {
    it('returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(INVOICE_IN_A);

      expect(findOneCalls[0]).toEqual({ invoice_id: INVOICE_IN_A, club_id: CLUB_A });
      expect(result?.invoice_id).toBe(INVOICE_IN_A);
    });

    it('returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // INVOICE_IN_B exists, but not in CLUB_A, so the scoped lookup is null.
      const result = await repo.findOne(INVOICE_IN_B);

      expect(findOneCalls[0]).toEqual({ invoice_id: INVOICE_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('create stamps the context club_id', () => {
    const baseDto: CreateInvoiceDto = {
      family_id: 'family-x',
      due_date: '2026-06-01',
      issued_date: '2026-05-01',
    };

    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.create(baseDto, 'INV-2026-0001');

      expect(savedInvoices[0]).toMatchObject({
        invoice_number: 'INV-2026-0001',
        club_id: CLUB_A,
      });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = { ...baseDto, club_id: CLUB_B } as CreateInvoiceDto & { club_id: string };

      await repo.create(dto, 'INV-2026-0002');

      expect(savedInvoices[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedInvoices[0].club_id).not.toBe(CLUB_B);
    });

    it('stamps invoice_items (child rows) with the active club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createInvoiceItem(INVOICE_IN_A, {
        description: 'Term fees',
        unit_price: 50,
        quantity: 2,
      });

      expect(savedItems[0]).toMatchObject({
        invoice_id: INVOICE_IN_A,
        total: 100,
        club_id: CLUB_A,
      });
    });
  });

  describe('update and delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(INVOICE_IN_A, {
        notes: 'Updated',
        club_id: CLUB_B,
      } as never);

      expect(updateCalls[0].criteria).toEqual({ invoice_id: INVOICE_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ notes: 'Updated' });
    });

    it('updateStatus scopes the criteria by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateStatus(INVOICE_IN_A, InvoiceStatus.PAID);

      expect(updateCalls[0].criteria).toEqual({ invoice_id: INVOICE_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).toEqual({ status: InvoiceStatus.PAID });
    });

    it('updateTotals scopes the criteria by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateTotals(INVOICE_IN_A, 100, 0, 100);

      expect(updateCalls[0].criteria).toEqual({ invoice_id: INVOICE_IN_A, club_id: CLUB_A });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(INVOICE_IN_A);

      expect(deleteCalls[0]).toEqual({ invoice_id: INVOICE_IN_A, club_id: CLUB_A });
    });
  });

  describe('non-request (webhook / cron) variants do not use the CLS context', () => {
    it('findOneUnscoped resolves an invoice for any club with NO club in context', async () => {
      // No cls.set: simulates the GoCardless webhook / cron with no tenant.
      const result = await repo.findOneUnscoped(INVOICE_IN_B);

      // The where clause carries no club_id, so it is not tenant-scoped.
      expect(findOneCalls[0]).toEqual({ invoice_id: INVOICE_IN_B });
      expect(result?.invoice_id).toBe(INVOICE_IN_B);
    });

    it('findByStatusUnscoped returns rows across all clubs with NO club in context', async () => {
      const result = await repo.findByStatusUnscoped(InvoiceStatus.PENDING);

      // Only filtered by status, never by club_id.
      expect(findCalls[0]).toEqual({ status: InvoiceStatus.PENDING });
      expect(result).toHaveLength(2);
    });

    it('updateStatusForClub scopes by the explicitly supplied club_id', async () => {
      // No cls.set: would throw if getClubId() were called.
      await repo.updateStatusForClub(INVOICE_IN_B, CLUB_B, InvoiceStatus.PAID);

      expect(updateCalls[0].criteria).toEqual({ invoice_id: INVOICE_IN_B, club_id: CLUB_B });
      expect(updateCalls[0].partial).toEqual({ status: InvoiceStatus.PAID });
    });
  });
});
