import { differenceInYears, format, parseISO } from 'date-fns';

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string | Date, referenceDate?: string | Date): number {
  const birthDate = typeof dob === 'string' ? parseISO(dob) : dob;
  const refDate = referenceDate
    ? typeof referenceDate === 'string'
      ? parseISO(referenceDate)
      : referenceDate
    : new Date();

  return differenceInYears(refDate, birthDate);
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
