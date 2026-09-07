import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubSettings } from './club-settings.entity';
import { UpdateClubSettingsDto } from './dto/update-club-settings.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { ClubsService } from '../../clubs/clubs.service';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { Club } from '../../clubs/entities/club.entity';
import {
  isValidTimezoneForCountry,
  regionForCountry,
} from '../../../common/region/region.util';
import { COUNTRY_GOVERNING_BODIES, GoverningBody } from '@club-manager/shared-types';

/**
 * Payment provider credentials must never be stored on the settings row. A
 * previous version of the admin settings form POSTed these into billing_config,
 * where they were persisted unencrypted and returned to the browser on every
 * read. They are stripped on write and purged by migration 1744202600000.
 */
const PROVIDER_CREDENTIAL_KEYS = ['goCardlessKey', 'stripePublishableKey', 'stripeSecretKey'];

/**
 * The settings row merged with the regional and affiliation fields that live on
 * the Club entity itself. country and currency are read-only here; timezone and
 * the affiliation fields are writable via updateSettings; locale is read-only.
 */
export type ClubSettingsWithRegion = ClubSettings & {
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  governing_body: string | null;
  governing_body_region: string | null;
  affiliation_number: string | null;
  tax_rate: number | null;
  tax_label: string | null;
  tax_inclusive: boolean;
  tax_registration_number: string | null;
};

@Injectable()
export class ClubSettingsService {
  private readonly logger = new Logger(ClubSettingsService.name);

  constructor(
    @InjectRepository(ClubSettings)
    private readonly settingsRepository: Repository<ClubSettings>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
    private readonly clubsService: ClubsService,
    private readonly clubsRepository: ClubsRepository,
  ) {}

  /**
   * Get the calling club's settings row, merged with the regional fields
   * (country, currency, timezone, locale) read from the Club entity.
   *
   * club_settings is now one row per club (UNIQUE(club_id)). This returns the
   * row where club_id matches the active tenant, never another club's row, and
   * creates a default stamped with the caller's club_id if none exists yet.
   */
  async getSettings(): Promise<ClubSettingsWithRegion> {
    // The settings row and the club row are independent lookups, so run them
    // in parallel. findCurrent resolves the club from the tenant context.
    const [found, club] = await Promise.all([
      this.scoped.scopedFindOne(this.settingsRepository, { where: {} }),
      this.clubsService.findCurrent(),
    ]);

    let settings = found;
    if (!settings) {
      this.logger.log('No settings found for this club, creating defaults');
      // Stamp the caller's club_id; never trust any club_id from elsewhere.
      settings = this.settingsRepository.create(
        this.scoped.stampCreate<ClubSettings>({
          club_name: 'Swim Club',
          notification_prefs: {
            notifyNewMember: true,
            notifyPaymentReceived: true,
            notifyAttendanceAlerts: false,
          },
          locations: [],
          swim_england: {},
          billing_config: {},
        }),
      );
      settings = await this.settingsRepository.save(settings);
    }

    return this.mergeRegion(settings, club);
  }

  /**
   * Update the calling club's settings row (upsert pattern).
   *
   * Targets only the row where club_id matches the active tenant. Any club_id
   * supplied in the DTO is stripped so a caller cannot retarget another club's
   * row; the create branch stamps the caller's club_id.
   *
   * An optional timezone is written to the Club entity (not the settings row)
   * after validating it against the club's country timezone list; an invalid
   * timezone is rejected with a 400 before anything is persisted. country and
   * currency are never updatable through this endpoint.
   */
  async updateSettings(dto: UpdateClubSettingsDto): Promise<ClubSettingsWithRegion> {
    // Never let a caller-supplied club_id retarget or move the row. timezone,
    // the affiliation fields, tax_rate and tax_label all live on the Club
    // entity, so peel them off the settings payload too. The legacy
    // swim_england JSONB blob is accepted from old clients but mapped onto the
    // affiliation columns, never stored as JSONB.
    const {
      club_id: _ignored,
      timezone: rawTimezone,
      governing_body: rawGoverningBody,
      governing_body_region: rawGoverningBodyRegion,
      affiliation_number: rawAffiliationNumber,
      swim_england: legacyAffiliation,
      tax_rate: rawTaxRate,
      tax_label: rawTaxLabel,
      tax_inclusive: rawTaxInclusive,
      tax_registration_number: rawTaxRegistrationNumber,
      ...rest
    } = dto as UpdateClubSettingsDto & {
      club_id?: string;
    };
    const timezone = rawTimezone?.trim();
    const governingBody = rawGoverningBody?.trim();

    // Load the club once: it is needed for timezone validation and for the
    // regional fields merged into the response. Validate up front so an
    // invalid timezone rejects the whole request before anything is saved.
    const club = await this.clubsService.findCurrent();
    if (timezone !== undefined && !isValidTimezoneForCountry(club.country, timezone)) {
      const region = regionForCountry(club.country);
      throw new BadRequestException(
        `Timezone ${timezone} is not valid for country ${club.country}. ` +
          `Valid options: ${region.timezones.join(', ')}`,
      );
    }

    // Validate the governing body against the club's country before saving.
    // The country is normalised defensively; signup uppercases it, but a
    // hand-edited row must not lock the club out of affiliation updates.
    const validBodies = COUNTRY_GOVERNING_BODIES[club.country?.toUpperCase()] ?? [];
    if (governingBody !== undefined && !validBodies.includes(governingBody as GoverningBody)) {
      throw new BadRequestException(
        `Governing body ${governingBody} is not valid for country ${club.country}. ` +
          `Valid options: ${validBodies.join(', ')}`,
      );
    }

    // Resolve the affiliation fields, honouring the legacy JSONB blob when the
    // new columns are not supplied. Old clients send either affiliate_number
    // (the historic signup shape) or affiliationNumber (the web settings form),
    // plus a region key; all are mapped onto the new columns, never stored.
    const readLegacyString = (key: string): string | undefined =>
      typeof legacyAffiliation?.[key] === 'string'
        ? (legacyAffiliation[key] as string)
        : undefined;
    const affiliationNumber =
      rawAffiliationNumber?.trim() ??
      readLegacyString('affiliate_number') ??
      readLegacyString('affiliationNumber');
    const governingBodyRegion = rawGoverningBodyRegion?.trim() ?? readLegacyString('region');

    // Clubs connect their own payment provider account; Swimly never holds a
    // club's provider credentials. An older settings form POSTed API keys here
    // and they were stored unencrypted, so drop them rather than persist them.
    if (rest.billing_config && typeof rest.billing_config === 'object') {
      const billingConfig = { ...(rest.billing_config as Record<string, unknown>) };
      const supplied = PROVIDER_CREDENTIAL_KEYS.filter((key) => key in billingConfig);
      if (supplied.length > 0) {
        this.logger.warn(
          `Rejected provider credential key(s) in billing_config: ${supplied.join(', ')}`,
        );
        for (const key of supplied) delete billingConfig[key];
      }
      rest.billing_config = billingConfig;
    }

    let settings = await this.scoped.scopedFindOne(this.settingsRepository, {
      where: {},
    });

    if (!settings) {
      this.logger.log('No settings found for this club, creating with provided values');
      settings = this.settingsRepository.create(this.scoped.stampCreate<ClubSettings>(rest));
    } else {
      Object.assign(settings, rest);
      // Defensively re-stamp the active club_id on the existing row.
      settings.club_id = this.tenantContext.getClubId();
    }

    const saved = await this.settingsRepository.save(settings);

    // Apply Club-entity changes (timezone, affiliation and tax fields) in a
    // single save. Only touch the club row when at least one field changed.
    let clubDirty = false;
    if (timezone !== undefined && timezone !== club.timezone) {
      club.timezone = timezone;
      clubDirty = true;
      this.logger.log(`Club timezone updated to ${timezone}`);
    }
    if (governingBody !== undefined && governingBody !== club.governing_body) {
      club.governing_body = governingBody;
      clubDirty = true;
    }
    if (governingBodyRegion !== undefined && governingBodyRegion !== club.governing_body_region) {
      club.governing_body_region = governingBodyRegion;
      clubDirty = true;
    }
    if (affiliationNumber !== undefined && affiliationNumber !== club.affiliation_number) {
      club.affiliation_number = affiliationNumber;
      clubDirty = true;
    }
    if (rawTaxRate !== undefined) {
      club.tax_rate = rawTaxRate;
      clubDirty = true;
      this.logger.log(`Club tax rate updated to ${rawTaxRate ?? 'null'}`);
    }
    if (rawTaxLabel !== undefined) {
      club.tax_label = rawTaxLabel;
      clubDirty = true;
      this.logger.log('Club tax label updated');
    }
    if (rawTaxInclusive !== undefined && rawTaxInclusive !== club.tax_inclusive) {
      club.tax_inclusive = rawTaxInclusive;
      clubDirty = true;
      this.logger.log(`Club tax_inclusive updated to ${rawTaxInclusive}`);
    }
    if (rawTaxRegistrationNumber !== undefined) {
      // Store the identifier without spaces (ABNs and VAT numbers are often
      // typed with grouping spaces); the DTO allows the spaced form, but the
      // stripped value must fit the 32-character column.
      const stripped =
        rawTaxRegistrationNumber === null ? null : rawTaxRegistrationNumber.replace(/\s+/g, '');
      if (stripped !== null && stripped.length > 32) {
        throw new BadRequestException(
          'Tax registration number must be 32 characters or fewer (excluding spaces)',
        );
      }
      const normalised = stripped === '' ? null : stripped;
      if (normalised !== club.tax_registration_number) {
        club.tax_registration_number = normalised;
        clubDirty = true;
        this.logger.log('Club tax registration number updated');
      }
    }
    if (clubDirty) {
      await this.clubsRepository.save(club);
    }

    this.logger.log('Club settings updated successfully');
    return this.mergeRegion(saved, club);
  }

  /**
   * Merges the Club entity's regional fields into the settings response. The
   * columns stay on clubs; this is a read-time merge only.
   */
  private mergeRegion(settings: ClubSettings, club: Club): ClubSettingsWithRegion {
    return {
      ...settings,
      country: club.country,
      currency: club.currency,
      timezone: club.timezone,
      locale: club.locale,
      // Prefer the new columns; fall back to the legacy columns for clubs that
      // predate the backfill so their affiliation data still reads back.
      governing_body: club.governing_body,
      governing_body_region: club.governing_body_region ?? club.swim_england_region,
      affiliation_number: club.affiliation_number ?? club.swim_england_affiliate_number,
      tax_rate: club.tax_rate,
      tax_label: club.tax_label,
      tax_inclusive: club.tax_inclusive,
      tax_registration_number: club.tax_registration_number,
    };
  }
}
