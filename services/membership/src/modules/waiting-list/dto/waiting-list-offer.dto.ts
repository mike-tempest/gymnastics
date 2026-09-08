import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_OFFER_WINDOW_DAYS, MIN_OFFER_WINDOW_DAYS } from '@club-manager/shared-types';

/**
 * A manual offer: the club picks the entry and the squad itself. This is the
 * fallback path. Auto-offer runs on every capacity event without anyone
 * asking (docs/05, product rule 3).
 */
export class CreateOfferDto {
  @IsUUID()
  squad_id: string;

  /** Overrides the club's offer_window_days for this one offer. */
  @IsInt()
  @Min(MIN_OFFER_WINDOW_DAYS)
  @Max(MAX_OFFER_WINDOW_DAYS)
  @IsOptional()
  expires_in_days?: number;
}

export class DeclineOfferDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

/** Admin enrolment straight off the list, skipping the offer round trip. */
export class EnrolFromWaitingListDto {
  /**
   * Which squad the child joins. Optional: without it the child becomes a
   * member with no squad place, which is a legitimate half-step when the club
   * has not decided where they go yet.
   */
  @IsUUID()
  @IsOptional()
  squad_id?: string;
}

export class UpdateWaitingListSettingsDto {
  @IsBoolean()
  @IsOptional()
  auto_offer_enabled?: boolean;

  @IsInt()
  @Min(MIN_OFFER_WINDOW_DAYS)
  @Max(MAX_OFFER_WINDOW_DAYS)
  @IsOptional()
  offer_window_days?: number;
}
