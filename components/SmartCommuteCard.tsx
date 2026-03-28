import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Sunrise,
  Sunset,
  Coffee,
  Palmtree,
  Moon,
  Lightbulb,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { useApp } from '@/lib/contexts/AppContext'
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

const COMMUTER_TIPS = [
  { tip: 'The 5:30 AM Express from Madina usually has plenty of window seats. Perfect for a quiet morning.', author: 'Ama K.' },
  { tip: 'Avoid the Circle interchange between 5-6 PM. Take the Kaneshie route instead — faster by 20 mins.', author: 'Kojo B.' },
  { tip: 'Trotro fares from Tema go up by ₵2 during peak hours. Travel before 6 AM to save.', author: 'Esi M.' },
  { tip: 'The Kasoa-Kaneshie route has more vehicles on Mondays. Queue is usually shorter.', author: 'Kwaku D.' },
  { tip: 'Train from Tema departs sharp at 6 AM. Arrive 10 mins early — it doesn\'t wait.', author: 'Nana A.' },
]

function getTimeContext(): TimeContext {
  const { hours, day } = getGhanaTime()
  if (day === 0 || day === 6) return 'weekend'
  if (hours >= 5 && hours < 12) return 'morning'
  if (hours >= 12 && hours < 16) return 'midday'
  if (hours >= 16 && hours < 19) return 'evening'
  return 'night'
}

function getDailyTip(): typeof COMMUTER_TIPS[0] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return COMMUTER_TIPS[dayOfYear % COMMUTER_TIPS.length]
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
  const dailyTip = getDailyTip()

  const displayName = profile?.display_name?.split(' ')[0] ?? ''

  // Build personalized subtitle
  let personalMessage = info.subtitle
  if (topSuggestion && (context === 'morning' || context === 'evening')) {
    personalMessage = `Your regular Trotro to ${topSuggestion.to} is nearby.`
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
  }, [fadeAnim, slideAnim])

  return (
    <Animated.View style={[s.wrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Gradient hero card */}
      <View style={[s.card, { backgroundColor: info.gradient[0] }]}>
        {/* Decorative circle */}
        <View style={[s.decorCircle, { backgroundColor: info.gradient[1] }]} />

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

          {/* CTA button */}
          {topSuggestion && (context === 'morning' || context === 'evening') && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/routes/${topSuggestion.routeId}`)}
              style={s.ctaBtn}
            >
              <Text style={s.ctaBtnText}>Track Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Daily Commuter Tip — below gradient */}
      <View style={s.tipSection}>
        <View style={s.tipHeader}>
          <View style={s.tipIconWrap}>
            <Lightbulb size={16} color={isDark ? c.amber400 : '#815100'} />
          </View>
          <Text style={s.tipTitle}>Daily Commuter Tip</Text>
        </View>
        <Text style={s.tipText}>"{dailyTip.tip}"</Text>
        <Text style={s.tipAuthor}>Shared by {dailyTip.author}</Text>
      </View>
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
    decorCircle: {
      position: 'absolute',
      right: -30,
      bottom: -30,
      width: 140,
      height: 140,
      borderRadius: 70,
      opacity: 0.15,
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

    // Daily tip section
    tipSection: {
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    tipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    tipIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipTitle: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
    },
    tipText: {
      fontSize: 13,
      fontFamily: font.regular,
      fontStyle: 'italic',
      color: t.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    tipAuthor: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  })
}
