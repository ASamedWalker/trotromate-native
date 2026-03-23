import { View, Text, StyleSheet } from 'react-native'
import { ShieldCheck, TrainFront } from 'lucide-react-native'
import { font } from '@/lib/theme'

const GRDA_BLUE = '#0ea5e9'

interface GRDABadgeProps {
  size?: 'small' | 'default'
  label?: string
}

export function GRDABadge({ size = 'default', label }: GRDABadgeProps) {
  if (size === 'small') {
    return (
      <View style={styles.smallBadge}>
        <TrainFront size={11} color={GRDA_BLUE} />
      </View>
    )
  }

  return (
    <View style={styles.badge}>
      <ShieldCheck size={14} color={GRDA_BLUE} />
      <Text style={styles.badgeText}>{label ?? 'GRDA Official'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  smallBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(14,165,233,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14,165,233,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: GRDA_BLUE,
  },
})
