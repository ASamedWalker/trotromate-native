import { View } from 'react-native'
import type { Freshness } from '@/lib/utils/freshness'

// Filled dot < 30 min, hollow ring < 2 h, grey dash after (redesign §4).
// Never animated: a pulse would imply "live", which crowd reports are not.
export function FreshnessDot({ kind, color, size = 10 }: { kind: Freshness; color: string; size?: number }) {
  if (kind === 'stale') {
    return <View style={{ width: size + 2, height: 3, borderRadius: 2, backgroundColor: '#9CA3AF' }} />
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: kind === 'fresh' ? color : 'transparent',
        borderWidth: kind === 'aging' ? 2 : 0, borderColor: color,
        opacity: kind === 'aging' ? 0.75 : 1,
      }}
    />
  )
}
