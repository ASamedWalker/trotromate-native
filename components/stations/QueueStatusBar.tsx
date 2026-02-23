import { View, StyleSheet } from 'react-native'
import { c } from '@/lib/theme'

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

const SEGMENT_COLORS: string[] = [
  '#22c55e', // empty
  '#22c55e', // short
  '#f59e0b', // moderate
  '#f97316', // long
  '#ef4444', // very_long
]

const STATUS_INDEX: Record<QueueStatus, number> = {
  empty: 0,
  short: 1,
  moderate: 2,
  long: 3,
  very_long: 4,
}

interface QueueStatusBarProps {
  status: QueueStatus | null
  isDark: boolean
}

export function QueueStatusBar({ status, isDark }: QueueStatusBarProps) {
  const fillCount = status ? STATUS_INDEX[status] + 1 : 0
  const emptyColor = isDark ? c.stone800 : c.stone200

  return (
    <View style={styles.container}>
      {SEGMENT_COLORS.map((color, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor: i < fillCount ? color : emptyColor,
              marginLeft: i > 0 ? 3 : 0,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    borderRadius: 3,
  },
})
