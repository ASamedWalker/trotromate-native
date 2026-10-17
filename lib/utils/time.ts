import { ageLabel } from '@/lib/utils/freshness'
/**
 * Ghana is UTC+0 (Africa/Accra) year-round with no daylight saving.
 * Using UTC methods is safe and avoids device-timezone mismatches.
 */
export function getGhanaTime() {
  const now = new Date()
  return {
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    seconds: now.getUTCSeconds(),
    day: now.getUTCDay(), // 0 = Sunday
  }
}

export function formatGhanaTime(): string {
  const { hours, minutes } = getGhanaTime()
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function timeAgo(dateString: string | null): string {
  if (!dateString) return 'No reports yet'
  // One wording app-wide: delegate to the canonical age label (freshness.ts).
  return ageLabel(dateString) || 'No reports yet'
}
