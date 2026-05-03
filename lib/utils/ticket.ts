/** Generate a unique trip code: TRO-XXXX-YYYY */
export function generateTripCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 for clarity
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `TRO-${part(4)}-${part(4)}`
}

/** Format milliseconds to HH:MM:SS */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** Get gradient color pair based on animation phase (0-1) */
export const GRADIENT_COLORS = [
  ['#FF716A', '#FFAD3A'],  // coral → amber
  ['#FFAD3A', '#8B5CF6'],  // amber → violet
  ['#8B5CF6', '#10B981'],  // violet → emerald
  ['#10B981', '#FF716A'],  // emerald → coral
] as const

export function getGradientIndex(tick: number): number {
  return Math.floor(tick) % GRADIENT_COLORS.length
}
