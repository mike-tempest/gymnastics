import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CredentialStatus, CredentialType } from '@club-manager/shared-types';
import { CredentialsService } from './credentials.service';
import { CredentialsRepository } from './credentials.repository';
import { Credential } from './entities/credential.entity';
import { EmailService } from '../../email/email.service';
import { ClubsService } from '../../clubs/clubs.service';

/**
 * The expiry sweep is the whole point of the module: a credential nobody is
 * watching is the notes field product rule 2 rules out. These tests pin the
 * behaviour that matters, without a database.
 */

/** Minimal fake of ClsService: run() just invokes the callback. */
class FakeClsService {
  private store = new Map<string, unknown>();

  async run<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

const CLUB = {
  id: 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Kestrel Vale Gymnastics',
  locale: 'en-GB',
  timezone: 'Europe/London',
};

/** A date-only string this many days from today, in UTC. */
function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCredential(overrides: Partial<Credential> = {}): Credential {
  return {
    credential_id: 'credential-1',
    club_id: CLUB.id,
    user_id: 'user-1',
    member_id: null,
    credential_type: CredentialType.FIRST_AID,
    title: 'Emergency First Aid at Work',
    issuing_body: 'St John Ambulance',
    reference_number: 'FA-001',
    issue_date: '2026-01-01',
    expiry_date: null,
    status: CredentialStatus.VALID,
    document_reference: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by_user_id: null,
    user: {
      first_name: 'Ada',
      last_name: 'Coach',
      email: 'ada@example.com',
    },
    ...overrides,
  } as unknown as Credential;
}

describe('CredentialsService', () => {
  let service: CredentialsService;
  let repository: jest.Mocked<Partial<CredentialsRepository>>;
  let emailService: { sendCredentialExpiryWarning: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByReference: jest.fn().mockResolvedValue(null),
      findExpiringWithin: jest.fn().mockResolvedValue([]),
      findExpired: jest.fn().mockResolvedValue([]),
      setStatus: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };
    emailService = { sendCredentialExpiryWarning: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialsService,
        { provide: CredentialsRepository, useValue: repository },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        { provide: ClubsService, useValue: { findAll: jest.fn().mockResolvedValue([CLUB]) } },
        { provide: ClsService, useValue: new FakeClsService() },
      ],
    }).compile();

    service = module.get(CredentialsService);
  });

  describe('create', () => {
    it('files a back-dated credential as expired rather than waiting for the sweep', async () => {
      const created = buildCredential({ expiry_date: isoDaysFromToday(-10) });
      (repository.create as jest.Mock).mockResolvedValue(created);
      (repository.findOne as jest.Mock).mockResolvedValue(created);

      await service.create(
        {
          user_id: 'user-1',
          credential_type: CredentialType.FIRST_AID,
          title: 'Emergency First Aid at Work',
          issue_date: '2023-01-01',
          expiry_date: isoDaysFromToday(-10),
        },
        'admin-1',
      );

      expect(repository.setStatus).toHaveBeenCalledWith(
        created.credential_id,
        CredentialStatus.EXPIRED,
      );
    });

    it('leaves a credential with no expiry date valid', async () => {
      const created = buildCredential();
      (repository.create as jest.Mock).mockResolvedValue(created);
      (repository.findOne as jest.Mock).mockResolvedValue(created);

      await service.create(
        {
          user_id: 'user-1',
          credential_type: CredentialType.COACHING_QUALIFICATION,
          title: 'UKCC Level 2 Coaching',
          issue_date: '2026-01-01',
        },
        'admin-1',
      );

      expect(repository.setStatus).not.toHaveBeenCalled();
    });

    it('rejects a reference number already recorded in the same club', async () => {
      (repository.findByReference as jest.Mock).mockResolvedValue(buildCredential());

      await expect(
        service.create(
          {
            user_id: 'user-2',
            credential_type: CredentialType.FIRST_AID,
            title: 'Emergency First Aid at Work',
            issue_date: '2026-01-01',
            reference_number: 'FA-001',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a payload naming both a staff member and a gymnast', async () => {
      await expect(
        service.create(
          {
            user_id: 'user-1',
            member_id: 'member-1',
            credential_type: CredentialType.FIRST_AID,
            title: 'Emergency First Aid at Work',
            issue_date: '2026-01-01',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a payload naming no subject at all', async () => {
      await expect(
        service.create(
          {
            credential_type: CredentialType.FIRST_AID,
            title: 'Emergency First Aid at Work',
            issue_date: '2026-01-01',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('rejects a reference number already held by another credential', async () => {
      const existing = buildCredential();
      const other = buildCredential({ credential_id: 'credential-2', reference_number: 'FA-999' });
      (repository.findOne as jest.Mock).mockResolvedValue(existing);
      (repository.findByReference as jest.Mock).mockResolvedValue(other);

      await expect(
        service.update(existing.credential_id, { reference_number: 'FA-999' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('clears the expiry date and returns the credential to valid', async () => {
      const existing = buildCredential({
        expiry_date: '2026-01-01',
        status: CredentialStatus.EXPIRED,
      });
      (repository.findOne as jest.Mock).mockResolvedValue(existing);

      await service.update(existing.credential_id, { expiry_date: null });

      expect(repository.update).toHaveBeenCalledWith(existing.credential_id, { expiry_date: null });
      expect(repository.setStatus).toHaveBeenCalledWith(
        existing.credential_id,
        CredentialStatus.VALID,
      );
    });
  });

  describe('getExpired', () => {
    it('asks the repository for everything past its date, not for unswept rows', async () => {
      const lapsed = buildCredential({
        expiry_date: '2020-01-01',
        status: CredentialStatus.EXPIRED,
      });
      (repository.findExpired as jest.Mock).mockResolvedValue([lapsed]);

      const result = await service.getExpired();

      // A status-blind query would answer "nothing has expired" from the
      // morning after the first sweep marked these rows EXPIRED.
      expect(repository.findExpired).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('the daily expiry sweep', () => {
    it('marks a credential inside the warning window as expiring soon', async () => {
      const credential = buildCredential({ expiry_date: isoDaysFromToday(45) });
      (repository.findExpiringWithin as jest.Mock).mockResolvedValue([credential]);

      await service.checkExpiringCredentials();

      expect(repository.setStatus).toHaveBeenCalledWith(
        credential.credential_id,
        CredentialStatus.EXPIRING_SOON,
      );
      // 45 days is not one of the cadence days, so no email yet.
      expect(emailService.sendCredentialExpiryWarning).not.toHaveBeenCalled();
    });

    it.each([90, 60, 30, 14, 7])('emails the holder %s days before expiry', async (days) => {
      const credential = buildCredential({ expiry_date: isoDaysFromToday(days) });
      (repository.findExpiringWithin as jest.Mock).mockResolvedValue([credential]);

      await service.checkExpiringCredentials();

      expect(emailService.sendCredentialExpiryWarning).toHaveBeenCalledTimes(1);
      expect(emailService.sendCredentialExpiryWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'ada@example.com',
          // Named per club: the instance-wide CLUB_NAME fallback would put one
          // club's name on every tenant's email.
          clubName: CLUB.name,
          credentialTitle: 'Emergency First Aid at Work',
          credentialType: 'First aid',
          daysUntilExpiry: days,
        }),
      );
    });

    it('marks a lapsed credential as expired', async () => {
      const credential = buildCredential({ expiry_date: isoDaysFromToday(-1) });
      (repository.findExpiringWithin as jest.Mock).mockResolvedValue([credential]);

      await service.checkExpiringCredentials();

      expect(repository.setStatus).toHaveBeenCalledWith(
        credential.credential_id,
        CredentialStatus.EXPIRED,
      );
    });

    it('does not rewrite a status that is already correct', async () => {
      const credential = buildCredential({
        expiry_date: isoDaysFromToday(30),
        status: CredentialStatus.EXPIRING_SOON,
      });
      (repository.findExpiringWithin as jest.Mock).mockResolvedValue([credential]);

      await service.checkExpiringCredentials();

      expect(repository.setStatus).not.toHaveBeenCalled();
    });

    it('sends no email for a gymnast-held credential, which has no address', async () => {
      const credential = buildCredential({
        expiry_date: isoDaysFromToday(30),
        user_id: null,
        user: null,
        member_id: 'member-1',
      });
      (repository.findExpiringWithin as jest.Mock).mockResolvedValue([credential]);

      await service.checkExpiringCredentials();

      expect(emailService.sendCredentialExpiryWarning).not.toHaveBeenCalled();
      expect(repository.setStatus).toHaveBeenCalledWith(
        credential.credential_id,
        CredentialStatus.EXPIRING_SOON,
      );
    });

    it('keeps sweeping other clubs when one club fails', async () => {
      (repository.findExpiringWithin as jest.Mock).mockRejectedValue(new Error('database down'));

      await expect(service.checkExpiringCredentials()).resolves.toBeUndefined();
    });
  });
});
