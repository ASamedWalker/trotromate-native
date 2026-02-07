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
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
