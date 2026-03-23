import { View, Text, StyleSheet } from 'react-native'
import { ShieldCheck } from 'lucide-react-native'
import { font } from '@/lib/theme'

const GPRTU_GREEN = '#16a34a'

interface GPRTUBadgeProps {
  size?: 'small' | 'default'
  approvedDate?: string | null
}

export function GPRTUBadge({ size = 'default', approvedDate }: GPRTUBadgeProps) {
  if (size === 'small') {
    return (
      <View style={styles.smallBadge}>
        <ShieldCheck size={12} color={GPRTU_GREEN} />
      </View>
    )
  }

  const dateLabel = approvedDate
    ? new Date(approvedDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null

  return (
    <View style={styles.badge}>
      <ShieldCheck size={14} color={GPRTU_GREEN} />
      <Text style={styles.badgeText}>GPRTU Verified</Text>
      {dateLabel && <Text style={styles.dateText}>{dateLabel}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  smallBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(22,163,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22,163,74,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: GPRTU_GREEN,
  },
  dateText: {
    fontSize: 10,
    fontFamily: font.regular,
    color: '#15803d',
  },
})
