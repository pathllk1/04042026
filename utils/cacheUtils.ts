/**
 * Utility functions for managing cache validation and refresh timing
 */

/**
 * Checks if the provided date is from today
 * @param date The date to check
 * @returns boolean indicating if the date is from today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

/**
 * Checks if the provided date is older than the specified minutes
 * @param date The date to check
 * @param minutes The number of minutes to compare against
 * @returns boolean indicating if the date is older than the specified minutes
 */
export function isOlderThanMinutes(date: Date, minutes: number): boolean {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes > minutes;
}

/**
 * Gets the cache key for a specific date
 * @param prefix The prefix for the cache key
 * @returns A string in the format prefix_YYYY-MM-DD
 */
export function getDateCacheKey(prefix: string): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  return `${prefix}_${dateStr}`;
}

/**
 * Formats a timestamp for display in logs
 * @returns Formatted timestamp string
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}
