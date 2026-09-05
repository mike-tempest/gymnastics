import {
  IsString,
  IsEmail,
  IsIn,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { GoverningBody } from '@club-manager/shared-types';

export class LocationDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  address: string;

  laneCount: number;
}

export class UpdateClubSettingsDto {
  @IsOptional()
  @IsString()
  club_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  /**
   * The club's national governing body (e.g. SWIM_ENGLAND, USA_SWIMMING).
   * Validated against the club's country at write time; writes to the Club
   * entity, not the settings row.
   */
  @IsOptional()
  @IsString()
  @IsIn(Object.values(GoverningBody))
  governing_body?: string;

  /** Region or division within the governing body. Writes to the Club entity. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  governing_body_region?: string;

  /** The club's affiliation number. Writes to the Club entity. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  affiliation_number?: string;

  /**
   * @deprecated Legacy JSONB affiliation blob still accepted from old clients.
   * Its `affiliate_number` is mapped onto the affiliation_number column rather
   * than stored as JSONB.
   */
  @IsOptional()
  @IsObject()
  swim_england?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  locations?: LocationDto[];

  @IsOptional()
  @IsObject()
  billing_config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  notification_prefs?: Record<string, unknown>;

  /**
   * IANA timezone for the club (e.g. Europe/London, America/Chicago). Written
   * to the Club entity, not the settings row, and only accepted when it is a
   * valid choice for the club's country. The club's country and currency are
   * deliberately NOT updatable through this endpoint.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /**
   * Percentage tax rate applied to invoices (e.g. 20 for UK VAT, 8.25 for a US
   * sales tax). Written to the Club entity, not the settings row. Must be
   * between 0 and 100 inclusive; null clears the rate so no tax is applied.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tax_rate?: number | null;

  /** Customer-facing name of the tax (VAT, Sales tax, GST, HST). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tax_label?: string | null;

  /**
   * Whether the club's prices already include tax (the Australian GST
   * convention). Written to the Club entity, not the settings row. When true,
   * invoice totals treat the line-item sum as the gross amount and back the
   * tax out of it; when false (the default), tax is added on top.
   */
  @IsOptional()
  @IsBoolean()
  tax_inclusive?: boolean;

  /**
   * The club's tax registration identifier (ABN for AU, VAT number for GB,
   * GST/HST number for CA). Written to the Club entity, not the settings row.
   * Spaces are stripped before storage; the stripped value must fit in 32
   * characters. Null clears the number.
   */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  tax_registration_number?: string | null;
}
