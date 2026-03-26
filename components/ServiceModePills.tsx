import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet } from 'react-native'
import { c, themed, font } from '@/lib/theme'
import { TrotroIcon, TrainIcon, GoIcon, TalesIcon } from '@/components/ServiceIcons'

export type ServiceMode = 'trotro' | 'train' | 'go' | 'tales'

interface ServicePill {
  id: ServiceMode
  label: string
  color: string
}

const SERVICE_PILLS: ServicePill[] = [
  { id: 'trotro', label: 'Trotro', color: '#f59e0b' },
  { id: 'train', label: 'Train', color: '#0ea5e9' },
  { id: 'go', label: 'GO', color: '#22c55e' },
  { id: 'tales', label: 'Tales', color: '#a855f7' },
]

const ICON_MAP = {
  trotro: TrotroIcon,
  train: TrainIcon,
  go: GoIcon,
  tales: TalesIcon,
} as const

interface ServiceModePillsProps {
  activeMode: ServiceMode
  onModeChange: (mode: ServiceMode) => void
  hasActiveTrip?: boolean
}

export function ServiceModePills({ activeMode, onModeChange, hasActiveTrip }: ServiceModePillsProps) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.container}
    >
      {SERVICE_PILLS.map((pill) => {
        const isActive = activeMode === pill.id
        const IconComponent = ICON_MAP[pill.id]
        const isGoWithTrip = pill.id === 'go' && hasActiveTrip

        return (
          <TouchableOpacity
            key={pill.id}
            onPress={() => onModeChange(pill.id)}
            activeOpacity={0.7}
            style={[
              s.pill,
              isActive && { backgroundColor: pill.color },
              !isActive && s.pillInactive,
              isGoWithTrip && !isActive && [s.pillPulse, { borderColor: pill.color }],
            ]}
          >
            <IconComponent
              size={20}
              active={isActive}
            />
            <Text
              style={[
                s.pillText,
                isActive && s.pillTextActive,
                !isActive && { color: isGoWithTrip ? pill.color : t.textSecondary },
              ]}
            >
              {pill.label}
            </Text>
            {isGoWithTrip && !isActive && <View style={[s.liveDot, { backgroundColor: pill.color }]} />}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 4,
      gap: 8,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
    },
    pillInactive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    pillPulse: {
      borderWidth: 1.5,
      backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
    },
    pillText: {
      fontSize: 14,
      fontFamily: font.semibold,
    },
    pillTextActive: {
      color: '#fff',
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginLeft: 2,
    },
  })
}
