import { AwardSchemeSource } from '@club-manager/shared-types';

/**
 * Starter award schemes a club can install into its own database.
 *
 * These are a fixture, not a code path: installing one writes ordinary
 * award_schemes and award_levels rows that the club then renames, reprices,
 * reorders, deactivates or deletes. Nothing in the module branches on which
 * scheme a level belongs to, so a club that runs neither of these loses
 * nothing by building its own from scratch.
 *
 * Fees are deliberately left unset. What a club charges for a badge and a
 * certificate is a club decision, and an unpriced level simply awards without
 * raising an invoice.
 *
 * [verify at build time] The Rise journey names are confirmed; the level
 * counts below are a workable starting structure rather than a transcription
 * of the Rise Hub catalogue, which has no public API. Re-check against
 * british-gymnastics.org before any compliance-facing copy quotes them.
 */

export interface DefaultAwardLevel {
  name: string;
  description: string | null;
  sort_order: number;
}

export interface DefaultAwardScheme {
  name: string;
  description: string;
  source: AwardSchemeSource;
  levels: DefaultAwardLevel[];
}

/** Builds a run of numbered levels, e.g. Explore 1 through Explore 8. */
function numberedLevels(
  prefix: string,
  count: number,
  startSortOrder: number,
  description: string,
): DefaultAwardLevel[] {
  return Array.from({ length: count }, (_unused, index) => ({
    name: `${prefix} ${index + 1}`,
    description,
    sort_order: startSortOrder + index,
  }));
}

const RISE: DefaultAwardScheme = {
  name: 'British Gymnastics Rise',
  description:
    'The British Gymnastics Rise programme, which is replacing the legacy Proficiency Awards. ' +
    'Three journeys: Discover for pre-school, Explore for recreational gymnasts and Excel for ' +
    'those moving towards development and performance work.',
  source: AwardSchemeSource.BG_RISE,
  levels: [
    ...numberedLevels('Discover', 3, 1, 'Rise Discover journey, pre-school gymnasts.'),
    ...numberedLevels('Explore', 8, 10, 'Rise Explore journey, recreational gymnasts.'),
    ...numberedLevels('Excel', 4, 30, 'Rise Excel journey, development and performance gymnasts.'),
  ],
};

const PROFICIENCY: DefaultAwardScheme = {
  name: 'Proficiency Awards (legacy)',
  description:
    'The legacy British Gymnastics Proficiency Awards, graded from Award 8 for a beginner up to ' +
    'Award 1. Kept available for clubs part-way through the move to Rise.',
  source: AwardSchemeSource.LEGACY_PROFICIENCY,
  levels: [
    { name: 'Preschool Award', description: 'Legacy pre-school award.', sort_order: 1 },
    // Award 8 is the entry grade and Award 1 the highest, so sort_order runs
    // the opposite way to the number in the name.
    ...Array.from({ length: 8 }, (_unused, index) => ({
      name: `Proficiency Award ${8 - index}`,
      description: 'Legacy general gymnastics proficiency award.',
      sort_order: 10 + index,
    })),
  ],
};

export const DEFAULT_AWARD_SCHEMES: DefaultAwardScheme[] = [RISE, PROFICIENCY];
