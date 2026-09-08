import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Discipline, WaitingListStatus } from '@club-manager/shared-types';
import { ClubsRepository } from '../clubs/clubs.repository';
import { ConsentsService } from '../compliance/consents/consents.service';
import { ConsentStatus, ConsentType } from '../compliance/consents/entities/consent.entity';
import { EmailService } from '../email/email.service';
import { FamiliesRepository } from '../families/families.repository';
import { FamiliesService } from '../families/families.service';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { MembersService } from '../members/members.service';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SquadsRepository } from '../squads/squads.repository';
import { SquadsService } from '../squads/squads.service';
import { ENROLMENT_CONSENT_TYPES, EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListRepository } from './waiting-list.repository';

/**
 * One click from waiting list to billed member (TEM-22, docs/05 rule 3).
 *
 * The point of these tests is that the single action really does all six
 * things, and that when one of the optional steps fails the caller is told
 * exactly what is left to do rather than being handed a silent half-enrolment.
 */

function entry(overrides: Partial<WaitingListEntry> = {}): WaitingListEntry {
  return {
    entry_id: 'entry-1',
    club_id: 'club-1',
    child_first_name: 'Priya',
    child_last_name: 'Nandra',
    child_dob: new Date('2018-03-01'),
    child_gender: 'F',
    parent_name: 'Anita Nandra',
    parent_email: 'Anita@Example.com',
    parent_phone: '07700 900123',
    desired_discipline: Discipline.TRAMPOLINE,
    desired_squad_type: null,
    preferred_squad_id: null,
    notes: null,
    joined_at: new Date('2026-01-01T00:00:00Z'),
    is_existing_member_family: false,
    is_sibling: false,
    priority_boost: 0,
    status: WaitingListStatus.WAITING,
    enrolled_member_id: null,
    withdrawn_reason: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as WaitingListEntry;
}

describe('EnrolmentService', () => {
  let service: EnrolmentService;

  let waitingList: { updateEntry: jest.Mock };
  let families: { findByPrimaryContactEmail: jest.Mock; create: jest.Mock; remove: jest.Mock };
  let familiesService: { generateInvite: jest.Mock };
  let members: { create: jest.Mock };
  let squadsService: { assignMember: jest.Mock };
  let consents: { create: jest.Mock };
  let users: { findByFamily: jest.Mock; findByRole: jest.Mock };
  let mandates: { findActiveByFamily: jest.Mock };
  let email: { sendMandateSetupRequired: jest.Mock; sendWaitingListEnrolled: jest.Mock };

  beforeEach(async () => {
    waitingList = { updateEntry: jest.fn().mockResolvedValue(null) };
    families = {
      findByPrimaryContactEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ family_id: 'family-new' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    familiesService = {
      generateInvite: jest
        .fn()
        .mockResolvedValue({ token: 'tok', inviteUrl: 'http://localhost:3000/invite/tok' }),
    };
    members = { create: jest.fn().mockResolvedValue({ member_id: 'member-new' }) };
    squadsService = { assignMember: jest.fn().mockResolvedValue({}) };
    consents = { create: jest.fn().mockResolvedValue({}) };
    users = {
      findByFamily: jest.fn().mockResolvedValue([]),
      findByRole: jest
        .fn()
        .mockResolvedValue([{ user_id: 'admin-1', club_id: 'club-1', role: UserRole.SUPER_ADMIN }]),
    };
    mandates = { findActiveByFamily: jest.fn().mockResolvedValue(null) };
    email = {
      sendMandateSetupRequired: jest.fn().mockResolvedValue(undefined),
      sendWaitingListEnrolled: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrolmentService,
        { provide: ConfigService, useValue: { get: (_k: string, fallback: string) => fallback } },
        { provide: WaitingListRepository, useValue: waitingList },
        { provide: FamiliesRepository, useValue: families },
        { provide: FamiliesService, useValue: familiesService },
        { provide: MembersService, useValue: members },
        { provide: SquadsService, useValue: squadsService },
        {
          provide: SquadsRepository,
          useValue: { findOne: jest.fn().mockResolvedValue({ squad_name: 'Trampoline' }) },
        },
        { provide: ConsentsService, useValue: consents },
        { provide: UsersService, useValue: users },
        { provide: MandatesRepository, useValue: mandates },
        { provide: EmailService, useValue: email },
        {
          provide: ClubsRepository,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ name: 'Kestrel Vale', country: 'GB' }),
          },
        },
      ],
    }).compile();

    service = module.get(EnrolmentService);
  });

  describe('the one action', () => {
    it('creates the family, the member, the place, the consents, the invite and the mandate email', async () => {
      const result = await service.enrol(entry(), 'squad-1');

      expect(result.family_created).toBe(true);
      expect(result.member_id).toBe('member-new');
      expect(result.squad_assigned).toBe(true);
      expect(result.consents_requested).toBe(ENROLMENT_CONSENT_TYPES.length);
      expect(result.invite_url).toBe('http://localhost:3000/invite/tok');
      expect(result.mandate_email_sent).toBe(true);
      expect(result.needs_attention).toEqual([]);
    });

    it('matches an existing family by lowercased parent email rather than making a second one', async () => {
      families.findByPrimaryContactEmail.mockResolvedValue({ family_id: 'family-existing' });

      const result = await service.enrol(entry(), 'squad-1');

      expect(families.findByPrimaryContactEmail).toHaveBeenCalledWith('anita@example.com');
      expect(families.create).not.toHaveBeenCalled();
      expect(result.family_id).toBe('family-existing');
      expect(result.family_created).toBe(false);
    });

    it('carries the discipline the family asked for onto the member', async () => {
      await service.enrol(entry(), 'squad-1');

      expect(members.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Priya',
          dob: '2018-03-01',
          discipline: Discipline.TRAMPOLINE,
          squad_id: 'squad-1',
        }),
      );
    });

    it('raises every enrolment consent as a pending request', async () => {
      await service.enrol(entry(), 'squad-1');

      const types = consents.create.mock.calls.map(
        (call: [{ consent_type: ConsentType }]) => call[0].consent_type,
      );
      expect(types).toEqual(ENROLMENT_CONSENT_TYPES);
      expect(consents.create.mock.calls[0][0]).toMatchObject({
        status: ConsentStatus.PENDING,
        member_id: 'member-new',
      });
    });

    it('attributes consent requests to the family parent account when there is one', async () => {
      users.findByFamily.mockResolvedValue([
        { user_id: 'parent-1', club_id: 'club-1', role: UserRole.PARENT },
      ]);

      await service.enrol(entry(), 'squad-1');

      expect(consents.create.mock.calls[0][0]).toMatchObject({ granted_by_user_id: 'parent-1' });
    });

    it('never attributes a consent request to another club', async () => {
      // UsersRepository queries by role and by family without a club
      // predicate, so an unfiltered fallback would write the newest
      // administrator in the whole database into granted_by_user_id on a
      // compliance record belonging to this club.
      users.findByFamily.mockResolvedValue([
        { user_id: 'other-parent', club_id: 'club-2', role: UserRole.PARENT },
      ]);
      users.findByRole.mockResolvedValue([
        { user_id: 'other-admin', club_id: 'club-2', role: UserRole.SUPER_ADMIN },
      ]);

      const result = await service.enrol(entry(), 'squad-1');

      expect(consents.create).not.toHaveBeenCalled();
      expect(result.consents_requested).toBe(0);
      expect(result.needs_attention.join(' ')).toContain('No consent requests were raised');
    });

    it('marks the entry enrolled and points it at the new member', async () => {
      await service.enrol(entry(), 'squad-1');

      expect(waitingList.updateEntry).toHaveBeenCalledWith('entry-1', {
        status: WaitingListStatus.ENROLLED,
        enrolled_member_id: 'member-new',
      });
    });

    it('skips the mandate email when the family already pays by Direct Debit', async () => {
      mandates.findActiveByFamily.mockResolvedValue({
        status: DirectDebitMandateStatus.ACTIVE,
      });

      const result = await service.enrol(entry(), 'squad-1');

      expect(result.mandate_already_active).toBe(true);
      expect(result.mandate_email_sent).toBe(false);
      expect(email.sendMandateSetupRequired).not.toHaveBeenCalled();
    });

    it('enrols with no squad place when the club has not decided yet', async () => {
      const result = await service.enrol(entry(), null);

      expect(result.squad_id).toBeNull();
      expect(result.squad_assigned).toBe(false);
      expect(squadsService.assignMember).not.toHaveBeenCalled();
    });
  });

  describe('partial failure leaves nothing stranded and says what is left', () => {
    it('reports a squad that would not take the member instead of failing the enrolment', async () => {
      squadsService.assignMember.mockRejectedValue(new Error('Squad is at full capacity'));

      const result = await service.enrol(entry(), 'squad-1');

      expect(result.member_id).toBe('member-new');
      expect(result.squad_assigned).toBe(false);
      expect(result.needs_attention.join(' ')).toContain('full capacity');
    });

    it('reports a failed invite rather than losing the member', async () => {
      familiesService.generateInvite.mockRejectedValue(new Error('no such family'));

      const result = await service.enrol(entry(), 'squad-1');

      expect(result.invite_url).toBeNull();
      expect(result.needs_attention.join(' ')).toContain('parent portal invite');
    });

    it('reports a failed mandate email rather than losing the member', async () => {
      email.sendMandateSetupRequired.mockRejectedValue(new Error('Resend is down'));

      const result = await service.enrol(entry(), 'squad-1');

      expect(result.mandate_email_sent).toBe(false);
      expect(result.needs_attention.join(' ')).toContain('Direct Debit setup email');
    });

    it('removes a family it had just created when the member cannot be created', async () => {
      members.create.mockRejectedValue(new Error('duplicate registration number'));

      await expect(service.enrol(entry(), 'squad-1')).rejects.toThrow(
        'duplicate registration number',
      );
      expect(families.remove).toHaveBeenCalledWith('family-new');
    });

    it('leaves an existing family alone when the member cannot be created', async () => {
      families.findByPrimaryContactEmail.mockResolvedValue({ family_id: 'family-existing' });
      members.create.mockRejectedValue(new Error('duplicate registration number'));

      await expect(service.enrol(entry(), 'squad-1')).rejects.toThrow();
      expect(families.remove).not.toHaveBeenCalled();
    });
  });

  describe('refusals', () => {
    it('refuses to enrol the same child twice', async () => {
      await expect(
        service.enrol(entry({ status: WaitingListStatus.ENROLLED }), 'squad-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an entry with no gender, which a member record needs', async () => {
      await expect(service.enrol(entry({ child_gender: null }), 'squad-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
