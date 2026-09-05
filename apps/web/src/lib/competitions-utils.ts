import { CompetitionStatus, CompetitionType, Course, QualifyingTime } from '@club-manager/shared-types';

export const COMPETITION_STATUS_STYLES: Record<CompetitionStatus, string> = {
  [CompetitionStatus.DRAFT]: 'bg-white/10 text-grey-300',
  [CompetitionStatus.OPEN]: 'bg-green-500/20 text-green-400',
  [CompetitionStatus.CLOSED]: 'bg-amber-500/20 text-amber-400',
  [CompetitionStatus.RESULTS_PUBLISHED]: 'bg-blue-500/20 text-blue-400',
};

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  [CompetitionStatus.DRAFT]: 'Draft',
  [CompetitionStatus.OPEN]: 'Open',
  [CompetitionStatus.CLOSED]: 'Closed',
  [CompetitionStatus.RESULTS_PUBLISHED]: 'Results Published',
};

const GB_COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  [CompetitionType.OPEN_MEET]: 'Open Meet',
  [CompetitionType.COUNTY]: 'County',
  [CompetitionType.REGIONAL]: 'Regional',
  [CompetitionType.NATIONAL]: 'National',
  [CompetitionType.CLUB_GALA]: 'Club Gala',
  [CompetitionType.TIME_TRIAL]: 'Time Trial',
};

// Australian clubs use carnival vocabulary and a district/state tier structure.
// The enum values are unchanged; only the display labels differ by country.
const AU_COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  [CompetitionType.OPEN_MEET]: 'Carnival',
  [CompetitionType.COUNTY]: 'District',
  [CompetitionType.REGIONAL]: 'State',
  [CompetitionType.NATIONAL]: 'National',
  [CompetitionType.CLUB_GALA]: 'Club Night',
  [CompetitionType.TIME_TRIAL]: 'Time Trial',
};

/**
 * Competition type display labels for a club country. GB labels are the
 * default for unknown or missing countries, preserving existing behaviour.
 */
export function competitionTypeLabels(country?: string): Record<CompetitionType, string> {
  return country === 'AU' ? AU_COMPETITION_TYPE_LABELS : GB_COMPETITION_TYPE_LABELS;
}

export function formatCompetitionDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function courseLabel(course: Course | string): string {
  return course === Course.SHORT_COURSE ? 'Short Course (25m)' : 'Long Course (50m)';
}

/**
 * Format a number of seconds as a zero-padded swim time `MM:SS.ss`.
 *
 * Rounds to two decimal places and carries correctly across the minute
 * boundary, so 59.999 yields `01:00.00` rather than `00:60.00`. The carry is
 * automatic because we work entirely in integer hundredths of a second.
 *
 * Missing values (null/undefined) render as `-`; negative values render as `--`.
 */
export function formatSwimTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 0) return '--';

  // Work in integer hundredths so rounding carries into seconds and minutes.
  const totalHundredths = Math.round(seconds * 100);
  const minutes = Math.floor(totalHundredths / 6000);
  const remainingHundredths = totalHundredths % 6000;
  const secs = Math.floor(remainingHundredths / 100);
  const hundredths = remainingHundredths % 100;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * Parse a swim time typed by a user into seconds. Accepts plain seconds
 * ("65.23"), minutes and seconds ("1:05.23"), and tolerates whitespace.
 * Returns null for anything unparseable or non-positive.
 */
export function parseSwimTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(?:(\d{1,3}):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!match) return null;

  const minutes = match[1] ? parseInt(match[1], 10) : 0;
  const seconds = parseFloat(match[2]);
  if (Number.isNaN(seconds) || (match[1] && seconds >= 60)) return null;

  const total = minutes * 60 + seconds;
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

/**
 * Find the qualifying standard for an event, if the meet defines one.
 */
export function findQualifyingTime(
  qualifyingTimes: QualifyingTime[] | null | undefined,
  distance: number,
  stroke: string,
): QualifyingTime | undefined {
  return qualifyingTimes?.find((qt) => qt.distance === distance && qt.stroke === stroke);
}
