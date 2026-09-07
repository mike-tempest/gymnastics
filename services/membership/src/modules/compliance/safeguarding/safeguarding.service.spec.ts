import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GoverningBody } from '@club-manager/shared-types';
import { SafeguardingService } from './safeguarding.service';
import { ChecklistItem } from './entities/checklist-item.entity';
import { SafeguardingOfficer } from './entities/safeguarding-officer.entity';
import { Incident, IncidentStatus } from './entities/incident.entity';
import { ClubsService } from '../../clubs/clubs.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';

const CLUB_A = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/**
 * A minimal in-memory repository fake. Each instance backs one entity table and
 * assigns sequential ids so tests can assert stability and club scoping.
 */
class FakeRepository<T extends { id: string; club_id: string }> {
  rows: T[] = [];
  private seq = 0;

  create(entityLike: Partial<T>): T {
    return { ...entityLike } as T;
  }

  async save(entity: T | T[]): Promise<T | T[]> {
    const list = Array.isArray(entity) ? entity : [entity];
    for (const e of list) {
      if (!e.id) {
        e.id = `row-${++this.seq}`;
        (e as { created_at?: Date }).created_at = new Date(Date.now() + this.seq);
      }
      const idx = this.rows.findIndex((r) => r.id === e.id);
      if (idx >= 0) {
        this.rows[idx] = e;
      } else {
        this.rows.push(e);
      }
    }
    return entity;
  }

  async find(options?: { where?: Partial<T> }): Promise<T[]> {
    return this.rows.filter((r) => this.matches(r, options?.where));
  }

  async findOne(options: { where: Partial<T> }): Promise<T | null> {
    return this.rows.find((r) => this.matches(r, options.where)) ?? null;
  }

  async update(where: Partial<T>, patch: Partial<T>): Promise<{ affected: number }> {
    let affected = 0;
    for (const r of this.rows) {
      if (this.matches(r, where)) {
        Object.assign(r, patch);
        affected += 1;
      }
    }
    return { affected };
  }

  async delete(where: Partial<T>): Promise<{ affected: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !this.matches(r, where));
    return { affected: before - this.rows.length };
  }

  private matches(row: T, where?: Partial<T>): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  }
}

/** Minimal in-memory fake of TenantContextService. */
class FakeTenantContext {
  clubId = CLUB_A;
  getClubId(): string {
    return this.clubId;
  }
  getClubIdOrNull(): string | null {
    return this.clubId;
  }
}

describe('SafeguardingService', () => {
  let service: SafeguardingService;
  let checklistRepo: FakeRepository<ChecklistItem>;
  let officerRepo: FakeRepository<SafeguardingOfficer>;
  let incidentRepo: FakeRepository<Incident>;
  let tenant: FakeTenantContext;
  let clubGoverningBody: string | null;
  let fakeDataSource: {
    transaction: (cb: (manager: unknown) => Promise<unknown>) => Promise<unknown>;
  };

  beforeEach(async () => {
    checklistRepo = new FakeRepository<ChecklistItem>();
    officerRepo = new FakeRepository<SafeguardingOfficer>();
    incidentRepo = new FakeRepository<Incident>();
    tenant = new FakeTenantContext();
    clubGoverningBody = GoverningBody.SWIM_ENGLAND;

    // The seeding transaction uses manager.getRepository(ChecklistItem); route
    // that back to the same in-memory checklist fake. Kept mutable so tests
    // can simulate a lost seeding race.
    fakeDataSource = {
      transaction: async (cb: (manager: unknown) => Promise<unknown>) =>
        cb({ getRepository: () => checklistRepo }),
    };

    const fakeClubsService = {
      findCurrent: async () => ({ id: tenant.clubId, governing_body: clubGoverningBody }),
    } as unknown as ClubsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafeguardingService,
        TenantScopedHelper,
        { provide: getRepositoryToken(ChecklistItem), useValue: checklistRepo },
        { provide: getRepositoryToken(SafeguardingOfficer), useValue: officerRepo },
        { provide: getRepositoryToken(Incident), useValue: incidentRepo },
        { provide: DataSource, useValue: fakeDataSource },
        { provide: ClubsService, useValue: fakeClubsService },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();

    service = module.get<SafeguardingService>(SafeguardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChecklist', () => {
    it('seeds the Swim England template on first access and persists it', async () => {
      const result = await service.getChecklist();

      expect(result.length).toBe(8);
      for (const item of result) {
        expect(item.id).toBeDefined();
        expect(item.club_id).toBe(CLUB_A);
        expect(item.completed).toBe(false);
      }
      // Regression bar: GB clubs keep the exact Wavepower strings.
      const wavepower = result.find((i) => i.requirement.includes('Wavepower'));
      expect(wavepower).toBeDefined();
      expect(wavepower?.requirement).toBe('Swim England Wavepower 2024-2028 Policy Review');
      expect(wavepower?.description).toBe(
        'Annual review and acknowledgement of Swim England Wavepower safeguarding policies and procedures',
      );
      const training = result.find((i) => i.requirement === 'Safeguarding Training Completion');
      expect(training?.description).toContain('Time to Listen');
    });

    it('does not re-seed on the second call and returns stable ids', async () => {
      const first = await service.getChecklist();
      const second = await service.getChecklist();

      expect(checklistRepo.rows.length).toBe(8);
      expect(second.map((i) => i.id)).toEqual(first.map((i) => i.id));
    });

    it('seeds the SafeSport template for a USA Swimming club', async () => {
      clubGoverningBody = GoverningBody.USA_SWIMMING;

      const result = await service.getChecklist();

      expect(result.length).toBe(8);
      const maapp = result.find((i) => i.requirement.includes('MAAPP'));
      expect(maapp).toBeDefined();
      const safesport = result.find((i) => i.requirement.includes('SafeSport'));
      expect(safesport).toBeDefined();
      // No Swim England Wavepower content for a US club.
      expect(result.some((i) => i.requirement.includes('Wavepower'))).toBe(false);
    });

    it('seeds the Australian MPIO/WWCC template for a Swimming Australia club', async () => {
      clubGoverningBody = GoverningBody.SWIMMING_AUSTRALIA;

      const result = await service.getChecklist();

      expect(result.length).toBe(10);
      expect(result.some((i) => i.requirement === 'MPIO Appointment')).toBe(true);
      expect(
        result.some((i) => i.requirement === 'WWCC Verification for All Coaches and Volunteers'),
      ).toBe(true);
      expect(result.some((i) => i.requirement === 'Child Safeguarding Policy Review')).toBe(true);
      expect(
        result.some((i) => i.requirement === 'Child Safe Standards Self-Assessment'),
      ).toBe(true);
      const policy = result.find((i) => i.requirement === 'Child Safeguarding Policy Review');
      expect(policy?.description).toContain('National Integrity Framework');
      const reporting = result.find((i) => i.requirement === 'Incident Reporting Procedure');
      expect(reporting?.description).toContain('Sport Integrity Australia');
      // No Swim England Wavepower content for an Australian club.
      expect(result.some((i) => i.requirement.includes('Wavepower'))).toBe(false);
    });

    it('seeds the British Gymnastics template for a British Gymnastics club', async () => {
      clubGoverningBody = GoverningBody.BRITISH_GYMNASTICS;

      const result = await service.getChecklist();

      // Pin the full template contents and order against the compliance brief.
      expect(result.map((i) => i.requirement)).toEqual([
        'Safeguarding and Protecting Children Policy Review',
        'Welfare Officer Appointment',
        'Criminal Record Checks for All Coaches',
        'Safeguarding Training Completion',
        'Photography and Filming Consent',
        'Changing Room Supervision Policy',
        'Incident Reporting Procedure',
        'Code of Conduct Acknowledgement',
      ]);
      const policy = result.find(
        (i) => i.requirement === 'Safeguarding and Protecting Children Policy Review',
      );
      expect(policy?.description).toContain('Safe & Fair Sport');
      expect(result.some((i) => i.requirement === 'Welfare Officer Appointment')).toBe(true);
      const checks = result.find((i) => i.requirement === 'Criminal Record Checks for All Coaches');
      expect(checks?.description).toContain('DBS, PVG or AccessNI');
      const reporting = result.find((i) => i.requirement === 'Incident Reporting Procedure');
      expect(reporting?.description).toContain('British Gymnastics');
      // No Swim England Wavepower content for a gymnastics club.
      expect(result.some((i) => i.requirement.includes('Wavepower'))).toBe(false);
    });

    it('assigns sort_order following template order', async () => {
      const result = await service.getChecklist();

      expect(result.map((i) => i.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(result[0].requirement).toBe('Swim England Wavepower 2024-2028 Policy Review');
    });

    it("recovers from a lost seeding race by returning the winner's rows", async () => {
      // Simulate a concurrent request committing the seed first: the insert
      // hits the unique (club_id, requirement) index and fails with 23505.
      fakeDataSource.transaction = async () => {
        await checklistRepo.save([
          {
            club_id: CLUB_A,
            requirement: 'Swim England Wavepower 2024-2028 Policy Review',
            completed: false,
            sort_order: 0,
          } as ChecklistItem,
        ]);
        const err = new Error('duplicate key value violates unique constraint') as Error & {
          code: string;
        };
        err.code = '23505';
        throw err;
      };

      const result = await service.getChecklist();

      expect(result.length).toBe(1);
      expect(result[0].requirement).toContain('Wavepower');
    });
  });

  describe('updateChecklistItem', () => {
    it('toggles completed for an item in the active club', async () => {
      const [item] = await service.getChecklist();
      expect(item.completed).toBe(false);

      const updated = await service.updateChecklistItem(item.id, true);

      expect(updated.completed).toBe(true);
      expect(checklistRepo.rows.find((r) => r.id === item.id)?.completed).toBe(true);
    });

    it("is club-scoped and does not touch another club's item", async () => {
      const [item] = await service.getChecklist();
      // Reassign the row to another club, then attempt a toggle as CLUB_A.
      const foreign = checklistRepo.rows.find((r) => r.id === item.id) as ChecklistItem;
      foreign.club_id = 'club-other';

      await expect(service.updateChecklistItem(item.id, true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(foreign.completed).toBe(false);
    });
  });

  describe('officers', () => {
    it('reads officers scoped to the active club', async () => {
      officerRepo.rows.push({ id: 'o1', club_id: CLUB_A } as SafeguardingOfficer);
      officerRepo.rows.push({ id: 'o2', club_id: 'club-other' } as SafeguardingOfficer);

      const result = await service.getOfficers();

      expect(result.map((o) => o.id)).toEqual(['o1']);
    });

    it('creates an officer stamped with the active club_id', async () => {
      const officer = await service.createOfficer({
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
        dbs_expiry: '2027-01-01',
      });

      expect(officer.club_id).toBe(CLUB_A);
      expect(officer.name).toBe('Alex Rivers');
      // Date-only values pass through as ISO strings so the stored calendar
      // date never shifts with the server timezone.
      expect(officer.dbs_expiry).toBe('2027-01-01');
    });

    it('creates an officer without the optional fields', async () => {
      const officer = await service.createOfficer({
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
      });

      expect(officer.id).toBeDefined();
      expect(officer.club_id).toBe(CLUB_A);
    });

    it('treats an empty update patch as a no-op read', async () => {
      const officer = await service.createOfficer({
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
      });

      const result = await service.updateOfficer(officer.id, {});

      expect(result.id).toBe(officer.id);
      expect(result.name).toBe('Alex Rivers');
    });

    it('updates an officer scoped to the active club', async () => {
      const officer = await service.createOfficer({
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
      });

      const updated = await service.updateOfficer(officer.id, { role: 'Deputy Welfare Officer' });

      expect(updated.role).toBe('Deputy Welfare Officer');
    });

    it('does not update an officer from another club', async () => {
      officerRepo.rows.push({ id: 'o-foreign', club_id: 'club-other' } as SafeguardingOfficer);

      await expect(service.updateOfficer('o-foreign', { role: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes an officer scoped to the active club', async () => {
      const officer = await service.createOfficer({
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
      });

      await service.deleteOfficer(officer.id);

      expect(officerRepo.rows.find((o) => o.id === officer.id)).toBeUndefined();
    });

    it('does not delete an officer from another club', async () => {
      officerRepo.rows.push({ id: 'o-foreign', club_id: 'club-other' } as SafeguardingOfficer);

      await expect(service.deleteOfficer('o-foreign')).rejects.toBeInstanceOf(NotFoundException);
      expect(officerRepo.rows.find((o) => o.id === 'o-foreign')).toBeDefined();
    });
  });

  describe('incidents', () => {
    it('persists an incident stamped with the active club_id', async () => {
      const incident = await service.createIncident({
        date: '2026-03-15',
        category: 'Safeguarding concern',
        summary: 'A concern was raised during training',
        status: IncidentStatus.OPEN,
        reported_by: 'Alex Rivers',
      });

      expect(incident.club_id).toBe(CLUB_A);
      expect(incidentRepo.rows.length).toBe(1);
    });

    it('defaults to OPEN status when none is provided', async () => {
      const incident = await service.createIncident({
        date: '2026-03-15',
        category: 'Behavioural',
        summary: 'Minor behavioural incident observed',
        status: undefined as unknown as IncidentStatus,
        reported_by: 'Alex Rivers',
      });

      expect(incident.status).toBe(IncidentStatus.OPEN);
    });

    it('lists incidents scoped to the active club', async () => {
      await service.createIncident({
        date: '2026-03-15',
        category: 'Safeguarding concern',
        summary: 'First',
        status: IncidentStatus.OPEN,
        reported_by: 'Alex Rivers',
      });
      incidentRepo.rows.push({ id: 'i-foreign', club_id: 'club-other' } as Incident);

      const result = await service.getIncidents();

      expect(result.every((i) => i.club_id === CLUB_A)).toBe(true);
      expect(result.some((i) => i.id === 'i-foreign')).toBe(false);
    });
  });
});
