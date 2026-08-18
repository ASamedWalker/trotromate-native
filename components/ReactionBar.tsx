import { useCallback, useRef, useState } from 'react'
import {
  Text,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { SmilePlus } from 'lucide-react-native'
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
  const [expanded, setExpanded] = useState(false)

  // Only reactions that actually happened. A row of six zeros advertises that
  // nobody is here — the opposite of what a feed should project — so the full
  // set stays behind a deliberate tap.
  const used = REACTION_EMOJIS.filter(
    ({ emoji }) => (reactionSummary[emoji] || 0) > 0 || userReactions.includes(emoji)
  )
  const visible = expanded ? REACTION_EMOJIS : used

  const inactiveBg = isDark ? 'rgba(255,255,255,0.06)' : '#e8e1de'
  const inactiveText = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        compact && styles.containerCompact,
      ]}
    >
      {visible.map(({ emoji, label }) => {
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

      {/* The way in: labelled when the post has no reactions yet, a quiet
          icon-only affordance once there are some to sit beside. */}
      {!expanded && (
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
        >
          <Animated.View
            style={[
              compact ? styles.pillCompact : styles.pill,
              { backgroundColor: inactiveBg, borderColor: 'transparent' },
            ]}
          >
            <SmilePlus size={compact ? 14 : 16} color={inactiveText} strokeWidth={2} />
            {used.length === 0 && (
              <Text
                style={[
                  compact ? styles.countCompact : styles.count,
                  { color: inactiveText },
                ]}
              >
                React
              </Text>
            )}
          </Animated.View>
        </Pressable>
      )}
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
    // Match the card's content inset (captionWrap / commentLink use 14) so the
    // first pill isn't sliced against the screen edge.
    paddingHorizontal: 14,
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
  // Emoji glyphs are taller than their nominal font size, and with no explicit
  // lineHeight the line box is too short so iOS clips the top and bottom —
  // 🚨 💯 👀 lost their crowns and bases. Same 1.3x floor the theme documents
  // for Baloo. includeFontPadding is an Android no-op elsewhere but keeps the
  // glyph from being re-padded there.
  emoji: { fontSize: 16, lineHeight: 22, includeFontPadding: false },
  emojiCompact: { fontSize: 14, lineHeight: 19, includeFontPadding: false },
  count: { fontSize: 13, lineHeight: 18, fontFamily: font.semibold },
  countCompact: { fontSize: 11, lineHeight: 16, fontFamily: font.medium },
})
