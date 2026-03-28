import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font } from '@/lib/theme'
import { TrotroIcon, TrainIcon, GoIcon, TalesIcon } from '@/components/ServiceIcons'

export type ServiceMode = 'trotro' | 'train' | 'go' | 'tales'

interface ServicePill {
  id: ServiceMode
  label: string
  gradient: [string, string]
}

const SERVICE_PILLS: ServicePill[] = [
  { id: 'trotro', label: 'Trotro', gradient: ['#815100', '#f8a010'] },
  { id: 'train', label: 'Train', gradient: ['#075985', '#0ea5e9'] },
  { id: 'go', label: 'GO', gradient: ['#166534', '#22c55e'] },
  { id: 'tales', label: 'Tales', gradient: ['#6b21a8', '#a855f7'] },
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

  return (
    <View style={s.container}>
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
              isActive && s.pillActiveWrap,
              !isActive && s.pillInactive,
              isGoWithTrip && !isActive && [s.pillPulse, { borderColor: pill.gradient[1] }],
            ]}
          >
            {isActive ? (
              <LinearGradient
                colors={pill.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.pillGradient}
              >
                <IconComponent size={18} active />
                <Text style={s.pillTextActive}>{pill.label}</Text>
              </LinearGradient>
            ) : (
              <>
                <IconComponent size={18} active={false} />
                <Text style={[s.pillText, { color: isDark ? '#e5e5e5' : '#44403c' }]}>
                  {pill.label}
                </Text>
                {isGoWithTrip && <View style={[s.liveDot, { backgroundColor: pill.gradient[1] }]} />}
              </>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      gap: 6,
    },
    pill: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    pillActiveWrap: {
      backgroundColor: 'transparent',
    },
    pillGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
    },
    pillInactive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      backgroundColor: isDark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.92)',
    },
    pillPulse: {
      borderWidth: 1.5,
      backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)',
    },
    pillText: {
      fontSize: 13,
      fontFamily: font.semibold,
    },
    pillTextActive: {
      fontSize: 13,
      fontFamily: font.semibold,
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
