import { useCallback, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { c, themed, font } from '@/lib/theme'
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
  const s = getStyles(isDark, !!compact)

  return (
    <View style={s.container}>
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
    </View>
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

  const t = themed(isDark)

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
          isActive && {
            backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : c.amber50,
            borderColor: c.amber400,
          },
          !isActive && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.stone100,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : c.stone200,
          },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={compact ? styles.emojiCompact : styles.emoji}>{emoji}</Text>
        {count > 0 && (
          <Text
            style={[
              compact ? styles.countCompact : styles.count,
              { color: isActive ? c.amber600 : t.textSecondary },
            ]}
          >
            {count}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
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
  emoji: { fontSize: 18 },
  emojiCompact: { fontSize: 14 },
  count: { fontSize: 13, fontFamily: font.medium },
  countCompact: { fontSize: 11, fontFamily: font.medium },
})

const getStyles = (isDark: boolean, compact: boolean) => {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 4 : 6,
      paddingHorizontal: compact ? 0 : 14,
      paddingVertical: compact ? 4 : 6,
    },
  })
}
