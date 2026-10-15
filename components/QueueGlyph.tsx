import { View } from 'react-native'
import { User } from 'lucide-react-native'
import type { QueueStatus } from '@/lib/services/stations'

// How many of the 3 people are filled for each queue state (UX v2 H11).
// Always render it next to the word (QUEUE_WORD): the glyph is never the only signal.
export const QUEUE_FILL: Record<QueueStatus, number> = {
  empty: 0,
  short: 1,
  moderate: 2,
  long: 2,
  very_long: 3,
}

interface Props {
  status: QueueStatus | null | undefined
  color: string
  /** icon size; 14 inline, 24 for heroes */
  size?: number
  /** dim the whole glyph (aging / stale reports) */
  opacity?: number
}

/** Three person icons, 0–3 filled by queue length. Decorative: pair it with the word. */
export function QueueGlyph({ status, color, size = 14, opacity = 1 }: Props) {
  const filled = status ? QUEUE_FILL[status] ?? 0 : 0
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 1, opacity }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[0, 1, 2].map((k) => (
        <User
          key={k}
          size={size}
          color={color}
          strokeWidth={2.2}
          fill={k < filled ? color : 'transparent'}
          opacity={k < filled ? 1 : 0.55}
        />
      ))}
    </View>
  )
}
