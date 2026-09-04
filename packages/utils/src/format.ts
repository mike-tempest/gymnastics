/**
 * Format currency in GBP
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

/**
 * Format time in seconds to MM:SS.ss format
 */
export function formatSwimTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`;
}

/**
 * Parse swim time from MM:SS.ss to seconds
 */
export function parseSwimTime(timeString: string): number {
  const [minutes, seconds] = timeString.split(':').map(parseFloat);
  return minutes * 60 + seconds;
}

/**
 * Generate initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Format full name
 */
export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
