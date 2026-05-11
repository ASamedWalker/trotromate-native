import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native'
import { font } from '@/lib/theme'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

interface ServiceCardProps {
  title: string
  emoji: string
  bgColor: string
  onPress?: () => void
  disabled?: boolean
  comingSoon?: boolean
  index?: number
}

export default function ServiceCard({
  title,
  emoji,
  bgColor,
  onPress,
  disabled = false,
  comingSoon = false,
  index = 0,
}: ServiceCardProps) {
  const isDark = useColorScheme() === 'dark'

  const cardBg = disabled
    ? (isDark ? '#1C1917' : '#F5F5F4')
    : (isDark ? bgColor + '18' : bgColor + '10')

  const borderColor = disabled
    ? (isDark ? '#292524' : '#E7E5E4')
    : (isDark ? bgColor + '25' : bgColor + '20')

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        onPress={() => {
          if (disabled) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onPress?.()
        }}
        style={({ pressed }) => [
          pressed && !disabled && { transform: [{ scale: 0.93 }] },
          disabled && { opacity: 0.5 },
        ]}
      >
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[styles.title, { color: isDark ? '#FAFAF9' : '#1C1917' }, disabled && { color: isDark ? '#57534e' : '#A8A29E' }]}>
            {title}
          </Text>
          {comingSoon && (
            <View style={[styles.soonDot, { backgroundColor: isDark ? '#44403c' : '#D6D3D1' }]} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 18,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 13,
  },
  soonDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: -2,
  },
})
