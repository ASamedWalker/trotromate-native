import { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import { c, font } from '@/lib/theme'
import type { RewardResult } from '@/lib/types'

const { width } = Dimensions.get('window')

interface ConfettiCelebrationProps {
  reward: RewardResult | null
  onDismiss: () => void
}

export default function ConfettiCelebration({ reward, onDismiss }: ConfettiCelebrationProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    if (!reward) return

    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start()

    // Auto dismiss
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss())
    }, reward.level_up ? 5000 : 3500)

    return () => clearTimeout(timeout)
  }, [reward, onDismiss])

  if (!reward) return null

  const isSpecial = reward.level_up || (reward.badges_earned?.length ?? 0) > 0

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ConfettiCannon
        count={isSpecial ? 120 : 60}
        origin={{ x: width / 2, y: -10 }}
        fadeOut
        autoStart
        colors={['#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7', '#8b5cf6']}
        explosionSpeed={400}
        fallSpeed={3000}
      />

      <Animated.View style={[styles.overlay, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.emoji}>{reward.level_up ? '🎉' : '⭐'}</Text>
          <Text style={styles.points}>+{reward.points_awarded}</Text>
          <Text style={styles.label}>points earned!</Text>

          {reward.streak_bonus ? (
            <Text style={styles.streak}>
              🔥 Streak bonus: +{reward.streak_bonus}
            </Text>
          ) : null}

          {reward.level_up && (
            <View style={styles.levelUpBox}>
              <Text style={styles.levelUpText}>Level Up!</Text>
              <Text style={styles.levelUpName}>{reward.new_level}</Text>
            </View>
          )}

          {reward.badges_earned?.map((badge) => (
            <View key={badge.id} style={styles.badgeRow}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <Text style={styles.badgeName}>{badge.name}</Text>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  emoji: { fontSize: 48, marginBottom: 8 },
  points: { fontSize: 40, fontFamily: font.bold, color: c.amber500 },
  label: { fontSize: 16, color: '#78716c', marginBottom: 8 },
  streak: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: '#ef4444',
    marginTop: 4,
  },
  levelUpBox: {
    marginTop: 12,
    backgroundColor: c.amber50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  levelUpText: { fontSize: 14, fontFamily: font.semibold, color: c.amber700 },
  levelUpName: { fontSize: 18, fontFamily: font.bold, color: c.amber500, marginTop: 2 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  badgeIcon: { fontSize: 20 },
  badgeName: { fontSize: 14, fontFamily: font.semibold, color: '#44403c' },
})
