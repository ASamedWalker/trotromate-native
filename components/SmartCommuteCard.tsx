import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path, Rect, Circle, G } from 'react-native-svg'
import {
  Sunrise,
  Sunset,
  Coffee,
  Palmtree,
  Moon,
  Flame,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { themed, font } from '@/lib/theme'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { useMyCommutes } from '@/lib/hooks/useMyCommutes'
import { useApp } from '@/lib/contexts/AppContext'
import { DailyTipCard } from '@/components/DailyTipCard'
import { getNextTrain, formatMinsLeft } from '@/lib/utils/train'
import { getGhanaTime } from '@/lib/utils/time'

/* ── Time context ─────────────────────────────────── */

type TimeContext = 'morning' | 'midday' | 'evening' | 'night' | 'weekend'

const CONTEXT_INFO: Record<TimeContext, {
  greeting: string
  subtitle: string
  icon: typeof Sunrise
  gradient: [string, string]
}> = {
  morning: {
    greeting: 'Good Morning',
    subtitle: 'Your morning commute at a glance',
    icon: Sunrise,
    gradient: ['#815100', '#f8a010'],
  },
  midday: {
    greeting: 'Good Afternoon',
    subtitle: 'Check routes trending now',
    icon: Coffee,
    gradient: ['#6d28d9', '#a78bfa'],
  },
  evening: {
    greeting: 'Good Evening',
    subtitle: 'Rush hour — time to head home',
    icon: Sunset,
    gradient: ['#c2410c', '#f97316'],
  },
  night: {
    greeting: 'Good Night',
    subtitle: 'Late links & tomorrow trains',
    icon: Moon,
    gradient: ['#4338ca', '#818cf8'],
  },
  weekend: {
    greeting: 'Happy Weekend',
    subtitle: 'No rush — explore routes',
    icon: Palmtree,
    gradient: ['#047857', '#34d399'],
  },
}


function getTimeContext(): TimeContext {
  const { hours, day } = getGhanaTime()
  if (day === 0 || day === 6) return 'weekend'
  if (hours >= 5 && hours < 12) return 'morning'
  if (hours >= 12 && hours < 16) return 'midday'
  if (hours >= 16 && hours < 19) return 'evening'
  return 'night'
}

/* ── Large background SVG icons (Stitch-inspired) ── */

function BigTrotroSvg() {
  return (
    <Svg width="160" height="120" viewBox="0 0 160 120" fill="none">
      <G opacity={0.1}>
        {/* Body */}
        <Rect x="10" y="20" width="130" height="65" rx="16" fill="#fff" />
        {/* Roof rack */}
        <Rect x="20" y="12" width="110" height="12" rx="6" fill="#fff" />
        {/* Windshield */}
        <Rect x="95" y="30" width="35" height="40" rx="8" fill="#fff" opacity={0.5} />
        {/* Side windows */}
        <Rect x="25" y="32" width="22" height="22" rx="5" fill="#fff" opacity={0.4} />
        <Rect x="52" y="32" width="22" height="22" rx="5" fill="#fff" opacity={0.4} />
        {/* Door */}
        <Rect x="78" y="30" width="14" height="40" rx="4" fill="#fff" opacity={0.3} />
        {/* Wheels */}
        <Circle cx="40" cy="92" r="12" fill="#fff" />
        <Circle cx="40" cy="92" r="6" fill="#fff" opacity={0.3} />
        <Circle cx="115" cy="92" r="12" fill="#fff" />
        <Circle cx="115" cy="92" r="6" fill="#fff" opacity={0.3} />
        {/* Bumper */}
        <Rect x="130" y="45" width="8" height="20" rx="4" fill="#fff" opacity={0.5} />
        {/* Headlight */}
        <Circle cx="140" cy="40" r="5" fill="#fff" opacity={0.6} />
      </G>
    </Svg>
  )
}

function BigTrainSvg() {
  return (
    <Svg width="160" height="120" viewBox="0 0 160 120" fill="none">
      <G opacity={0.1}>
        {/* Body */}
        <Rect x="15" y="15" width="120" height="70" rx="20" fill="#fff" />
        {/* Roof */}
        <Path d="M55 15 Q75 0 95 15" fill="#fff" opacity={0.6} />
        {/* Headlight */}
        <Circle cx="75" cy="8" r="6" fill="#fff" opacity={0.7} />
        {/* Windows */}
        <Rect x="30" y="28" width="40" height="24" rx="6" fill="#fff" opacity={0.4} />
        <Rect x="80" y="28" width="40" height="24" rx="6" fill="#fff" opacity={0.4} />
        {/* Door */}
        <Rect x="65" y="35" width="14" height="35" rx="4" fill="#fff" opacity={0.3} />
        {/* Undercarriage */}
        <Rect x="10" y="88" width="130" height="8" rx="4" fill="#fff" />
        {/* Wheels */}
        <Circle cx="40" cy="100" r="10" fill="#fff" />
        <Circle cx="40" cy="100" r="5" fill="#fff" opacity={0.3} />
        <Circle cx="75" cy="100" r="10" fill="#fff" />
        <Circle cx="75" cy="100" r="5" fill="#fff" opacity={0.3} />
        <Circle cx="110" cy="100" r="10" fill="#fff" />
        <Circle cx="110" cy="100" r="5" fill="#fff" opacity={0.3} />
      </G>
    </Svg>
  )
}

/* ── Component ────────────────────────────────────── */

export function SmartCommuteCard() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const { profile } = useApp()

  const context = getTimeContext()
  const info = CONTEXT_INFO[context]
  const ContextIcon = info.icon
  const { suggestions } = useSmartSuggestions()
  const topSuggestion = suggestions[0]
  const nextTrain = getNextTrain()
  const { commutes } = useMyCommutes()
  const primaryCommute = commutes[0]

  const displayName = profile?.display_name?.split(' ')[0] ?? ''
  const viewStreak = profile?.view_streak ?? 0

  // Build personalized subtitle — commute always wins if set, then suggestions, then train
  let personalMessage = info.subtitle
  let commuteRouteId: string | undefined
  if (primaryCommute) {
    commuteRouteId = primaryCommute.routeId || undefined
    personalMessage = commuteRouteId
      ? `${primaryCommute.from} → ${primaryCommute.to} — tap to check today's fare.`
      : `${primaryCommute.from} → ${primaryCommute.to} — be the first to report this fare!`
  } else if (topSuggestion && (context === 'morning' || context === 'evening')) {
    personalMessage = `Your regular Trotro to ${topSuggestion.to} is nearby.`
    commuteRouteId = topSuggestion.routeId
  } else if (nextTrain.status === 'upcoming') {
    personalMessage = `Train departs in ${formatMinsLeft(nextTrain.minsLeft)} from ${nextTrain.from}.`
  }

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[s.wrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Gradient hero card */}
      <LinearGradient
        colors={info.gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        {/* Large ghosted transport icon — Stitch-inspired */}
        <View style={s.bgIcon}>
          {nextTrain.status === 'upcoming' ? <BigTrainSvg /> : <BigTrotroSvg />}
        </View>

        <View style={s.cardContent}>
          {/* Context icon + label */}
          <View style={s.contextRow}>
            <ContextIcon size={18} color="rgba(255,255,255,0.7)" />
            <Text style={s.contextLabel}>
              {context === 'morning' ? 'Morning Commute' :
               context === 'evening' ? 'Evening Commute' :
               context === 'midday' ? 'Afternoon' :
               context === 'night' ? 'Night Mode' : 'Weekend Flex'}
            </Text>
          </View>

          {/* Greeting */}
          <Text style={s.greeting}>
            {info.greeting}{displayName ? `, ${displayName}` : ''}
          </Text>

          {/* Personal message */}
          <Text style={s.message}>{personalMessage}</Text>

          {/* Streak badge */}
          {viewStreak >= 2 && (
            <View style={s.streakRow}>
              <Flame size={14} color="#fbbf24" />
              <Text style={s.streakText}>
                {viewStreak}-day streak{viewStreak >= 7 ? ' — on fire!' : ''}
              </Text>
            </View>
          )}

          {/* CTA button */}
          {commuteRouteId ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/routes/${commuteRouteId}`)}
              style={s.ctaBtn}
            >
              <Text style={s.ctaBtnText}>Check Fare</Text>
            </TouchableOpacity>
          ) : primaryCommute ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/report/fare?from=${encodeURIComponent(primaryCommute.from)}&to=${encodeURIComponent(primaryCommute.to)}` as any)}
              style={s.ctaBtn}
            >
              <Text style={s.ctaBtnText}>Report This Fare</Text>
            </TouchableOpacity>
          ) : topSuggestion && (context === 'morning' || context === 'evening') ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/routes/${topSuggestion.routeId}`)}
              style={s.ctaBtn}
            >
              <Text style={s.ctaBtnText}>Track Ride</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Daily Commuter Tip — dynamic from Supabase */}
      <DailyTipCard category="trotro" />
    </Animated.View>
  )
}

/* ── Styles ────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    wrapper: {
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderColor: t.border,
    },

    // Gradient card
    card: {
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 24,
      overflow: 'hidden',
    },
    bgIcon: {
      position: 'absolute',
      right: -10,
      bottom: -10,
    },
    cardContent: {
      zIndex: 1,
    },
    contextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    contextLabel: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.7)',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    greeting: {
      fontSize: 24,
      fontFamily: font.extrabold,
      color: '#fff',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 20,
      maxWidth: 240,
    },
    ctaBtn: {
      marginTop: 18,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
    },
    ctaBtnText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 14,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    streakText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.85)',
    },

  })
}
