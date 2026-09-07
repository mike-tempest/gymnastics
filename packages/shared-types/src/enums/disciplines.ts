/**
 * Gymnastics disciplines, programme flags and squad types.
 *
 * British Gymnastics recognises ten core competitive disciplines
 * (docs/01-British-Gymnastics-Compliance-Brief.md section 7). They are modelled
 * here as plain configurable data: discipline drives filtering and reporting
 * only, never a separate code path. Nothing in the platform should branch on
 * the value beyond choosing what to show and what to count.
 *
 * Pre-school, adult and parkour are deliberately not disciplines. British
 * Gymnastics treats them as participation programmes, and a single squad can
 * carry more than one, so they live on their own list as programme flags.
 *
 * A gym club is a wide recreational base plus a narrow competitive pathway, so
 * a squad also records which of the two it belongs to. Recreational squads
 * carry a free-form level label (a Rise stage, or a club's own badge level);
 * competitive squads do not.
 */

/** The ten core British Gymnastics competitive disciplines. */
export enum Discipline {
  WOMENS_ARTISTIC = 'WOMENS_ARTISTIC',
  MENS_ARTISTIC = 'MENS_ARTISTIC',
  RHYTHMIC = 'RHYTHMIC',
  TRAMPOLINE = 'TRAMPOLINE',
  DOUBLE_MINI_TRAMPOLINE = 'DOUBLE_MINI_TRAMPOLINE',
  TUMBLING = 'TUMBLING',
  ACROBATIC = 'ACROBATIC',
  TEAMGYM = 'TEAMGYM',
  AEROBIC = 'AEROBIC',
  DISABILITY = 'DISABILITY',
}

/** Discipline names exactly as British Gymnastics writes them. */
export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  [Discipline.WOMENS_ARTISTIC]: "Women's Artistic Gymnastics",
  [Discipline.MENS_ARTISTIC]: "Men's Artistic Gymnastics",
  [Discipline.RHYTHMIC]: 'Rhythmic Gymnastics',
  [Discipline.TRAMPOLINE]: 'Trampoline',
  [Discipline.DOUBLE_MINI_TRAMPOLINE]: 'Double Mini Trampoline',
  [Discipline.TUMBLING]: 'Tumbling',
  [Discipline.ACROBATIC]: 'Acrobatic Gymnastics',
  [Discipline.TEAMGYM]: 'TeamGym',
  [Discipline.AEROBIC]: 'Aerobic Gymnastics',
  [Discipline.DISABILITY]: 'Disability Gymnastics',
};

/**
 * Short forms clubs actually say out loud. Used where a full discipline name
 * would crowd a chip or a filter, never as a stored value.
 */
export const DISCIPLINE_SHORT_LABELS: Record<Discipline, string> = {
  [Discipline.WOMENS_ARTISTIC]: 'WAG',
  [Discipline.MENS_ARTISTIC]: 'MAG',
  [Discipline.RHYTHMIC]: 'Rhythmic',
  [Discipline.TRAMPOLINE]: 'Trampoline',
  [Discipline.DOUBLE_MINI_TRAMPOLINE]: 'DMT',
  [Discipline.TUMBLING]: 'Tumbling',
  [Discipline.ACROBATIC]: 'Acro',
  [Discipline.TEAMGYM]: 'TeamGym',
  [Discipline.AEROBIC]: 'Aerobic',
  [Discipline.DISABILITY]: 'Disability',
};

/**
 * Participation programmes that sit alongside the disciplines. A squad can
 * carry several, so these are stored as a list rather than a single value.
 */
export enum ProgrammeFlag {
  PRE_SCHOOL = 'PRE_SCHOOL',
  ADULT = 'ADULT',
  PARKOUR = 'PARKOUR',
}

export const PROGRAMME_FLAG_LABELS: Record<ProgrammeFlag, string> = {
  [ProgrammeFlag.PRE_SCHOOL]: 'Pre-school',
  [ProgrammeFlag.ADULT]: 'Adult',
  [ProgrammeFlag.PARKOUR]: 'Parkour',
};

/**
 * Which side of the club a squad sits on. Recreational badge classes and
 * competitive squads use the same record and coexist in the same list; this
 * flag is what separates them for filtering and reporting.
 */
export enum SquadType {
  RECREATIONAL = 'recreational',
  COMPETITIVE = 'competitive',
}

export const SQUAD_TYPE_LABELS: Record<SquadType, string> = {
  [SquadType.RECREATIONAL]: 'Recreational',
  [SquadType.COMPETITIVE]: 'Competitive',
};

/** Ordered discipline list for dropdowns and filters, in the BG listing order. */
export const ORDERED_DISCIPLINES: Discipline[] = [
  Discipline.WOMENS_ARTISTIC,
  Discipline.MENS_ARTISTIC,
  Discipline.RHYTHMIC,
  Discipline.TRAMPOLINE,
  Discipline.DOUBLE_MINI_TRAMPOLINE,
  Discipline.TUMBLING,
  Discipline.ACROBATIC,
  Discipline.TEAMGYM,
  Discipline.AEROBIC,
  Discipline.DISABILITY,
];

/** Narrowing guard for values arriving from a query string or an import. */
export function isDiscipline(value: unknown): value is Discipline {
  return typeof value === 'string' && (Object.values(Discipline) as string[]).includes(value);
}

/** Narrowing guard for a squad type arriving from a query string. */
export function isSquadType(value: unknown): value is SquadType {
  return typeof value === 'string' && (Object.values(SquadType) as string[]).includes(value);
}

/** Narrowing guard for a programme flag arriving from a query string or import. */
export function isProgrammeFlag(value: unknown): value is ProgrammeFlag {
  return typeof value === 'string' && (Object.values(ProgrammeFlag) as string[]).includes(value);
}

/** Full display name for a discipline, or a dash when none is recorded. */
export function disciplineLabel(discipline: Discipline | null | undefined): string {
  return discipline ? DISCIPLINE_LABELS[discipline] : '-';
}
