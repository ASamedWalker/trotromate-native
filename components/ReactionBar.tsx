import { useCallback, useRef } from 'react'
import {
  Text,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { font } from '@/lib/theme'
import { REACTION_EMOJIS } from '@/lib/constants/tales'

interface ReactionBarProps {
  reactionSummary: Record<string, number>
  userReactions: string[]
  onReact: (emoji: string) => void
  compact?: boolean
}

export default function ReactionBar({
  reactionSummary,
  userReactions,
  onReact,
  compact,
}: ReactionBarProps) {
  const isDark = useColorScheme() === 'dark'

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        compact && styles.containerCompact,
      ]}
    >
      {REACTION_EMOJIS.map(({ emoji, label }) => {
        const count = reactionSummary[emoji] || 0
        const isActive = userReactions.includes(emoji)
        return (
          <ReactionPill
            key={emoji}
            emoji={emoji}
            label={label}
            count={count}
            isActive={isActive}
            compact={!!compact}
            isDark={isDark}
            onPress={() => onReact(emoji)}
          />
        )
      })}
    </ScrollView>
  )
}

function ReactionPill({
  emoji,
  count,
  isActive,
  compact,
  isDark,
  onPress,
}: {
  emoji: string
  label: string
  count: number
  isActive: boolean
  compact: boolean
  isDark: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }, [scale])

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start()
  }, [scale])

  const activeBg = isDark ? 'rgba(245,158,11,0.2)' : 'rgba(255,243,232,0.8)'
  const inactiveBg = isDark ? 'rgba(255,255,255,0.06)' : '#e8e1de'
  const activeText = isDark ? '#fbbf24' : '#92400e'
  const inactiveText = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={4}
    >
      <Animated.View
        style={[
          compact ? styles.pillCompact : styles.pill,
          {
            backgroundColor: isActive ? activeBg : inactiveBg,
            borderColor: isActive ? (isDark ? '#d97706' : 'transparent') : 'transparent',
          },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={compact ? styles.emojiCompact : styles.emoji}>{emoji}</Text>
        <Text
          style={[
            compact ? styles.countCompact : styles.count,
            { color: isActive ? activeText : inactiveText },
          ]}
        >
          {count}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  containerCompact: {
    gap: 4,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  pillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  emoji: { fontSize: 16 },
  emojiCompact: { fontSize: 14 },
  count: { fontSize: 13, fontFamily: font.semibold },
  countCompact: { fontSize: 11, fontFamily: font.medium },
})
