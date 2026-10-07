import { Fragment, useCallback, useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  StyleSheet,
  Alert,
  Share,
  Dimensions,
  Animated as RNAnimated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Line } from 'react-native-svg'
import ConfettiCannon from 'react-native-confetti-cannon'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Trophy,
  Coins,
  Flame,
  Bus,
  Clock,
  AlertTriangle,
  TrainFront,
  Camera,
  Gift,
  Users,
  Check,
  Copy,
  Share2,
  Banknote,
  Star,
  Map,
  Sunrise,
  Moon,
  Shield,
  CalendarDays,
  Lock,
} from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { useRouter, type Href } from 'expo-router'
import { font, brand, ui, space, radius, cardShadow } from '@/lib/theme'
import { Chip, SectionHeader, Button } from '@/components/ui'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useApp } from '@/lib/contexts/AppContext'
import TroskiCoin from '@/components/TroskiCoin'
import { BackButton } from '@/components/BackButton'
import { useProfile, usePointsHistory, useAllBadges } from '@/lib/hooks/useRewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { SkeletonRewards } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase'
import {
  REPORT_POINTS,
  STREAK_CONFIG,
  REFERRAL_POINTS,
  LEVELS,
  LEVEL_ORDER,
  calculateLevel,
  getNextLevel,
} from '@/lib/constants/rewards'
import type { PointsHistoryEntry, LevelSlug } from '@/lib/types'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'

/* ── Constants ──────────────────────────────────────── */

const TABS = ['Coins', 'Earn', 'History', 'Referrals'] as const
type Tab = (typeof TABS)[number]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SCREEN_W = Dimensions.get('window').width
const CELEBRATED_KEY = '@troski_rewards_celebrated_v1'

// Same maps as app/profile/[deviceId].tsx Trophy Case — badge.icon/color are
// lucide-name + palette-name strings from the `badges` table
const BADGE_ICONS: Record<string, typeof Star> = {
  star: Star, flame: Flame, map: Map, sunrise: Sunrise, moon: Moon,
  shield: Shield, coins: Coins, users: Users, trophy: Trophy, calendar: CalendarDays,
}
const BADGE_COLORS: Record<string, string> = {
  amber: ui.warning, orange: '#F97316', emerald: '#10B981', violet: '#8B5CF6',
}

/* ── Game-feel animation primitives ──────────────────── */
/* Core RN Animated (NOT reanimated) — transform-only with the
   native driver, so they're safe inside ScrollView on Android. */

function Bob({
  children,
  delay = 0,
  dy = 8,
  rotate = false,
  style,
}: {
  children: ReactNode
  delay?: number
  dy?: number
  rotate?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const v = useRef(new RNAnimated.Value(0)).current
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(v, { toValue: 1, duration: 1700, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        RNAnimated.timing(v, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [v, delay])
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -dy] })
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] })
  return (
    <RNAnimated.View style={[style, { transform: rotate ? [{ translateY }, { rotate: rot }] : [{ translateY }] }]}>
      {children}
    </RNAnimated.View>
  )
}

function Spin({
  children,
  duration = 26000,
  reverse = false,
  style,
}: {
  children: ReactNode
  duration?: number
  reverse?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const v = useRef(new RNAnimated.Value(0)).current
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    )
    loop.start()
    return () => loop.stop()
  }, [v, duration])
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] })
  return <RNAnimated.View style={[style, { transform: [{ rotate }] }]}>{children}</RNAnimated.View>
}

/* ── Semicircular tier-progress gauge ────────────────── */
/* Counts the balance up and sweeps the arc in one rAF-driven
   animation. The arc measures REAL progress: coins inside the
   current tier → next tier threshold (full when top tier).   */

function CoinGauge({
  value,
  levelMin,
  levelMax,
  isDark,
}: {
  value: number
  levelMin: number
  levelMax: number | null // null = top tier (gauge full)
  isDark: boolean
}) {
  const W = 240
  const R = 96
  const SW = 18
  const PAD = 20 // headroom for the speedometer ticks outside the arc
  const cx = W / 2
  const cy = R + SW / 2 + PAD
  const H = cy + SW / 2 + 2
  const len = Math.PI * R
  const TICKS = 11

  const [prog, setProg] = useState(0)
  useEffect(() => {
    let raf: number
    let start: number | null = null
    const DUR = 1300
    const tick = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / DUR)
      setProg(1 - Math.pow(1 - p, 3)) // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, levelMin, levelMax])

  const target =
    levelMax === null
      ? 1
      : Math.max(0, Math.min(1, (value - levelMin) / Math.max(1, levelMax - levelMin)))
  const f = target * prog
  const shown = Math.round(value * prog)

  // Coin marker riding the tip of the arc as the balance climbs the scale
  const phi = Math.PI * (1 - f)
  const markerX = cx + R * Math.cos(phi)
  const markerY = cy - R * Math.sin(phi)

  const d = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const track = isDark ? 'rgba(255,255,255,0.10)' : ui.hairline

  return (
    <View style={{ width: W, height: H + 36, alignItems: 'center' }}>
      <Svg width={W} height={H}>
        {/* Speedometer ticks — light up as the balance climbs */}
        {Array.from({ length: TICKS }, (_, i) => {
          const tf = i / (TICKS - 1)
          const th = Math.PI * (1 - tf)
          const r1 = R + 11
          const r2 = R + 17
          const lit = tf <= f + 0.001
          return (
            <Line
              key={i}
              x1={cx + r1 * Math.cos(th)}
              y1={cy - r1 * Math.sin(th)}
              x2={cx + r2 * Math.cos(th)}
              y2={cy - r2 * Math.sin(th)}
              stroke={lit ? '#F0A500' : track}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )
        })}
        <Path d={d} stroke={track} strokeWidth={SW} fill="none" strokeLinecap="round" />
        {f > 0.004 && (
          <Path
            d={d}
            stroke={brand.orange}
            strokeWidth={SW}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len * f} ${len}`}
          />
        )}
      </Svg>
      {/* The coin rides the scale as it counts up */}
      <View
        style={{
          position: 'absolute',
          left: markerX - 14,
          top: markerY - 14,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: isDark ? '#1c1c1e' : ui.card,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: ui.warning,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 5,
          elevation: 4,
        }}
      >
        <TroskiCoin size={23} />
      </View>
      {/* Center value */}
      <View style={{ position: 'absolute', top: cy - 58, width: W, alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: -17, left: W / 2 - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFC93C', opacity: 0.16 }} />
        <View style={{ position: 'absolute', top: -7, left: W / 2 - 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFC93C', opacity: 0.2 }} />
        <TroskiCoin size={26} />
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 40, color: isDark ? ui.onBrand : ui.text, letterSpacing: 0, marginTop: 4 }}>
          {shown.toLocaleString()}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary, marginTop: 4 }}>
          Troski Coin
        </Text>
      </View>
      {/* Scale labels: real tier boundaries, anchored under the arc ends */}
      <Text style={[gaugeScaleStyle(isDark), { position: 'absolute', left: cx - R - 26, top: cy + 14, width: 52, textAlign: 'center' }]}>
        {levelMin}
      </Text>
      <Text style={[gaugeScaleStyle(isDark), { position: 'absolute', left: cx + R - 26, top: cy + 14, width: 52, textAlign: 'center' }]}>
        {levelMax === null ? 'Max' : levelMax}
      </Text>
    </View>
  )
}

function gaugeScaleStyle(isDark: boolean) {
  return { fontFamily: font.extrabold, fontSize: 17, letterSpacing: -0.3, color: isDark ? 'rgba(255,255,255,0.7)' : ui.textSecondary } as const
}

/* ── Tier journey strip ──────────────────────────────── */

function TierJourney({ levelSlug, isDark, s }: { levelSlug: LevelSlug; isDark: boolean; s: ReturnType<typeof getStyles> }) {
  const curIdx = LEVEL_ORDER.indexOf(levelSlug)
  return (
    <View style={s.tierCard}>
      <Text style={s.tierTitle}>Tier journey</Text>
      <View style={s.tierRow}>
        {LEVEL_ORDER.map((slug, i) => {
          const lvl = LEVELS[slug]
          const reached = i <= curIdx
          const current = i === curIdx
          return (
            <Fragment key={slug}>
              {i > 0 && <View style={[s.tierLine, reached && { backgroundColor: brand.orange }]} />}
              <View style={{ alignItems: 'center', width: 64 }}>
                {current ? (
                  <Bob dy={4}>
                    <View style={[s.tierDot, s.tierDotReached, s.tierDotCurrent]}>
                      <Text style={{ fontSize: 16 }}>{lvl.emoji}</Text>
                    </View>
                  </Bob>
                ) : (
                  <View style={[s.tierDot, reached && s.tierDotReached]}>
                    <Text style={{ fontSize: 16 }}>{lvl.emoji}</Text>
                  </View>
                )}
                <Text style={[s.tierName, reached && s.tierNameReached]} numberOfLines={2}>
                  {lvl.name}
                </Text>
                <Text style={s.tierPts}>{lvl.min_points === 0 ? '0' : `${lvl.min_points}+`}</Text>
              </View>
            </Fragment>
          )
        })}
      </View>
    </View>
  )
}

/* ── History row meta ────────────────────────────────── */

function historyMeta(entry: PointsHistoryEntry): { label: string; Icon: typeof Bus } {
  if (entry.points < 0) return { label: entry.reason || 'Coin Redeemed', Icon: Banknote }
  switch (entry.report_type) {
    case 'fare': return { label: 'Fare Payment Reward', Icon: Bus }
    case 'queue': return { label: 'Queue Status Report', Icon: Clock }
    case 'incident': return { label: 'Incident Report', Icon: AlertTriangle }
    case 'train': return { label: 'Train Report', Icon: TrainFront }
    case 'tale': return { label: 'Pulse Post Shared', Icon: Camera }
    case 'referral': return { label: 'Referral Bonus', Icon: Gift }
    case 'streak': return { label: 'Streak Bonus', Icon: Flame }
    default: return { label: entry.reason || 'Coins Earned', Icon: Coins }
  }
}

/* ── Main Screen ─────────────────────────────────────── */

export default function RewardsScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const insets = useSafeAreaInsets()
  const { deviceId, refreshProfile } = useApp()

  const { profile, badges: earnedBadges, rank, isLoading, refetch: refetchProfile } = useProfile(deviceId)
  const { badges: allBadges } = useAllBadges()
  const { entries: history, refetch: refetchHistory } = usePointsHistory(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['history', deviceId]])

  const [tab, setTab] = useState<Tab>('Coins')
  const [refreshing, setRefreshing] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Referral state
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!deviceId) return
    ;(async () => {
      try {
        const { data: p } = await supabase
          .from('contributor_profiles')
          .select('id, referral_code, referral_count')
          .eq('device_id', deviceId)
          .single()
        if (!p) return
        let code = p.referral_code
        if (!code) {
          code = `TROSKI-${deviceId.substring(0, 4).toUpperCase()}`
          await supabase.from('contributor_profiles').update({ referral_code: code }).eq('id', p.id)
        }
        setReferralCode(code)
        const { count } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_device_id', deviceId)
        setReferralCount(count || 0)
      } catch {
        // non-critical
      }
    })()
  }, [deviceId])

  /* Celebrate tier-ups and 7-day streak milestones (once each) */
  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(CELEBRATED_KEY)
        const seen: { level?: LevelSlug; streak?: number } = raw ? JSON.parse(raw) : {}
        const lvlIdx = LEVEL_ORDER.indexOf(profile.current_level)
        const seenIdx = LEVEL_ORDER.indexOf(seen.level ?? 'passenger')
        const streakMilestone =
          profile.current_streak > 0 && profile.current_streak % STREAK_CONFIG.THRESHOLD_DAYS === 0
            ? profile.current_streak
            : 0
        const levelUp = lvlIdx > seenIdx
        const streakUp = streakMilestone > 0 && seen.streak !== streakMilestone
        if (levelUp || streakUp) {
          setCelebrating(true)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
        await AsyncStorage.setItem(
          CELEBRATED_KEY,
          JSON.stringify({ level: profile.current_level, streak: streakMilestone || seen.streak || 0 })
        )
      } catch {
        // non-critical
      }
    })()
  }, [profile?.current_level, profile?.current_streak]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchProfile(), refetchHistory()])
    setRefreshing(false)
  }, [refreshProfile, refetchProfile, refetchHistory])

  /* ── Derived data ── */
  const coins = profile?.total_points ?? 0
  const streak = profile?.current_streak ?? 0
  const longestStreak = profile?.longest_streak ?? 0

  // Tier maths — the gauge measures real progress to the next tier
  const levelSlug: LevelSlug = profile?.current_level ?? calculateLevel(coins)
  const level = LEVELS[levelSlug]
  const nextLevel = getNextLevel(levelSlug)
  const coinsToNext = nextLevel ? Math.max(0, nextLevel.min_points - coins) : 0

  // Streak week, anchored to the actual current weekday (Mon-start)
  const now = new Date()
  const todayIdx = (now.getDay() + 6) % 7
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const reportedToday = (profile?.last_report_date ?? '').slice(0, 10) === todayKey
  const doneEnd = reportedToday ? todayIdx : todayIdx - 1
  const isDayDone = (i: number) => i <= doneEnd && doneEnd - i < streak
  const hoursLeft = Math.max(
    1,
    Math.ceil((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()) / 3_600_000)
  )
  const streakAtRisk = streak > 0 && !reportedToday
  const daysToBonus = STREAK_CONFIG.THRESHOLD_DAYS - (streak % STREAK_CONFIG.THRESHOLD_DAYS)
  const bonusJustDone = streak > 0 && streak % STREAK_CONFIG.THRESHOLD_DAYS === 0

  const derived = useMemo(() => {
    const nowMs = Date.now()
    const dayMs = 86_400_000
    const todayStr = new Date(nowMs).toDateString()
    const yestStr = new Date(nowMs - dayMs).toDateString()
    const monthStart = new Date(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth(), 1).getTime()

    let todayPoints = 0
    let monthEarned = 0
    let redeemed = 0
    let weekReports = 0
    let weekCoins = 0
    const groups: { title: string; items: PointsHistoryEntry[] }[] = [
      { title: 'Today', items: [] },
      { title: 'Yesterday', items: [] },
      { title: 'Earlier', items: [] },
    ]

    for (const h of history) {
      const t = new Date(h.created_at).getTime()
      const ds = new Date(h.created_at).toDateString()
      if (ds === todayStr) { todayPoints += h.points; groups[0].items.push(h) }
      else if (ds === yestStr) groups[1].items.push(h)
      else groups[2].items.push(h)
      if (t >= monthStart && h.points > 0) monthEarned += h.points
      if (h.points < 0) redeemed += Math.abs(h.points)
      if (nowMs - t < 7 * dayMs && h.points > 0) {
        weekCoins += h.points
        if (h.report_type) weekReports += 1
      }
    }
    return {
      todayPoints,
      monthEarned,
      redeemed,
      weekReports,
      weekCoins,
      groups: groups.filter((g) => g.items.length > 0),
    }
  }, [history])

  /* ── Earn missions (real point values) ── */
  const earnActions = useMemo(() => [
    { label: 'Report a fare', emoji: '🚌', pts: REPORT_POINTS.fare, route: '/report/fare' },
    { label: 'Queue status', emoji: '🚏', pts: REPORT_POINTS.queue, route: '/report/queue' },
    { label: 'Report incidents', emoji: '🚨', pts: REPORT_POINTS.incident, route: '/report/incident' },
    { label: 'Share to Pulse', emoji: '📸', pts: REPORT_POINTS.tale, route: '/report/photo' },
    { label: '7-day streak', emoji: '🔥', pts: STREAK_CONFIG.BONUS_POINTS, route: null },
    { label: 'Refer a friend', emoji: '🎁', pts: REFERRAL_POINTS, route: 'tab:Referrals' },
  ], [])

  const handleCopy = async () => {
    if (!referralCode) return
    try {
      await Clipboard.setStringAsync(referralCode)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      handleShare()
    }
  }

  const handleShare = async () => {
    if (!referralCode) return
    try {
      await Share.share({
        message: `Use my referral code ${referralCode} on Troski and we both earn coins! Check trotro fares, okada prices & more. https://www.troski.me`,
      })
    } catch {
      // cancelled
    }
  }

  const goEarn = (route: string | null) => {
    if (!route) { setTab('Earn'); return }
    if (route === 'tab:Referrals') { Haptics.selectionAsync(); setTab('Referrals'); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(route as Href)
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Rewards</Text>
      </View>

      {/* Sub-tabs */}
      <View style={s.tabRow}>
        {TABS.map((tb) => {
          const active = tab === tb
          return (
            <Chip key={tb} label={tb} selected={active} onPress={() => setTab(tb)} />
          )
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} />}
      >
        {isLoading ? (
          <SkeletonRewards isDark={isDark} />
        ) : (
          <Animated.View entering={FadeInDown.duration(350)}>
            {/* ═══════════ COINS ═══════════ */}
            {tab === 'Coins' && (
              <>
                <View style={s.card}>
                  {/* Current tier */}
                  <View style={[s.tierPill, { backgroundColor: `${level.color}1A` }]}>
                    <Text style={{ fontSize: 13 }}>{level.emoji}</Text>
                    <Text style={[s.tierPillText, { color: level.color }]}>{level.name}</Text>
                  </View>

                  <View style={{ alignItems: 'center', marginTop: 14 }}>
                    {/* Floating coins — Sonic-ring energy */}
                    <Bob delay={0} dy={7} rotate style={{ position: 'absolute', left: 6, top: 18 }}>
                      <TroskiCoin size={26} />
                    </Bob>
                    <Bob delay={650} dy={9} rotate style={{ position: 'absolute', right: 4, top: 54 }}>
                      <TroskiCoin size={20} />
                    </Bob>
                    <Bob delay={1150} dy={6} rotate style={{ position: 'absolute', left: 16, top: 108, opacity: 0.9 }}>
                      <TroskiCoin size={15} />
                    </Bob>
                    <Bob delay={400} dy={8} rotate style={{ position: 'absolute', right: 22, top: 4, opacity: 0.9 }}>
                      <TroskiCoin size={14} />
                    </Bob>
                    <CoinGauge
                      value={coins}
                      levelMin={level.min_points}
                      levelMax={nextLevel ? nextLevel.min_points : null}
                      isDark={isDark}
                    />
                  </View>

                  <Text style={s.nextTierText}>
                    {nextLevel
                      ? `${coinsToNext.toLocaleString()} coins to ${nextLevel.name} ${nextLevel.emoji}`
                      : 'Top tier reached — Troski Legend 🏆'}
                  </Text>

                  <View style={s.statRow}>
                    <Stat label="Today" value={derived.todayPoints > 0 ? `+${derived.todayPoints}` : `${derived.todayPoints}`} isDark={isDark} />
                    <View style={s.statDivider} />
                    <Stat label="Streak" value={`${streak}`} isDark={isDark} />
                    <View style={s.statDivider} />
                    <Stat label="Rank" value={rank ? `#${rank}` : '--'} isDark={isDark} onPress={() => router.push('/leaderboard' as Href)} />
                  </View>
                </View>

                {/* Tier journey */}
                <TierJourney levelSlug={levelSlug} isDark={isDark} s={s} />

                {/* Weekly recap — Waze-style impact rhythm, computed from real history */}
                {derived.weekCoins > 0 && (
                  <View style={s.weekCard}>
                    <Text style={s.weekTitle}>This week</Text>
                    <View style={s.weekRow}>
                      <View style={s.weekStat}>
                        <Text style={s.weekValue}>{derived.weekReports}</Text>
                        <Text style={s.weekLabel}>Report{derived.weekReports === 1 ? '' : 's'}</Text>
                      </View>
                      <View style={s.statDivider} />
                      <View style={s.weekStat}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <TroskiCoin size={15} />
                          <Text style={s.weekValue}>+{derived.weekCoins}</Text>
                        </View>
                        <Text style={s.weekLabel}>Coins</Text>
                      </View>
                      <View style={s.statDivider} />
                      <View style={s.weekStat}>
                        <Text style={s.weekValue}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
                        <Text style={s.weekLabel}>Streak</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Community impact — Transit-style civic framing, real data */}
                {(profile?.total_reports ?? 0) > 0 && (
                  <View style={s.impactCard}>
                    <View style={s.impactIconWrap}>
                      <Users size={20} color={brand.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.impactValue}>{(profile?.total_reports ?? 0).toLocaleString()} reports shared</Text>
                      <Text style={s.impactSub}>Your fare, queue & incident reports help fellow riders plan smarter trips</Text>
                    </View>
                  </View>
                )}

                {/* Badge case — Local Guides-style typed achievements (real backend badges) */}
                {allBadges.length > 0 && (
                  <>
                    <SectionHeader title="Badges" style={s.sectionHead} />
                    <Text style={s.sectionSub}>{earnedBadges.length} of {allBadges.length} earned</Text>
                    <View style={s.badgeGrid}>
                      {allBadges.map((b) => {
                        const earned = earnedBadges.some((e) => e.id === b.id)
                        const IconComponent = BADGE_ICONS[b.icon] || Star
                        const color = BADGE_COLORS[b.color] || ui.warning
                        return (
                          <View key={b.id} style={s.badgeCard} accessible accessibilityLabel={`${b.name}, ${earned ? 'earned' : 'locked'}. ${b.description}`}>
                            <View style={[s.badgeIconCircle, { backgroundColor: earned ? `${color}1F` : (isDark ? 'rgba(255,255,255,0.06)' : ui.surface) }]}>
                              <IconComponent size={22} color={earned ? color : (isDark ? 'rgba(255,255,255,0.4)' : ui.textTertiary)} />
                              {!earned && (
                                <View style={s.badgeLock}>
                                  <Lock size={10} color="#FFFFFF" strokeWidth={2.5} />
                                </View>
                              )}
                            </View>
                            <Text style={s.badgeName} numberOfLines={1}>{b.name}</Text>
                            <Text style={s.badgeDesc} numberOfLines={2}>{b.description}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </>
                )}

                <Button label="View leaderboard" icon={Trophy} style={{ marginTop: 12 }} onPress={() => router.push('/leaderboard' as Href)} />
              </>
            )}

            {/* ═══════════ EARN ═══════════ */}
            {tab === 'Earn' && (
              <>
                {/* Daily streak */}
                <LinearGradient colors={[brand.orange, brand.orangePressed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.streakCard}>
                  <View style={s.streakTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Flame size={19} color={ui.onBrand} fill="#FFD166" />
                      <Text style={s.streakTitle}>Daily streak</Text>
                    </View>
                    <Text style={s.streakBadge}>
                      {streak} day streak{longestStreak > streak ? ` · Best ${longestStreak}` : ''}
                    </Text>
                  </View>
                  <View style={s.streakDays}>
                    {DAYS.map((d, i) => {
                      const done = isDayDone(i)
                      const isToday = i === todayIdx
                      const dot = (
                        <View style={[s.dayDot, done && s.dayDotDone, isToday && !done && s.dayDotToday]}>
                          {done ? <TroskiCoin size={24} /> : <Text style={s.dayNum}>{i + 1}</Text>}
                        </View>
                      )
                      return (
                        <View key={d} style={{ alignItems: 'center', gap: 6 }}>
                          {isToday ? <Bob dy={3}>{dot}</Bob> : dot}
                          <Text style={[s.dayLabel, isToday && s.dayLabelToday]}>{d}</Text>
                        </View>
                      )
                    })}
                  </View>
                  {/* Frosted glass note over the gradient */}
                  <View style={s.streakNoteWrap}>
                    <BlurView intensity={18} tint="light" style={s.streakNote}>
                      <Text style={s.streakNoteText}>
                        {streakAtRisk
                          ? `🔥 Your ${streak}-day streak is on the line — report within ${hoursLeft}h to keep it!`
                          : bonusJustDone
                            ? `Streak bonus earned — +${STREAK_CONFIG.BONUS_POINTS} pts! Keep it rolling 🎉`
                            : `Complete ${STREAK_CONFIG.THRESHOLD_DAYS} days and earn +${STREAK_CONFIG.BONUS_POINTS} bonus pts — ${daysToBonus} day${daysToBonus === 1 ? '' : 's'} left!`}
                      </Text>
                    </BlurView>
                  </View>
                </LinearGradient>

                {/* Missions grid */}
                <SectionHeader title="Missions" style={s.sectionHead} />
                <Text style={s.sectionSub}>Ways to earn coins</Text>
                <View style={s.missionGrid}>
                  {earnActions.map((a) => (
                    <TouchableOpacity
                      key={a.label}
                      activeOpacity={0.8}
                      onPress={() => goEarn(a.route)}
                      style={s.missionCard}
                    >
                      <View style={s.missionEmojiWrap}>
                        <Text style={{ fontSize: 30, lineHeight: 40 }}>{a.emoji}</Text>
                      </View>
                      <Text style={s.missionLabel} numberOfLines={1}>{a.label}</Text>
                      <View style={s.missionPts}>
                        <TroskiCoin size={14} />
                        <Text style={s.missionPtsText}>+{a.pts}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ═══════════ HISTORY ═══════════ */}
            {tab === 'History' && (
              <>
                <View style={s.card}>
                  <Text style={s.availLabel}>Total coins</Text>
                  <View style={s.availRow}>
                    <TroskiCoin size={32} />
                    <Text style={s.availValue}>{coins.toLocaleString()}</Text>
                  </View>
                  <Text style={s.availSub}>Earned from your contributions</Text>
                </View>

                <View style={s.summaryRow}>
                  <View style={[s.summaryCard, { marginRight: 6 }]}>
                    <Text style={s.summaryLabel}>This month</Text>
                    <Text style={[s.summaryValue, { color: ui.success }]}>+{derived.monthEarned}</Text>
                  </View>
                  <View style={[s.summaryCard, { marginLeft: 6 }]}>
                    <Text style={s.summaryLabel}>Redeemed</Text>
                    <Text style={[s.summaryValue, { color: derived.redeemed > 0 ? ui.danger : (isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary) }]}>
                      {derived.redeemed > 0 ? `-${derived.redeemed}` : '0'}
                    </Text>
                  </View>
                </View>

                <SectionHeader title="Coin history" style={s.sectionHead} />
                {derived.groups.length === 0 ? (
                  <View style={s.emptyHistory}>
                    <View style={{ opacity: 0.55 }}><TroskiCoin size={42} /></View>
                    <Text style={s.emptyHistoryText}>No coin activity yet. Start reporting to earn!</Text>
                  </View>
                ) : (
                  derived.groups.map((g) => (
                    <View key={g.title} style={{ marginTop: 6 }}>
                      <Text style={s.histGroup}>{g.title}</Text>
                      <View style={s.listCard}>
                        {g.items.map((h, i) => {
                          const meta = historyMeta(h)
                          const positive = h.points >= 0
                          return (
                            <View key={h.id} style={[s.histRow, i < g.items.length - 1 && s.rowBorder]}>
                              <View style={[s.histIcon, !positive && { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : ui.dangerSoft }]}>
                                <meta.Icon size={16} color={positive ? brand.orange : ui.danger} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.histLabel}>{meta.label}</Text>
                                <Text style={s.histTime}>{histTime(h.created_at)}</Text>
                              </View>
                              <Text style={[s.histPts, { color: positive ? ui.success : ui.danger }]}>
                                {positive ? '+' : '-'}{Math.abs(h.points)}
                              </Text>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ═══════════ REFERRALS ═══════════ */}
            {tab === 'Referrals' && (
              <>
                <View style={s.refTopCard}>
                  <View style={s.refAvatars}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={[s.refAvatar, { marginLeft: i === 0 ? 0 : -10, backgroundColor: brand.orangeSoft }]}>
                        <Users size={14} color={brand.orange} />
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert('Referral History', referralCount > 0 ? `${referralCount} friend${referralCount === 1 ? '' : 's'} have joined with your code.` : 'No referrals yet. Share your code to get started!')}>
                    <Text style={s.refHistoryLink}>View history</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.refCountRow}>
                  <Text style={s.refCountLabel}>Total completed referrals</Text>
                  <Text style={s.refCountValue}>{referralCount} Friend{referralCount === 1 ? '' : 's'}</Text>
                </View>

                {/* Gift graphic */}
                <View style={s.giftWrap}>
                  <Spin duration={30000} style={{ position: 'absolute' }}>
                    <View style={[s.orbit, { width: 200, height: 200, borderRadius: 100 }]} />
                  </Spin>
                  <Spin duration={20000} reverse style={{ position: 'absolute' }}>
                    <View style={[s.orbit, { width: 140, height: 140, borderRadius: 70 }]} />
                  </Spin>
                  <Bob dy={5}><View style={s.giftCircle}><Gift size={40} color={brand.orange} /></View></Bob>
                  {[
                    { top: 6, left: 30 }, { top: 30, right: 18 }, { bottom: 12, left: 18 }, { bottom: 24, right: 30 },
                  ].map((pos, i) => (
                    <View key={i} style={[s.orbitAvatar, pos as object, { backgroundColor: brand.orangeSoft }]}>
                      <Users size={13} color={brand.orange} />
                    </View>
                  ))}
                </View>

                <Text style={s.refTitle}>Invite friends</Text>
                <Text style={s.refSub}>It pays to bring your friends along</Text>

                <View style={s.refRewardPill}>
                  <TroskiCoin size={16} />
                  <Text style={s.refRewardText}>+{REFERRAL_POINTS} coins each</Text>
                </View>

                {/* How it works */}
                <View style={s.stepsCard}>
                  {[
                    'Share your referral code with friends',
                    'They sign up and enter your code',
                    `You both get +${REFERRAL_POINTS} coins straight away`,
                  ].map((step, i, arr) => (
                    <View key={step} style={[s.stepRow, i < arr.length - 1 && s.rowBorder]}>
                      <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                      <Text style={s.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.codeRow}>
                  <View style={s.codeBox}>
                    <Text style={s.codeLabel}>Your referral code</Text>
                    <Text style={s.codeText}>{referralCode ?? '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.codeCopy}>
                    {copied ? <Check size={18} color={ui.success} /> : <Copy size={18} color={brand.orange} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={s.codeShare}>
                    <Share2 size={16} color={ui.onBrand} />
                    <Text style={s.codeShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Tier-up / streak-milestone celebration */}
      {celebrating && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ConfettiCannon
            count={110}
            origin={{ x: SCREEN_W / 2, y: -10 }}
            fadeOut
            autoStart
            colors={[brand.orange, '#FFB196', '#FFD700', ui.success, '#8b5cf6']}
            explosionSpeed={400}
            fallSpeed={2800}
            onAnimationEnd={() => setCelebrating(false)}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

/* ── Small stat cell ─────────────────────────────────── */

function Stat({ label, value, isDark, onPress }: { label: string; value: string; isDark: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: isDark ? ui.onBrand : ui.text }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary }}>{label}</Text>
    </View>
  )
  if (onPress) return <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={onPress}>{body}</TouchableOpacity>
  return body
}

function histTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/* ── Styles ──────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : ui.card
  const subText = isDark ? 'rgba(255,255,255,0.55)' : ui.textSecondary
  const border = isDark ? 'rgba(255,255,255,0.07)' : ui.hairline
  const lift = isDark ? {} : cardShadow

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: ui.bg },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.gutter, paddingTop: 6, paddingBottom: 8 },
    headerTitle: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.5, color: ui.text },

    /* sub-tabs */
    tabRow: { flexDirection: 'row', paddingHorizontal: space.gutter, gap: 8 },

    card: {
      backgroundColor: surface, borderRadius: radius.xl, paddingVertical: 20, padding: 20,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },

    tierPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    tierPillText: { fontFamily: font.bold, fontSize: 13 },

    nextTierText: { alignSelf: 'center', fontFamily: font.medium, fontSize: 12.5, color: subText, marginTop: 12 },

    statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: border },
    statDivider: { width: 1, height: 28, backgroundColor: border },

    /* tier journey */
    tierCard: {
      backgroundColor: surface, borderRadius: radius.lg, padding: 16, marginTop: 14,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    tierTitle: { fontFamily: font.bold, fontSize: 15, color: ui.text },
    tierRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 },
    tierLine: { flex: 1, height: 3, borderRadius: 2, marginTop: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : ui.hairline },
    tierDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : ui.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
    tierDotReached: { backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft },
    tierDotCurrent: { borderColor: brand.orange },
    tierName: { fontFamily: font.semibold, fontSize: 10, color: subText, textAlign: 'center', marginTop: 6, lineHeight: 13 },
    tierNameReached: { color: ui.text },
    tierPts: { fontFamily: font.medium, fontSize: 9, color: subText, marginTop: 1 },

    /* weekly recap */
    weekCard: {
      backgroundColor: surface, borderRadius: radius.lg, padding: 16, marginTop: 14,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    weekTitle: { fontFamily: font.bold, fontSize: 15, color: ui.text },
    weekRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    weekStat: { flex: 1, alignItems: 'center', gap: 3 },
    weekValue: { fontFamily: font.extrabold, fontSize: 18, lineHeight: 24, color: ui.text },
    weekLabel: { fontFamily: font.medium, fontSize: 12, color: subText },

    /* badge case */
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12, rowGap: 10 },
    badgeCard: {
      width: '31.5%', alignItems: 'center', backgroundColor: surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    badgeIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    badgeName: { fontFamily: font.semibold, fontSize: 12, color: ui.text, marginTop: 8 },
    badgeDesc: { fontFamily: font.regular, fontSize: 11, color: subText, textAlign: 'center', marginTop: 2 },
    // Locked badges stay readable; a small lock on the icon marks them instead of fading the card.
    badgeLock: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#6B7280', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

    /* community impact */
    impactCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14,
      backgroundColor: surface, borderRadius: 16, padding: 16,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    impactIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    impactValue: { fontFamily: font.bold, fontSize: 15, color: ui.text },
    impactSub: { fontFamily: font.regular, fontSize: 12.5, color: subText, marginTop: 3, lineHeight: 17 },

    /* streak */
    streakCard: { borderRadius: radius.xl, padding: 18, overflow: 'hidden' },
    streakTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    streakTitle: { fontFamily: font.bold, fontSize: 18, color: ui.onBrand },
    streakBadge: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
    streakDays: { flexDirection: 'row', justifyContent: 'space-between' },
    dayDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
    dayDotDone: { backgroundColor: ui.onBrand },
    dayDotToday: { borderWidth: 2, borderColor: ui.onBrand },
    dayNum: { fontFamily: font.bold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
    dayLabel: { fontFamily: font.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },
    dayLabelToday: { fontFamily: font.bold, color: ui.onBrand },
    streakNoteWrap: { borderRadius: 10, overflow: 'hidden', marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    streakNote: { backgroundColor: 'rgba(255,255,255,0.12)', padding: 12 },
    streakNoteText: { fontFamily: font.medium, fontSize: 12.5, color: ui.onBrand, textAlign: 'center' },

    sectionHead: { marginTop: space.section },
    sectionSub: { fontFamily: font.regular, fontSize: 13, color: subText, marginTop: 2, marginBottom: 12 },

    listCard: { backgroundColor: surface, borderRadius: 16, paddingHorizontal: 14, borderWidth: isDark ? 1 : 0, borderColor: border, ...lift, marginTop: 8 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: border },

    /* missions */
    missionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8, rowGap: 12 },
    missionCard: {
      width: '48.5%', alignItems: 'center', backgroundColor: surface, borderRadius: 18, paddingVertical: 16,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    missionEmojiWrap: {
      width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,77,28,0.12)' : brand.orangeSoft,
    },
    missionLabel: { fontFamily: font.semibold, fontSize: 13.5, color: ui.text, marginTop: 10, paddingHorizontal: 8 },
    missionPts: {
      flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
      backgroundColor: isDark ? 'rgba(255,201,60,0.14)' : ui.warningSoft,
      paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12,
    },
    missionPtsText: { fontFamily: font.bold, fontSize: 13, color: ui.warning },

    /* history */
    availLabel: { fontFamily: font.medium, fontSize: 13, color: subText, marginTop: 4 },
    availRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    availValue: { fontFamily: font.extrabold, fontSize: 34, color: ui.text, letterSpacing: -1 },
    availSub: { fontFamily: font.regular, fontSize: 13, color: subText, marginTop: 2 },
    summaryRow: { flexDirection: 'row', marginTop: 18 },
    summaryCard: { flex: 1, backgroundColor: surface, borderRadius: 14, padding: 16, borderWidth: isDark ? 1 : 0, borderColor: border, ...lift, },
    summaryLabel: { fontFamily: font.medium, fontSize: 12, color: subText },
    summaryValue: { fontFamily: font.extrabold, fontSize: 22, marginTop: 6 },
    histGroup: { fontFamily: font.semibold, fontSize: 13, color: subText, marginTop: 16, marginBottom: 2 },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    histIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    histLabel: { fontFamily: font.semibold, fontSize: 14, color: ui.text },
    histTime: { fontFamily: font.regular, fontSize: 12, color: subText, marginTop: 2 },
    histPts: { fontFamily: font.extrabold, fontSize: 15 },
    emptyHistory: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    emptyHistoryText: { fontFamily: font.medium, fontSize: 13, color: subText, textAlign: 'center', paddingHorizontal: 40 },

    /* referrals */
    refTopCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: surface, borderRadius: 16, padding: 16, borderWidth: isDark ? 1 : 0, borderColor: border },
    refAvatars: { flexDirection: 'row', alignItems: 'center' },
    refAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: surface },
    refHistoryLink: { fontFamily: font.bold, fontSize: 13, color: brand.orange },
    refCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
    refCountLabel: { fontFamily: font.medium, fontSize: 14, color: subText },
    refCountValue: { fontFamily: font.bold, fontSize: 14, color: ui.text },

    giftWrap: { alignItems: 'center', justifyContent: 'center', height: 220, marginTop: 10 },
    orbit: { borderWidth: 1.5, borderColor: border, borderStyle: 'dashed' },
    giftCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    orbitAvatar: { position: 'absolute', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#0c0a09' : ui.bg },

    refTitle: { fontFamily: font.bold, fontSize: 20, color: ui.text, textAlign: 'center', marginTop: 4 },
    refSub: { fontFamily: font.regular, fontSize: 13, color: subText, textAlign: 'center', marginTop: 4, marginBottom: 12, paddingHorizontal: 20 },
    refRewardPill: {
      alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: isDark ? 'rgba(255,201,60,0.14)' : ui.warningSoft,
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, marginBottom: 14,
    },
    refRewardText: { fontFamily: font.bold, fontSize: 14, color: ui.warning },
    stepsCard: {
      backgroundColor: surface, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      ...lift,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    stepNumText: { fontFamily: font.bold, fontSize: 13, color: brand.orange },
    stepText: { flex: 1, fontFamily: font.medium, fontSize: 13.5, color: ui.text },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    codeBox: { flex: 1, backgroundColor: surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: border },
    codeLabel: { fontFamily: font.regular, fontSize: 11, color: subText },
    codeText: { fontFamily: font.extrabold, fontSize: 18, color: ui.text, letterSpacing: 2, marginTop: 2 },
    codeCopy: { width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    codeShare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: brand.orange },
    codeShareText: { fontFamily: font.bold, fontSize: 14, color: ui.onBrand },
  })
}
