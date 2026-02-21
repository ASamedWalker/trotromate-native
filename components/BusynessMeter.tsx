import { View, Text, StyleSheet } from 'react-native'
import { Users } from 'lucide-react-native'
import { font } from '@/lib/theme'

type BusynessLevel = 'low' | 'moderate' | 'busy' | 'very_busy'

interface BusynessMeterProps {
  level: BusynessLevel
  isDark: boolean
}

const LEVELS: Record<BusynessLevel, {
  label: string
  color: string
  darkColor: string
  barColor: string
  bars: number
}> = {
  low: {
    label: 'Not busy',
    color: '#059669',
    darkColor: '#34d399',
    barColor: '#10b981',
    bars: 1,
  },
  moderate: {
    label: 'Somewhat busy',
    color: '#d97706',
    darkColor: '#fbbf24',
    barColor: '#f59e0b',
    bars: 2,
  },
  busy: {
    label: 'Busy',
    color: '#ea580c',
    darkColor: '#fb923c',
    barColor: '#f97316',
    bars: 3,
  },
  very_busy: {
    label: 'Very busy',
    color: '#dc2626',
    darkColor: '#f87171',
    barColor: '#ef4444',
    bars: 4,
  },
}

export function BusynessMeter({ level, isDark }: BusynessMeterProps) {
  const config = LEVELS[level]
  const textColor = isDark ? config.darkColor : config.color
  const inactiveBar = isDark ? '#44403c' : '#e7e5e3'

  return (
    <View style={s.container}>
      <Users size={16} color={textColor} />
      <Text style={[s.label, { color: textColor }]}>{config.label}</Text>
      <View style={s.bars}>
        {[1, 2, 3, 4].map((bar) => (
          <View
            key={bar}
            style={[
              s.bar,
              {
                height: 8 + bar * 3,
                backgroundColor: bar <= config.bars ? config.barColor : inactiveBar,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: font.medium,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
})
