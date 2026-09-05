import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GoverningBody } from '@club-manager/shared-types';

/**
 * Club details supplied at self-serve signup. Only the name is required; the
 * remaining fields seed the club record and its settings.
 */
export class RegisterClubDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /**
   * The club's national governing body (e.g. SWIM_ENGLAND, USA_SWIMMING). When
   * omitted, or when the value is not valid for the club's country, the
   * country's default body is used instead (see COUNTRY_GOVERNING_BODIES).
   */
  @IsString()
  @IsOptional()
  @IsIn(Object.values(GoverningBody))
  governing_body?: string;

  /**
   * Region or division within the governing body (e.g. a Swim England region,
   * an LSC for USA Swimming). Superseded field for swim_england_region.
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  governing_body_region?: string;

  /**
   * The club's affiliation number with its governing body. Superseded field for
   * affiliate_number.
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  affiliation_number?: string;

  /** @deprecated Superseded by governing_body_region; still accepted. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  swim_england_region?: string;

  /** @deprecated Superseded by affiliation_number; still accepted. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  affiliate_number?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  county?: string;

  @IsEmail()
  @IsOptional()
  contact_email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  website?: string;

  /**
   * ISO 3166-1 alpha-2 country code (e.g. GB, US). Defaults to GB when omitted.
   */
  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  /**
   * ISO 4217 currency code (e.g. GBP, USD). When omitted it is derived from the
   * country, falling back to GBP.
   */
  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string;

  /**
   * IANA timezone (e.g. Europe/London, America/New_York). When omitted, or
   * when the value is not a valid choice for the club's country, the country's
   * default timezone is used instead.
   */
  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string;

  /**
   * BCP 47 locale (e.g. en-GB, en-US). When omitted it is derived from the
   * country, falling back to en-GB.
   */
  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;
}

/**
 * The first admin account created alongside the new club. Becomes a
 * `super_admin` scoped to the new club.
 */
export class RegisterClubAdminDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterClubDto {
  @ValidateNested()
  @Type(() => RegisterClubDetailsDto)
  club: RegisterClubDetailsDto;

  @ValidateNested()
  @Type(() => RegisterClubAdminDto)
  admin: RegisterClubAdminDto;
}
