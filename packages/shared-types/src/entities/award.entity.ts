/**
 * Award scheme types shared between the membership service and the web app.
 *
 * Award schemes are data, never hard-coded: British Gymnastics Rise, the
 * legacy Proficiency Awards and a club's own scheme are all rows in the same
 * two tables. These types describe the shape of those rows; the scheme
 * catalogue itself lives in the database and is installed from a fixture.
 */

/** Where a scheme came from. Drives labelling and the Rise CSV bridge only. */
export enum AwardSchemeSource {
  BG_RISE = 'bg-rise',
  LEGACY_PROFICIENCY = 'legacy-proficiency',
  CUSTOM = 'custom',
}

/** Where a member has got to on one level of one scheme. */
export enum AwardProgressStatus {
  WORKING_TOWARDS = 'working_towards',
  ASSESSED = 'assessed',
  AWARDED = 'awarded',
}

/** The result recorded for one member at one assessment. */
export enum AssessmentOutcomeResult {
  AWARDED = 'awarded',
  NOT_YET = 'not_yet',
  WORKING_TOWARDS = 'working_towards',
}

export interface AwardSchemeSummary {
  scheme_id: string;
  club_id: string;
  name: string;
  description: string | null;
  source: AwardSchemeSource;
  active: boolean;
}

export interface AwardLevelSummary {
  level_id: string;
  club_id: string;
  scheme_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** Charged to the family when the badge is awarded. Null means no charge. */
  badge_fee: number | null;
  /** Charged alongside the badge when set. Null means no charge. */
  certificate_fee: number | null;
  active: boolean;
}
