import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ClubSettingsService } from './club-settings.service';
import { ClubSettings } from './club-settings.entity';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { ClubsService } from '../../clubs/clubs.service';
import { ClubsRepository } from '../../clubs/clubs.repository';

const TEST_CLUB_ID = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** Minimal in-memory fake of ClsService, matching the tenancy reference specs. */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

describe('ClubSettingsService', () => {
  let service: ClubSettingsService;
  let settingsRepo: Record<string, jest.Mock>;
  let clubsRepo: Record<string, jest.Mock>;
  let cls: FakeClsService;

  const mockSettings: Partial<ClubSettings> = {
    settings_id: 'set-1',
    club_id: TEST_CLUB_ID,
    club_name: 'Swimly Test Club',
    address: '123 Pool Lane',
    contact_email: 'admin@testclub.co.uk',
    phone: '0123456789',
    website: 'https://testclub.co.uk',
    logo_url: undefined,
    swim_england: {},
    locations: [],
    billing_config: {},
    notification_prefs: {
      notifyNewMember: true,
      notifyPaymentReceived: true,
      notifyAttendanceAlerts: false,
    },
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  // The regional and affiliation fields live on the clubs row and are merged
  // into responses.
  const mockClub = {
    id: TEST_CLUB_ID,
    name: 'Swimly Test Club',
    country: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    locale: 'en-GB',
    governing_body: 'SWIM_ENGLAND',
    governing_body_region: 'North East',
    affiliation_number: 'SE-12345',
    swim_england_region: null,
    swim_england_affiliate_number: null,
    tax_rate: null,
    tax_label: null,
  };

  const regionFields = {
    country: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    locale: 'en-GB',
    governing_body: 'SWIM_ENGLAND',
    governing_body_region: 'North East',
    affiliation_number: 'SE-12345',
    tax_rate: null,
    tax_label: null,
  };

  beforeEach(async () => {
    cls = new FakeClsService();
    cls.set(CLS_CLUB_ID_KEY, TEST_CLUB_ID);

    settingsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // The real ClubsService (via findCurrent) resolves the club through the
    // real TenantContextService, so only the repository layer is faked.
    clubsRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockClub }),
      save: jest.fn().mockImplementation((club) => Promise.resolve(club)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubSettingsService,
        ClubsService,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(ClubSettings), useValue: settingsRepo },
        { provide: ClubsRepository, useValue: clubsRepo },
      ],
    }).compile();

    service = module.get<ClubSettingsService>(ClubSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return existing settings scoped to the active club', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { club_id: TEST_CLUB_ID },
      });
      expect(result).toEqual({ ...mockSettings, ...regionFields });
      expect(settingsRepo.create).not.toHaveBeenCalled();
      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('should merge the club regional fields into the response', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings);
      clubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        country: 'US',
        currency: 'USD',
        timezone: 'America/Chicago',
        locale: 'en-US',
      });

      const result = await service.getSettings();

      // The club is loaded strictly by the tenant context club id.
      expect(clubsRepo.findOne).toHaveBeenCalledWith(TEST_CLUB_ID);
      expect(result.country).toBe('US');
      expect(result.currency).toBe('USD');
      expect(result.timezone).toBe('America/Chicago');
      expect(result.locale).toBe('en-US');
    });

    it('returns the affiliation fields from the club entity', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(result.governing_body).toBe('SWIM_ENGLAND');
      expect(result.governing_body_region).toBe('North East');
      expect(result.affiliation_number).toBe('SE-12345');
    });

    it('falls back to the legacy columns when the new affiliation columns are null', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings);
      // A pre-backfill club: new columns null, legacy columns populated.
      clubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        governing_body: 'SWIM_ENGLAND',
        governing_body_region: null,
        affiliation_number: null,
        swim_england_region: 'Legacy Region',
        swim_england_affiliate_number: 'SE-LEGACY',
      });

      const result = await service.getSettings();

      expect(result.governing_body_region).toBe('Legacy Region');
      expect(result.affiliation_number).toBe('SE-LEGACY');
    });

    it('should create default settings stamped with the club_id when none exist', async () => {
      settingsRepo.findOne.mockResolvedValue(null);
      settingsRepo.create.mockImplementation((entity) => entity);
      settingsRepo.save.mockImplementation((entity) =>
        Promise.resolve({ settings_id: 'new-id', ...entity }),
      );

      const result = await service.getSettings();

      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { club_id: TEST_CLUB_ID },
      });
      // The created default carries the caller's club_id.
      expect(settingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ club_id: TEST_CLUB_ID, club_name: 'Swim Club' }),
      );
      expect(result.settings_id).toBe('new-id');
      expect(result.club_name).toBe('Swim Club');
      expect(result.club_id).toBe(TEST_CLUB_ID);
    });
  });

  describe('updateSettings', () => {
    it('should update the existing row scoped to the active club', async () => {
      const existingSettings = { ...mockSettings };
      const dto = { club_name: 'Updated Club Name', phone: '07700900000' };

      settingsRepo.findOne.mockResolvedValue(existingSettings);
      settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateSettings(dto);

      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { club_id: TEST_CLUB_ID },
      });
      expect(settingsRepo.save).toHaveBeenCalled();
      expect(result.club_name).toBe('Updated Club Name');
      expect(result.phone).toBe('07700900000');
      expect(result.club_id).toBe(TEST_CLUB_ID);
    });

    it('should create a new row stamped with the club_id when none exist', async () => {
      const dto = { club_name: 'New Club', contact_email: 'new@club.co.uk' };

      settingsRepo.findOne.mockResolvedValue(null);
      settingsRepo.create.mockImplementation((entity) => entity);
      settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateSettings(dto);

      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { club_id: TEST_CLUB_ID },
      });
      expect(settingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, club_id: TEST_CLUB_ID }),
      );
      expect(result.club_name).toBe('New Club');
      expect(result.club_id).toBe(TEST_CLUB_ID);
    });

    it('should preserve existing fields not included in the dto', async () => {
      const existingSettings = { ...mockSettings };
      const dto = { club_name: 'Only Name Changed' };

      settingsRepo.findOne.mockResolvedValue(existingSettings);
      settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateSettings(dto);

      expect(result.club_name).toBe('Only Name Changed');
      expect(result.contact_email).toBe('admin@testclub.co.uk');
      expect(result.address).toBe('123 Pool Lane');
    });

    it('should ignore a club_id supplied in the dto and keep the active club', async () => {
      const existingSettings = { ...mockSettings };
      const dto = {
        club_name: 'Hijack Attempt',
        club_id: 'club-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      } as unknown as Parameters<ClubSettingsService['updateSettings']>[0];

      settingsRepo.findOne.mockResolvedValue(existingSettings);
      settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateSettings(dto);

      // The supplied club_id is discarded; the active tenant wins.
      expect(result.club_id).toBe(TEST_CLUB_ID);
    });

    describe('billing_config provider credentials', () => {
      // Clubs connect their own provider account, so Swimly must never persist
      // a club's API keys. An older settings form POSTed them here and they
      // were stored unencrypted; the service now strips them on write.
      const credentialDto = {
        billing_config: {
          goCardlessKey: 'live_should_never_be_stored',
          stripePublishableKey: 'pk_should_never_be_stored',
          stripeSecretKey: 'sk_should_never_be_stored',
          payment_due_days: 14,
        },
      } as unknown as Parameters<ClubSettingsService['updateSettings']>[0];

      it('strips provider credentials from billing_config before saving', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const result = await service.updateSettings(credentialDto);

        expect(result.billing_config).toEqual({ payment_due_days: 14 });
        expect(result.billing_config).not.toHaveProperty('goCardlessKey');
        expect(result.billing_config).not.toHaveProperty('stripePublishableKey');
        expect(result.billing_config).not.toHaveProperty('stripeSecretKey');
      });

      it('strips provider credentials on the create path too', async () => {
        settingsRepo.findOne.mockResolvedValue(null);
        settingsRepo.create.mockImplementation((entity) => entity);
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        await service.updateSettings(credentialDto);

        expect(settingsRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ billing_config: { payment_due_days: 14 } }),
        );
      });

      it('leaves a credential-free billing_config untouched', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const dto = {
          billing_config: { payment_due_days: 30, currency: 'AUD' },
        } as unknown as Parameters<ClubSettingsService['updateSettings']>[0];

        const result = await service.updateSettings(dto);

        expect(result.billing_config).toEqual({ payment_due_days: 30, currency: 'AUD' });
      });

      it('does not mutate the caller-supplied dto', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const dto = {
          billing_config: { goCardlessKey: 'live_key', payment_due_days: 14 },
        } as unknown as Parameters<ClubSettingsService['updateSettings']>[0];

        await service.updateSettings(dto);

        // The strip works on a copy; the caller's object is unchanged.
        expect((dto as { billing_config: Record<string, unknown> }).billing_config).toHaveProperty(
          'goCardlessKey',
        );
      });
    });

    describe('timezone', () => {
      it('accepts a timezone valid for the club country and writes it to the club', async () => {
        clubsRepo.findOne.mockResolvedValue({
          ...mockClub,
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York',
          locale: 'en-US',
        });
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const result = await service.updateSettings({ timezone: 'America/Chicago' });

        // Written to the Club entity via the clubs repository, on the entity
        // loaded for the active tenant.
        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_CLUB_ID, timezone: 'America/Chicago' }),
        );
        // The response reflects the new timezone.
        expect(result.timezone).toBe('America/Chicago');
      });

      it('rejects a timezone that is not valid for the club country with a 400', async () => {
        // GB club: only Europe/London is valid.
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });

        await expect(service.updateSettings({ timezone: 'America/Chicago' })).rejects.toThrow(
          BadRequestException,
        );

        // Nothing persisted: neither the settings row nor the club row.
        expect(settingsRepo.save).not.toHaveBeenCalled();
        expect(clubsRepo.save).not.toHaveBeenCalled();
      });

      it('does not write the timezone to the settings row', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        await service.updateSettings({
          club_name: 'Renamed',
          timezone: 'Europe/London',
        });

        const savedSettings = settingsRepo.save.mock.calls[0][0];
        expect(savedSettings.timezone).toBeUndefined();
        expect(savedSettings.club_name).toBe('Renamed');
      });

      it('does not save the club when the timezone is unchanged', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        // Europe/London matches the club's current timezone.
        await service.updateSettings({ timezone: 'Europe/London' });

        expect(clubsRepo.save).not.toHaveBeenCalled();
      });

      it('does not touch the club when no timezone is supplied', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        await service.updateSettings({ club_name: 'No Timezone Change' });

        expect(clubsRepo.save).not.toHaveBeenCalled();
      });
    });

    describe('affiliation', () => {
      beforeEach(() => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));
      });

      it('writes the affiliation fields to the club entity, not the settings row', async () => {
        const result = await service.updateSettings({
          governing_body: 'SCOTTISH_SWIMMING',
          governing_body_region: 'Highlands',
          affiliation_number: 'SS-4242',
        });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: TEST_CLUB_ID,
            governing_body: 'SCOTTISH_SWIMMING',
            governing_body_region: 'Highlands',
            affiliation_number: 'SS-4242',
          }),
        );
        // The settings row never carries the affiliation fields.
        const savedSettings = settingsRepo.save.mock.calls[0][0];
        expect(savedSettings.governing_body).toBeUndefined();
        expect(savedSettings.affiliation_number).toBeUndefined();
        // The response reflects the new values.
        expect(result.governing_body).toBe('SCOTTISH_SWIMMING');
        expect(result.affiliation_number).toBe('SS-4242');
      });

      it('rejects a governing_body that is not valid for the club country with a 400', async () => {
        // GB club: USA_SWIMMING is not a valid choice.
        await expect(service.updateSettings({ governing_body: 'USA_SWIMMING' })).rejects.toThrow(
          BadRequestException,
        );

        // Nothing persisted.
        expect(settingsRepo.save).not.toHaveBeenCalled();
        expect(clubsRepo.save).not.toHaveBeenCalled();
      });

      it('maps the legacy swim_england JSONB affiliate_number onto the affiliation_number column', async () => {
        await service.updateSettings({
          swim_england: { affiliate_number: 'SE-FROM-JSONB' },
        });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ affiliation_number: 'SE-FROM-JSONB' }),
        );
        // The supplied JSONB blob is mapped to the column, not stored on the
        // settings row (existing settings data is left untouched, so the
        // pre-existing empty object stays as-is rather than being overwritten).
        const savedSettings = settingsRepo.save.mock.calls[0][0];
        expect(savedSettings.swim_england).not.toMatchObject({
          affiliate_number: 'SE-FROM-JSONB',
        });
      });

      it('maps the web settings form JSONB shape (affiliationNumber and region) onto the club columns', async () => {
        // The deployed web settings form sends camelCase affiliationNumber and
        // a region key inside the swim_england blob.
        await service.updateSettings({
          swim_england: { affiliationNumber: 'SE-CAMEL', region: 'East Midlands' },
        });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            affiliation_number: 'SE-CAMEL',
            governing_body_region: 'East Midlands',
          }),
        );
      });

      it('prefers the new affiliation_number over the legacy JSONB blob', async () => {
        await service.updateSettings({
          affiliation_number: 'SE-NEW',
          swim_england: { affiliate_number: 'SE-OLD' },
        });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ affiliation_number: 'SE-NEW' }),
        );
      });

      it('does not save the club when no affiliation or timezone fields are supplied', async () => {
        await service.updateSettings({ club_name: 'Just A Rename' });

        expect(clubsRepo.save).not.toHaveBeenCalled();
      });
    });

    describe('tax', () => {
      it('returns the club tax fields on getSettings', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        clubsRepo.findOne.mockResolvedValue({
          ...mockClub,
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York',
          locale: 'en-US',
          tax_rate: '8.25',
          tax_label: 'Sales tax',
        });

        const result = await service.getSettings();

        expect(result.tax_rate).toBe('8.25');
        expect(result.tax_label).toBe('Sales tax');
      });

      it('writes tax_rate and tax_label to the club, not the settings row', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const result = await service.updateSettings({
          tax_rate: 8.25,
          tax_label: 'Sales tax',
        });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: TEST_CLUB_ID,
            tax_rate: 8.25,
            tax_label: 'Sales tax',
          }),
        );
        // The tax fields never land on the settings row.
        const savedSettings = settingsRepo.save.mock.calls[0][0];
        expect(savedSettings.tax_rate).toBeUndefined();
        expect(savedSettings.tax_label).toBeUndefined();
        expect(result.tax_rate).toBe(8.25);
        expect(result.tax_label).toBe('Sales tax');
      });

      it('clears the tax rate when null is supplied', async () => {
        clubsRepo.findOne.mockResolvedValue({
          ...mockClub,
          tax_rate: '20.00',
          tax_label: 'VAT',
        });
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        const result = await service.updateSettings({ tax_rate: null });

        expect(clubsRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_CLUB_ID, tax_rate: null }),
        );
        expect(result.tax_rate).toBeNull();
      });

      it('does not touch the club when no tax fields are supplied', async () => {
        settingsRepo.findOne.mockResolvedValue({ ...mockSettings });
        settingsRepo.save.mockImplementation((entity) => Promise.resolve(entity));

        await service.updateSettings({ club_name: 'No Tax Change' });

        expect(clubsRepo.save).not.toHaveBeenCalled();
      });
    });
  });
});
