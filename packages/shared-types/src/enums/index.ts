// Gender
export enum Gender {
  MALE = 'M',
  FEMALE = 'F',
  OTHER = 'X',
}

// Stroke types
export enum Stroke {
  FREESTYLE = 'FR',
  BACKSTROKE = 'BK',
  BREASTSTROKE = 'BR',
  BUTTERFLY = 'FL',
  INDIVIDUAL_MEDLEY = 'IM',
  MEDLEY_RELAY = 'MR',
}

// Course types
export enum Course {
  LONG_COURSE = 'LC', // 50m
  SHORT_COURSE = 'SC', // 25m
}

// Fee frequency
export enum FeeFrequency {
  MONTHLY = 'monthly',
  TERM = 'term',
  ANNUAL = 'annual',
  ONE_TIME = 'one_time',
}

// Applies to type for fee structures
export enum AppliesToType {
  CLUB = 'club',
  SQUAD = 'squad',
  SWIMMER = 'swimmer',
}

// Invoice status
export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

// Payment method
export enum PaymentMethod {
  DIRECT_DEBIT = 'direct_debit',
  CARD = 'card',
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  OTHER = 'other',
}

// Payment status
export enum PaymentStatus {
  PENDING_SUBMISSION = 'pending_submission',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

// User roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TREASURER = 'treasurer',
  HEAD_COACH = 'head_coach',
  SQUAD_COACH = 'squad_coach',
  WELFARE_OFFICER = 'welfare_officer',
  COMPETITION_SECRETARY = 'competition_secretary',
  PARENT = 'parent',
  SWIMMER_ADULT = 'swimmer_adult',
  SWIMMER_MINOR = 'swimmer_minor',
}

// Entry status
export enum EntryStatus {
  ENTERED = 'entered',
  SCRATCHED = 'scratched',
  SWUM = 'swum',
}

// Message channel type
export enum MessageChannelType {
  CLUB_WIDE = 'club_wide',
  SQUAD = 'squad',
  INDIVIDUAL = 'individual',
}

// Notification type
export enum NotificationType {
  MESSAGE = 'message',
  PAYMENT = 'payment',
  SESSION = 'session',
  ALERT = 'alert',
  MEET = 'meet',
}

// Consent type
export enum ConsentType {
  PHOTOGRAPHY = 'photography',
  VIDEO = 'video',
  TRANSPORT = 'transport',
  DATA_SHARING = 'data_sharing',
  MEDICAL = 'medical',
  EMERGENCY_CONTACT = 'emergency_contact',
}

// Swim England membership category
export enum SECategory {
  CAT1_TRAIN = 'cat1_train', // Club Train - £10.75
  CAT2_COMPETE = 'cat2_compete', // Club Compete - £33.95
  CAT3_SUPPORT = 'cat3_support', // Club Support - £6.20
}

// Session status
export enum SessionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Direct Debit Mandate status
export enum DirectDebitMandateStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

// Competition type
export enum CompetitionType {
  OPEN_MEET = 'open_meet',
  COUNTY = 'county',
  REGIONAL = 'regional',
  NATIONAL = 'national',
  CLUB_GALA = 'club_gala',
  TIME_TRIAL = 'time_trial',
}

// Competition status
export enum CompetitionStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  RESULTS_PUBLISHED = 'results_published',
}

// Competition entry status
export enum CompetitionEntryStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  WITHDRAWN = 'withdrawn',
}

// National governing body a swimmer or club is registered with
export enum GoverningBody {
  SWIM_ENGLAND = 'SWIM_ENGLAND',
  SCOTTISH_SWIMMING = 'SCOTTISH_SWIMMING',
  SWIM_WALES = 'SWIM_WALES',
  SWIM_IRELAND = 'SWIM_IRELAND',
  USA_SWIMMING = 'USA_SWIMMING',
  SWIMMING_CANADA = 'SWIMMING_CANADA',
  SWIMMING_AUSTRALIA = 'SWIMMING_AUSTRALIA',
}

// Human-readable labels for each governing body
export const GOVERNING_BODY_LABELS: Record<GoverningBody, string> = {
  [GoverningBody.SWIM_ENGLAND]: 'Swim England',
  [GoverningBody.SCOTTISH_SWIMMING]: 'Scottish Swimming',
  [GoverningBody.SWIM_WALES]: 'Swim Wales',
  [GoverningBody.SWIM_IRELAND]: 'Swim Ireland',
  [GoverningBody.USA_SWIMMING]: 'USA Swimming',
  [GoverningBody.SWIMMING_CANADA]: 'Swimming Canada',
  [GoverningBody.SWIMMING_AUSTRALIA]: 'Swimming Australia',
};

// Background check type. GB values predate the international ones and must
// keep their exact names: existing dbs_checks rows store them as varchar.
export enum BackgroundCheckType {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  ENHANCED = 'ENHANCED',
  ENHANCED_BARRED = 'ENHANCED_BARRED',
  SAFESPORT_CERTIFICATION = 'SAFESPORT_CERTIFICATION',
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  CRIMINAL_RECORD_CHECK = 'CRIMINAL_RECORD_CHECK',
  VULNERABLE_SECTOR_CHECK = 'VULNERABLE_SECTOR_CHECK',
  WORKING_WITH_CHILDREN_CHECK = 'WORKING_WITH_CHILDREN_CHECK',
  GARDA_VETTING = 'GARDA_VETTING',
  // Australian state and territory schemes that are not plain WWCCs. NSW,
  // VIC, WA and SA reuse WORKING_WITH_CHILDREN_CHECK with per-state labels.
  BLUE_CARD = 'BLUE_CARD',
  OCHRE_CARD = 'OCHRE_CARD',
  WWVP_REGISTRATION = 'WWVP_REGISTRATION',
  RWVP_REGISTRATION = 'RWVP_REGISTRATION',
}

/** Australian states and territories, used for governing_body_region. */
export const AU_STATES: { code: string; label: string }[] = [
  { code: 'NSW', label: 'New South Wales' },
  { code: 'VIC', label: 'Victoria' },
  { code: 'QLD', label: 'Queensland' },
  { code: 'WA', label: 'Western Australia' },
  { code: 'SA', label: 'South Australia' },
  { code: 'TAS', label: 'Tasmania' },
  { code: 'ACT', label: 'Australian Capital Territory' },
  { code: 'NT', label: 'Northern Territory' },
];

// Lifecycle status of a background check (previously DBSStatus)
export enum BackgroundCheckStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON', // Within 90 days of expiry
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

/**
 * Everything the product needs to speak a governing body's language: the
 * safeguarding framework it publishes, the background checks it requires, and
 * what it calls a member's registration number. GB entries reproduce the
 * previously hardcoded strings exactly, which is the regression bar for
 * existing UK clubs.
 */
export interface GoverningBodyCheckType {
  value: BackgroundCheckType;
  label: string;
  /** Typical validity period in years, where the scheme publishes one. */
  renewalYears?: number;
  /**
   * Region codes (e.g. Australian state codes) the check applies to. A check
   * without regions applies body-wide.
   */
  regions?: string[];
}

export interface GoverningBodyConfig {
  label: string;
  /** ISO 3166-1 alpha-2 country the body governs. */
  country: string;
  /** What the body calls a member's registration number. */
  registrationNumberLabel: string;
  /** Short name of the background-check framework. */
  backgroundCheckFramework: string;
  /**
   * Abbreviated framework name for tight surfaces (navigation, column
   * headings, "X number" labels). "DBS" for Swim England, "WWCC" for
   * Swimming Australia.
   */
  backgroundCheckShortLabel: string;
  /** Label for a check's certificate, card or reference number. */
  certificateNumberLabel: string;
  /** Check types this body's clubs record, with display labels. */
  backgroundCheckTypes: GoverningBodyCheckType[];
  /** Name of the safeguarding framework or policy suite. */
  safeguardingFramework: string;
  /** What the body calls the club's designated safeguarding officer. */
  safeguardingOfficerLabel: string;
  /** Who member data is shared with for the data-sharing consent. */
  dataSharingRecipient: string;
}

const DBS_CHECK_TYPES: GoverningBodyCheckType[] = [
  { value: BackgroundCheckType.BASIC, label: 'Basic DBS Check' },
  { value: BackgroundCheckType.STANDARD, label: 'Standard DBS Check' },
  { value: BackgroundCheckType.ENHANCED, label: 'Enhanced DBS Check' },
  {
    value: BackgroundCheckType.ENHANCED_BARRED,
    label: 'Enhanced DBS Check with Barred Lists',
  },
];

export const GOVERNING_BODY_CONFIG: Record<GoverningBody, GoverningBodyConfig> = {
  [GoverningBody.SWIM_ENGLAND]: {
    label: 'Swim England',
    country: 'GB',
    registrationNumberLabel: 'SE number',
    backgroundCheckFramework: 'DBS',
    backgroundCheckShortLabel: 'DBS',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: DBS_CHECK_TYPES,
    safeguardingFramework: 'Wavepower',
    safeguardingOfficerLabel: 'Club Welfare Officer',
    dataSharingRecipient: 'Swim England',
  },
  [GoverningBody.SCOTTISH_SWIMMING]: {
    label: 'Scottish Swimming',
    country: 'GB',
    registrationNumberLabel: 'Membership number',
    backgroundCheckFramework: 'PVG',
    backgroundCheckShortLabel: 'PVG',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: [
      ...DBS_CHECK_TYPES,
      {
        value: BackgroundCheckType.BACKGROUND_CHECK,
        label: 'PVG Scheme Membership',
      },
    ],
    safeguardingFramework: 'Scottish Swimming Wellbeing and Protection',
    safeguardingOfficerLabel: 'Club Welfare Officer',
    dataSharingRecipient: 'Scottish Swimming',
  },
  [GoverningBody.SWIM_WALES]: {
    label: 'Swim Wales',
    country: 'GB',
    registrationNumberLabel: 'Membership number',
    backgroundCheckFramework: 'DBS',
    backgroundCheckShortLabel: 'DBS',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: DBS_CHECK_TYPES,
    safeguardingFramework: 'Swim Wales Safeguarding',
    safeguardingOfficerLabel: 'Club Welfare Officer',
    dataSharingRecipient: 'Swim Wales',
  },
  [GoverningBody.SWIM_IRELAND]: {
    label: 'Swim Ireland',
    country: 'IE',
    registrationNumberLabel: 'Membership number',
    backgroundCheckFramework: 'Garda vetting',
    backgroundCheckShortLabel: 'Vetting',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: [
      { value: BackgroundCheckType.GARDA_VETTING, label: 'Garda Vetting' },
    ],
    safeguardingFramework: 'Swim Ireland Safeguarding',
    safeguardingOfficerLabel: 'Safeguarding Officer',
    dataSharingRecipient: 'Swim Ireland',
  },
  [GoverningBody.USA_SWIMMING]: {
    label: 'USA Swimming',
    country: 'US',
    registrationNumberLabel: 'USA Swimming ID',
    backgroundCheckFramework: 'SafeSport',
    backgroundCheckShortLabel: 'SafeSport',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: [
      {
        value: BackgroundCheckType.SAFESPORT_CERTIFICATION,
        label: 'SafeSport Certification',
      },
      {
        value: BackgroundCheckType.BACKGROUND_CHECK,
        label: 'USA Swimming Background Check',
      },
    ],
    safeguardingFramework: 'Safe Sport',
    safeguardingOfficerLabel: 'Safeguarding Officer',
    dataSharingRecipient: 'USA Swimming',
  },
  [GoverningBody.SWIMMING_CANADA]: {
    label: 'Swimming Canada',
    country: 'CA',
    registrationNumberLabel: 'Swimming Canada ID',
    backgroundCheckFramework: 'Background screening',
    backgroundCheckShortLabel: 'Screening',
    certificateNumberLabel: 'Certificate number',
    backgroundCheckTypes: [
      {
        value: BackgroundCheckType.CRIMINAL_RECORD_CHECK,
        label: 'Criminal Record Check',
      },
      {
        value: BackgroundCheckType.VULNERABLE_SECTOR_CHECK,
        label: 'Vulnerable Sector Check',
      },
    ],
    safeguardingFramework: 'Safe Sport',
    safeguardingOfficerLabel: 'Safeguarding Officer',
    dataSharingRecipient: 'Swimming Canada',
  },
  [GoverningBody.SWIMMING_AUSTRALIA]: {
    label: 'Swimming Australia',
    country: 'AU',
    registrationNumberLabel: 'Member number',
    backgroundCheckFramework: 'Working With Children Check',
    backgroundCheckShortLabel: 'WWCC',
    certificateNumberLabel: 'Card or application number',
    // Working-with-children checks are state and territory schemes, each
    // with its own name and validity period. NSW, VIC, WA and SA store the
    // shared WORKING_WITH_CHILDREN_CHECK value with per-state labels; QLD,
    // TAS, ACT and NT run distinctly named schemes.
    backgroundCheckTypes: [
      {
        value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
        label: 'Working With Children Check (NSW)',
        renewalYears: 5,
        regions: ['NSW'],
      },
      {
        value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
        label: 'Working With Children Check (VIC)',
        renewalYears: 5,
        regions: ['VIC'],
      },
      {
        value: BackgroundCheckType.BLUE_CARD,
        label: 'Blue Card (QLD)',
        renewalYears: 3,
        regions: ['QLD'],
      },
      {
        value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
        label: 'Working With Children Check Card (WA)',
        renewalYears: 3,
        regions: ['WA'],
      },
      {
        value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
        label: 'Working With Children Check (SA)',
        renewalYears: 5,
        regions: ['SA'],
      },
      {
        value: BackgroundCheckType.RWVP_REGISTRATION,
        label: 'Registration to Work with Vulnerable People (TAS)',
        renewalYears: 3,
        regions: ['TAS'],
      },
      {
        value: BackgroundCheckType.WWVP_REGISTRATION,
        label: 'Working with Vulnerable People registration (ACT)',
        renewalYears: 3,
        regions: ['ACT'],
      },
      {
        value: BackgroundCheckType.OCHRE_CARD,
        label: 'Ochre Card (NT)',
        renewalYears: 2,
        regions: ['NT'],
      },
    ],
    // "Safe Sport" (not "Safe Sport framework") so composed strings such as
    // "Safe Sport compliance" and "Safe Sport requirements" read naturally.
    safeguardingFramework: 'Safe Sport',
    safeguardingOfficerLabel: 'Member Protection Information Officer (MPIO)',
    dataSharingRecipient: 'Swimming Australia',
  },
};

/** Governing bodies available to clubs in each supported country. */
export const COUNTRY_GOVERNING_BODIES: Record<string, GoverningBody[]> = {
  GB: [GoverningBody.SWIM_ENGLAND, GoverningBody.SCOTTISH_SWIMMING, GoverningBody.SWIM_WALES],
  IE: [GoverningBody.SWIM_IRELAND],
  US: [GoverningBody.USA_SWIMMING],
  CA: [GoverningBody.SWIMMING_CANADA],
  AU: [GoverningBody.SWIMMING_AUSTRALIA],
};

/** Default governing body for a club country; Swim England for GB and unknowns. */
export function defaultGoverningBodyForCountry(country?: string | null): GoverningBody {
  const bodies = COUNTRY_GOVERNING_BODIES[(country ?? 'GB').toUpperCase()];
  return bodies?.[0] ?? GoverningBody.SWIM_ENGLAND;
}

/** Config for a governing body, falling back to Swim England (the GB default). */
export function governingBodyConfig(body?: GoverningBody | string | null): GoverningBodyConfig {
  if (body && body in GOVERNING_BODY_CONFIG) {
    return GOVERNING_BODY_CONFIG[body as GoverningBody];
  }
  return GOVERNING_BODY_CONFIG[GoverningBody.SWIM_ENGLAND];
}

/** Governing bodies on UK background-check regimes (7-digit SE-style numbers). */
export const UK_GOVERNING_BODIES: GoverningBody[] = [
  GoverningBody.SWIM_ENGLAND,
  GoverningBody.SCOTTISH_SWIMMING,
  GoverningBody.SWIM_WALES,
];

/**
 * Framework name with any trailing "Check"/"Checks" stripped, for copy that
 * appends its own noun ("X checks", "X check tracker"). "DBS" stays "DBS";
 * "Working With Children Check" becomes "Working With Children" so the UI
 * never reads "Working With Children Check checks".
 */
export function checkNoun(framework: string): string {
  return framework.replace(/\s+checks?$/i, '');
}

/**
 * A body's check types ordered for a club in the given region: types that
 * apply to the region first, then the rest. Volunteers can hold interstate
 * checks, so nothing is hidden. Without a region (or with a region no type
 * names) the configured order is returned unchanged.
 */
export function orderedBackgroundCheckTypes(
  config: GoverningBodyConfig,
  region?: string | null,
): GoverningBodyCheckType[] {
  if (!region) return config.backgroundCheckTypes;
  const inRegion = config.backgroundCheckTypes.filter((type) => type.regions?.includes(region));
  if (inRegion.length === 0) return config.backgroundCheckTypes;
  const elsewhere = config.backgroundCheckTypes.filter(
    (type) => !type.regions?.includes(region),
  );
  return [...inRegion, ...elsewhere];
}
