import { View, Text, StyleSheet } from 'react-native'
import { Zap, Clock, AlertTriangle, Minus } from 'lucide-react-native'
import { font } from '@/lib/theme'

type TrafficCondition = 'light' | 'moderate' | 'heavy' | 'severe' | null

interface TrafficBadgeProps {
  condition: TrafficCondition
  delayMins?: number
  isDark: boolean
}

const CONFIG = {
  light: {
    label: 'Light traffic',
    color: '#059669',
    darkColor: '#34d399',
    bg: 'rgba(16, 185, 129, 0.1)',
    darkBg: 'rgba(16, 185, 129, 0.15)',
    Icon: Zap,
  },
  moderate: {
    label: 'Moderate traffic',
    color: '#d97706',
    darkColor: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.1)',
    darkBg: 'rgba(245, 158, 11, 0.15)',
    Icon: Clock,
  },
  heavy: {
    label: 'Heavy traffic',
    color: '#ea580c',
    darkColor: '#fb923c',
    bg: 'rgba(249, 115, 22, 0.1)',
    darkBg: 'rgba(249, 115, 22, 0.15)',
    Icon: AlertTriangle,
  },
  severe: {
    label: 'Severe traffic',
    color: '#dc2626',
    darkColor: '#f87171',
    bg: 'rgba(239, 68, 68, 0.1)',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    Icon: AlertTriangle,
  },
} as const

export function TrafficBadge({ condition, delayMins, isDark }: TrafficBadgeProps) {
  if (!condition) {
    return (
      <View style={[s.badge, { backgroundColor: isDark ? '#292524' : '#f5f5f4' }]}>
        <Minus size={14} color={isDark ? '#78716c' : '#a8a29e'} />
        <Text style={[s.label, { color: isDark ? '#78716c' : '#a8a29e' }]}>
          No traffic data
        </Text>
      </View>
    )
  }

  const config = CONFIG[condition]
  const textColor = isDark ? config.darkColor : config.color
  const bgColor = isDark ? config.darkBg : config.bg

  return (
    <View style={[s.badge, { backgroundColor: bgColor }]}>
      <config.Icon size={14} color={textColor} />
      <Text style={[s.label, { color: textColor }]}>{config.label}</Text>
      {delayMins != null && delayMins > 0 && (
        <Text style={[s.delay, { color: textColor }]}>+{delayMins}m</Text>
      )}
    </View>
  )
}

export function TrafficDot({ condition }: { condition: TrafficCondition }) {
  const colors: Record<string, string> = {
    light: '#10b981',
    moderate: '#f59e0b',
    heavy: '#f97316',
    severe: '#ef4444',
  }

  return (
    <View style={[s.dot, {
      backgroundColor: condition ? colors[condition] : '#d6d3d1',
    }]} />
  )
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontFamily: font.medium,
  },
  delay: {
    fontSize: 12,
    fontFamily: font.regular,
    opacity: 0.75,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
