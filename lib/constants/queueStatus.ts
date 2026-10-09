import type { QueueStatus } from '@/lib/services/stations'

// One word + one colour per queue state. Status is always a word plus a mark,
// never colour alone (redesign §4). Colours pass 4.5:1 on white.
export const QUEUE_WORD: Record<QueueStatus, string> = {
  empty: 'Cars waiting',
  short: 'Small queue',
  moderate: 'Moderate',
  long: 'Long queue',
  very_long: 'Very long',
}

export const QUEUE_COLOR: Record<QueueStatus, string> = {
  empty: '#15803D',
  short: '#15803D',
  moderate: '#B45309',
  long: '#C2410C',
  very_long: '#B91C1C',
}
