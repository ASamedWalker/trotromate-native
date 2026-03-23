import { View, Text, StyleSheet } from 'react-native'
import { Star, Award, Flame } from 'lucide-react-native'
import { c, font } from '@/lib/theme'

type ContributorTier = 'reporter' | 'trusted' | 'top'

interface ContributorBadgeProps {
  tier: ContributorTier
  size?: 'small' | 'default'
}

const TIER_CONFIG: Record<ContributorTier, { label: string; color: string; Icon: typeof Star }> = {
  reporter: { label: 'Reporter', color: c.amber500, Icon: Star },
  trusted: { label: 'Trusted Reporter', color: '#8b5cf6', Icon: Award },
  top: { label: 'Top Contributor', color: '#f97316', Icon: Flame },
}

export function getContributorTier(reportCount: number): ContributorTier | null {
  if (reportCount >= 50) return 'top'
  if (reportCount >= 10) return 'trusted'
  if (reportCount >= 3) return 'reporter'
  return null
}

export function ContributorBadge({ tier, size = 'default' }: ContributorBadgeProps) {
  const { label, color, Icon } = TIER_CONFIG[tier]

  if (size === 'small') {
    return (
      <View style={[styles.smallBadge, { backgroundColor: `${color}18` }]}>
        <Icon size={11} color={color} />
      </View>
    )
  }

  return (
    <View style={[styles.badge, { backgroundColor: `${color}14` }]}>
      <Icon size={13} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  smallBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: font.semibold,
  },
})
