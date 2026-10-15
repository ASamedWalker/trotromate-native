import { useCallback, useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Share,
  Dimensions,
  Modal,
  Animated as RNAnimated,
  Easing,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import ConfettiCannon from 'react-native-confetti-cannon'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Coins,
  Flame,
  Bus,
  Clock,
  AlertTriangle,
  TrainFront,
  Camera,
  Gift,
  Check,
  Copy,
  Share2,
  Minus,
  Crown,
  Sparkle,
  ChevronRight,
  History,
  Info,
  X,
} from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { adinkraXml } from '@/lib/brand/adinkra'
import { font, brand, ui, space, radius } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import TroskiCoin from '@/components/TroskiCoin'
import { HeroText } from '@/components/HeroText'
import { FareIcon, QueueIcon, IncidentIcon, GiftIcon } from '@/components/RewardIcons'
import { BackButton } from '@/components/BackButton'
import { useProfile, usePointsHistory } from '@/lib/hooks/useRewards'
import { useRewardInsights } from '@/lib/hooks/useRewardInsights'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { SkeletonRewards } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase'
import { REPORT_POINTS, REFERRAL_POINTS, LEVELS, LEVEL_ORDER, calculateLevel, getNextLevel } from '@/lib/constants/rewards'
import type { PointsHistoryEntry, LevelSlug, ContributorProfile } from '@/lib/types'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'

// Rewards, one scroll (Troski UX v2 "Proposed", RW1–RW7; replaces the
// 2026-10-07 gauge + 4 segments). Recognition only: coins are a counter for
// tier progress, never money. Cards backed by the insights RPCs (impact,
// weekday streak, stations, corridor league) hide when the backend has no
// answer; nothing here is estimated.

const SCREEN_W = Dimensions.get('window').width
const CELEBRATED_KEY = '@troski_rewards_celebrated_v1'
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F']

/* What each tier unlocks, in plain words (RW6). Shown, not enforced here. */
const TIER_PRIVILEGES: Record<LevelSlug, string> = {
  passenger: 'Report fares and queues to earn your first tier.',
  regular: 'Your name shows on reports.',
  local_expert: 'Your answers show first. You can mark incidents cleared.',
  troski_legend: 'Legend badge on every post. You see new features first.',
}

/* Badges named as roles (RW5), measured from profile counters only.
   Helper and Early Bird are left out: no counter exists for helpful answers
   or for reports before 7 AM yet. */
type RoleBadge = {
  key: string
  name: string
  target: number
  goal: string
  value: (p: ContributorProfile) => number
  Icon: typeof FareIcon
}
const ROLE_BADGES: RoleBadge[] = [
  { key: 'queue', name: 'Queue Watcher', target: 25, goal: '25 queue reports', value: (p) => p.queue_reports, Icon: QueueIcon },
  { key: 'fare', name: 'Fare Checker', target: 25, goal: '25 fares', value: (p) => p.fare_reports, Icon: FareIcon },
  { key: 'incident', name: 'Problem Spotter', target: 10, goal: '10 problem reports', value: (p) => p.incident_reports, Icon: IncidentIcon },
]

/* ── History row meta ────────────────────────────────── */

function historyMeta(entry: PointsHistoryEntry): { label: string; Icon: typeof Bus } {
  if (entry.points < 0) return { label: entry.reason || 'Coins adjusted', Icon: Minus }
  switch (entry.report_type) {
    case 'fare': return { label: 'Fare report', Icon: Bus }
    case 'queue': return { label: 'Queue report', Icon: Clock }
    case 'incident': return { label: 'Problem report', Icon: AlertTriangle }
    case 'train': return { label: 'Train report', Icon: TrainFront }
    case 'tale': return { label: 'Pulse post', Icon: Camera }
    case 'referral': return { label: 'Friend joined', Icon: Gift }
    case 'streak': return { label: 'Streak bonus', Icon: Flame }
    default: return { label: entry.reason || 'Coins earned', Icon: Coins }
  }
}

function histTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/* ── Simple bottom sheet (core RN Modal) ─────────────── */

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={s.sheetBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.sheetClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={ui.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

/* ── "Ayekoo!" tier-up banner (core RN Animated) ─────── */

function Ayekoo({ tierName }: { tierName: string }) {
  const v = useRef(new RNAnimated.Value(0)).current
  useEffect(() => {
    RNAnimated.sequence([
      RNAnimated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      RNAnimated.delay(2200),
      RNAnimated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start()
  }, [v])
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
  return (
    <RNAnimated.View style={[s.ayekoo, { opacity: v, transform: [{ scale }] }]} pointerEvents="none">
      <HeroText size={28} style={{ color: ui.onBrand }}>Ayekoo!</HeroText>
      <Text style={s.ayekooSub}>{`You reached ${tierName}`}</Text>
    </RNAnimated.View>
  )
}

/* ── Main Screen ─────────────────────────────────────── */

export default function RewardsScreen() {
  const insets = useSafeAreaInsets()
  const { deviceId, refreshProfile } = useApp()

  const { profile, isLoading, refetch: refetchProfile } = useProfile(deviceId)
  const { entries: history, refetch: refetchHistory } = usePointsHistory(deviceId)
  const { insights, refetch: refetchInsights } = useRewardInsights(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['history', deviceId], ['reward-insights', deviceId]])

  const [refreshing, setRefreshing] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [sheet, setSheet] = useState<null | 'count' | 'history' | 'invite' | 'how'>(null)

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

  /* Confetti only on tier-up (RW6). Same stored key/shape as before so riders
     who already celebrated a tier don't get it again. */
  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(CELEBRATED_KEY)
        const seen: { level?: LevelSlug; streak?: number } = raw ? JSON.parse(raw) : {}
        const lvlIdx = LEVEL_ORDER.indexOf(profile.current_level)
        const seenIdx = LEVEL_ORDER.indexOf(seen.level ?? 'passenger')
        if (lvlIdx > seenIdx) {
          setCelebrating(true)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
        if (lvlIdx !== seenIdx) {
          await AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify({ ...seen, level: profile.current_level }))
        }
      } catch {
        // non-critical
      }
    })()
  }, [profile?.current_level]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchProfile(), refetchHistory(), refetchInsights()])
    setRefreshing(false)
  }, [refreshProfile, refetchProfile, refetchHistory, refetchInsights])

  /* ── Derived data ── */
  const coins = profile?.total_points ?? 0
  const levelSlug: LevelSlug = profile?.current_level ?? calculateLevel(coins)
  const level = LEVELS[levelSlug]
  const nextLevel = getNextLevel(levelSlug)
  const coinsToNext = nextLevel ? Math.max(0, nextLevel.min_points - coins) : 0
  const tierRatio = nextLevel
    ? Math.max(0, Math.min(1, (coins - level.min_points) / Math.max(1, nextLevel.min_points - level.min_points)))
    : 1
  const curIdx = LEVEL_ORDER.indexOf(levelSlug)

  const totalReports = profile?.total_reports ?? 0
  const { impact, streak, stations, league } = insights

  const historyGroups = useMemo(() => {
    const dayMs = 86_400_000
    const todayStr = new Date().toDateString()
    const yestStr = new Date(Date.now() - dayMs).toDateString()
    const groups: { title: string; items: PointsHistoryEntry[] }[] = [
      { title: 'Today', items: [] },
      { title: 'Yesterday', items: [] },
      { title: 'Earlier', items: [] },
    ]
    for (const h of history) {
      const ds = new Date(h.created_at).toDateString()
      if (ds === todayStr) groups[0].items.push(h)
      else if (ds === yestStr) groups[1].items.push(h)
      else groups[2].items.push(h)
    }
    return groups.filter((g) => g.items.length > 0)
  }, [history])

  /* Badges up next: unfinished role badges, closest first */
  const upNext = useMemo(() => {
    if (!profile) return []
    return ROLE_BADGES.map((b) => {
      const n = Number(b.value(profile))
      const cur = Number.isFinite(n) ? Math.min(n, b.target) : 0
      return { b, cur, ratio: cur / b.target }
    })
      .filter((x) => x.cur < x.b.target)
      .sort((a, z) => z.ratio - a.ratio)
  }, [profile])

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
        message: `Join me on Troski with my code ${referralCode}. Check trotro fares and queues before you leave. https://www.troski.me`,
      })
    } catch {
      // cancelled
    }
  }

  const openSheet = (k: 'count' | 'history' | 'invite' | 'how') => {
    Haptics.selectionAsync()
    setSheet(k)
  }

  const heroGlyph = useMemo(() => adinkraXml('adinkrahene', 120, '#FFFFFF'), [])

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header: back on the left, coins + tier small on the right (RW1) */}
      <View style={s.header}>
        <BackButton />
        <View style={{ flex: 1 }} />
        <View style={s.headChip} accessible accessibilityLabel={`${coins} coins`}>
          <TroskiCoin size={16} />
          <Text style={s.headChipText}>{plural(coins, 'coin')}</Text>
        </View>
        <View style={[s.headChip, { backgroundColor: brand.orangeSoft }]}>
          <Text style={[s.headChipText, { color: brand.orangeText }]}>{level.name}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} />}
      >
        {isLoading ? (
          <SkeletonRewards isDark={false} />
        ) : (
          <View>
            {/* ═══ RW1 Impact hero ═══ */}
            <View style={s.hero}>
              <View style={s.heroGlyph} pointerEvents="none">
                <SvgXml xml={heroGlyph} width={120} height={120} />
              </View>
              {impact ? (
                <>
                  <HeroText size={40} style={s.heroBig}>{plural(impact.ridersHelped, 'rider')}</HeroText>
                  <Text style={s.heroLine}>used your reports this month</Text>
                  <Text style={s.heroMix}>
                    {`${impact.queueReports} queue · ${impact.fareReports} fare · ${plural(impact.problemReports, 'problem report')}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.heroLine}>Your reports so far</Text>
                  <HeroText size={40} style={s.heroBig}>{totalReports.toLocaleString()}</HeroText>
                  {totalReports > 0 ? (
                    <Text style={s.heroMix}>
                      {`${profile?.queue_reports ?? 0} queue · ${profile?.fare_reports ?? 0} fare · ${plural(profile?.incident_reports ?? 0, 'problem report')}`}
                    </Text>
                  ) : (
                    <Text style={s.heroMix}>Report a fare or a queue and riders behind you see it.</Text>
                  )}
                </>
              )}
              <TouchableOpacity onPress={() => openSheet('count')} style={s.heroLink} accessibilityRole="button" hitSlop={8}>
                <Text style={s.heroLinkText}>How we count</Text>
              </TouchableOpacity>
            </View>

            {/* ═══ RW2 Weekday streak (insights only) ═══ */}
            {streak && (
              <View style={[s.card, s.block]}>
                <View style={s.rowBetween}>
                  <Text style={s.cardTitle}>{`${streak.streakDays}-day streak`}</Text>
                  <Text style={s.meta}>Weekends never count</Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 12 }]}>
                  {WEEKDAYS.map((d, i) => {
                    const done = !!streak.week[i]
                    const isToday = (new Date().getDay() + 6) % 7 === i
                    return (
                      <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                        <View style={[s.dayDot, done ? s.dayDone : isToday ? s.dayToday : s.dayOpen]}>
                          {done ? <Check size={20} color={ui.onBrand} strokeWidth={2.6} /> : isToday ? <Text style={s.dayTodayText}>today</Text> : null}
                        </View>
                        <Text style={s.dayLabel}>{d}</Text>
                      </View>
                    )
                  })}
                </View>
                <Text style={[s.meta, { marginTop: 10 }]}>Report on your way to work to keep it going.</Text>
              </View>
            )}

            {/* ═══ RW3 Your stations (insights only) ═══ */}
            {stations && stations.length > 0 && (
              <View style={s.block}>
                <Text style={s.sectionTitle}>Your stations</Text>
                <View style={[s.listCard, { marginTop: 8 }]}>
                  {stations.map((st, i) => (
                    <View key={st.stationName} style={[s.listRow, i > 0 && s.rowTop]}>
                      {st.isLegend ? (
                        <View style={[s.rankDot, { backgroundColor: ui.warningSoft }]}>
                          <Crown size={20} color={ui.warning} />
                        </View>
                      ) : (
                        <View style={[s.rankDot, { backgroundColor: ui.surface }]}>
                          <Text style={s.rankText}>{`#${st.rank}`}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {st.isLegend ? `${st.stationName} · Station Legend` : st.stationName}
                        </Text>
                        <Text style={s.meta}>
                          {st.isLegend
                            ? `${plural(st.reports30d, 'report')} in the last 30 days`
                            : `${plural(st.reports30d, 'report')}. The Legend has ${st.legendReports30d}.`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ═══ RW4 Weekly corridor league (insights only) ═══ */}
            {league && league.rows.length > 0 && (
              <View style={s.block}>
                <Text style={s.sectionTitle}>{`${league.corridorName} riders`}</Text>
                <Text style={s.meta}>
                  {`This week · top 5 get a gold star on their posts${league.daysLeft != null ? ` · ${plural(league.daysLeft, 'day')} left` : ''}`}
                </Text>
                <View style={[s.listCard, { marginTop: 8 }]}>
                  {league.rows.map((r, i) => (
                    <View key={`${r.rank}-${r.name}`} style={[s.leagueRow, i > 0 && s.rowTop, r.isMe && { backgroundColor: brand.orangeSoft }]}>
                      <Text style={s.leagueRank}>{r.rank}</Text>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{(r.name.trim()[0] ?? 'R').toUpperCase()}</Text>
                      </View>
                      <Text style={[s.leagueName, r.isMe && { fontFamily: font.extrabold }]} numberOfLines={1}>
                        {r.isMe ? `You · ${r.name}` : r.name}
                      </Text>
                      {r.rank <= 5 && <Sparkle size={16} color={ui.warning} />}
                      <Text style={s.meta}>{plural(r.reports, 'report')}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.meta, { marginTop: 4 }]}>Paid Troski reporters are not ranked.</Text>
              </View>
            )}

            {/* ═══ RW5 Badges up next ═══ */}
            {upNext.length > 0 && (
              <View style={s.block}>
                <Text style={s.sectionTitle}>Badges up next</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {upNext.map(({ b, cur, ratio }) => (
                    <View key={b.key} style={[s.card, s.badgeRow]}>
                      <View style={s.badgeTile}>
                        <b.Icon color={brand.orangeText} size={22} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.rowBetween}>
                          <Text style={s.rowTitle} numberOfLines={1}>{b.name}</Text>
                          <Text style={s.meta}>{`${cur}/${b.target}`}</Text>
                        </View>
                        <View
                          style={s.track}
                          accessibilityRole="progressbar"
                          accessibilityLabel={`${b.name} progress`}
                          accessibilityValue={{ min: 0, max: b.target, now: cur }}
                        >
                          {cur > 0 && <View style={[s.fill, { width: `${Math.max(3, ratio * 100)}%` }]} />}
                        </View>
                        <Text style={s.meta}>{b.goal}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ═══ RW6 What your tier unlocks ═══ */}
            <View style={s.block}>
              <Text style={s.sectionTitle}>What your tier unlocks</Text>
              <View style={[s.card, { marginTop: 8 }]}>
                <View style={s.rowBetween}>
                  <Text style={s.tierName}>{level.name}</Text>
                  <Text style={s.hereText}>{"You're here"}</Text>
                </View>
                <Text style={s.tierBody}>{TIER_PRIVILEGES[levelSlug]}</Text>
                <View
                  style={[s.track, { marginTop: 10 }]}
                  accessibilityRole="progressbar"
                  accessibilityLabel="Progress to next tier"
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(tierRatio * 100) }}
                >
                  {tierRatio > 0 && <View style={[s.fill, { width: `${Math.max(3, tierRatio * 100)}%` }]} />}
                </View>
                <Text style={[s.meta, { marginTop: 4 }]}>
                  {nextLevel ? `${plural(coinsToNext, 'coin')} to ${nextLevel.name}` : 'Top tier reached'}
                </Text>
                {LEVEL_ORDER.slice(curIdx + 1).map((slug) => (
                  <View key={slug} style={{ marginTop: 10 }}>
                    <Text style={s.tierName}>{LEVELS[slug].name}</Text>
                    <Text style={s.tierBody}>{TIER_PRIVILEGES[slug]}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ═══ Rows ═══ */}
            <View style={[s.listCard, s.block]}>
              {[
                { k: 'history' as const, label: 'Coin history', Icon: History },
                { k: 'invite' as const, label: 'Invite friends', Icon: Gift },
                { k: 'how' as const, label: 'How rewards work', Icon: Info },
              ].map((r, i) => (
                <TouchableOpacity
                  key={r.k}
                  activeOpacity={0.7}
                  onPress={() => openSheet(r.k)}
                  style={[s.navRow, i > 0 && s.rowTop]}
                  accessibilityRole="button"
                >
                  <View style={s.navIcon}>
                    <r.Icon size={20} color={brand.orangeText} />
                  </View>
                  <Text style={[s.rowTitle, { flex: 1 }]}>{r.label}</Text>
                  <ChevronRight size={20} color={ui.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── How we count ── */}
      <Sheet visible={sheet === 'count'} title="How we count" onClose={() => setSheet(null)}>
        <Text style={s.sheetBody}>
          A rider counts when they open a station or line while your report there is still fresh. Each rider counts once a month, however many of your reports they see.
        </Text>
        <Text style={[s.sheetBody, { marginTop: 10 }]}>
          Until that count is ready, we show how many reports you have shared.
        </Text>
      </Sheet>

      {/* ── Coin history ── */}
      <Sheet visible={sheet === 'history'} title="Coin history" onClose={() => setSheet(null)}>
        {historyGroups.length === 0 ? (
          <View style={s.emptyHistory}>
            <View style={{ opacity: 0.55 }}><TroskiCoin size={42} /></View>
            <Text style={s.meta}>No coins yet. Your first report starts the count.</Text>
          </View>
        ) : (
          historyGroups.map((g) => (
            <View key={g.title} style={{ marginTop: 6 }}>
              <Text style={s.histGroup}>{g.title}</Text>
              {g.items.map((h, i) => {
                const meta = historyMeta(h)
                const positive = h.points >= 0
                return (
                  <View key={h.id} style={[s.histRow, i > 0 && s.rowTop]}>
                    <View style={[s.histIcon, !positive && { backgroundColor: ui.dangerSoft }]}>
                      <meta.Icon size={16} color={positive ? brand.orangeText : ui.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{meta.label}</Text>
                      <Text style={s.meta}>{histTime(h.created_at)}</Text>
                    </View>
                    <Text style={[s.histPts, { color: positive ? ui.success : ui.danger }]}>
                      {`${positive ? '+' : '-'}${Math.abs(h.points)} coins`}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))
        )}
      </Sheet>

      {/* ── Invite friends ── */}
      <Sheet visible={sheet === 'invite'} title="Invite friends" onClose={() => setSheet(null)}>
        <Text style={s.sheetBody}>
          {`When a friend joins with your code, you both get ${REFERRAL_POINTS} coins.`}
        </Text>
        <View style={s.codeRow}>
          <View style={s.codeBox}>
            <Text style={s.meta}>Your code</Text>
            <Text style={s.codeText}>{referralCode ?? '—'}</Text>
          </View>
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.codeCopy} accessibilityRole="button" accessibilityLabel="Copy code">
            {copied ? <Check size={18} color={ui.success} /> : <Copy size={18} color={brand.orangeText} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={s.codeShare} accessibilityRole="button">
            <Share2 size={16} color={ui.onBrand} />
            <Text style={s.codeShareText}>Share</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.meta}>{`${plural(referralCount, 'friend')} joined with your code`}</Text>
      </Sheet>

      {/* ── How rewards work ── */}
      <Sheet visible={sheet === 'how'} title="How rewards work" onClose={() => setSheet(null)}>
        {[
          { Icon: FareIcon, text: `Fare report: ${REPORT_POINTS.fare} coins` },
          { Icon: QueueIcon, text: `Queue report: ${REPORT_POINTS.queue} coins` },
          { Icon: IncidentIcon, text: `Problem report: ${REPORT_POINTS.incident} coins` },
          { Icon: GiftIcon, text: `Friend joins with your code: ${REFERRAL_POINTS} coins` },
        ].map((r) => (
          <View key={r.text} style={s.howRow}>
            <View style={s.navIcon}><r.Icon color={brand.orangeText} size={20} /></View>
            <Text style={[s.sheetBody, { flex: 1 }]}>{r.text}</Text>
          </View>
        ))}
        <Text style={[s.sheetBody, { marginTop: 10 }]}>
          Coins count toward your tier. Tiers show riders you can be trusted: Regular, Local Expert, then Troski Legend. Coins are not money and cannot be cashed out.
        </Text>
      </Sheet>

      {/* Tier-up celebration */}
      {celebrating && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Ayekoo tierName={level.name} />
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

/* ── Styles ──────────────────────────────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 6 },
  headChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: ui.surface },
  headChipText: { fontFamily: font.bold, fontSize: 13, color: ui.text },

  block: { marginTop: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTop: { borderTopWidth: 1, borderTopColor: ui.hairline },

  /* hero */
  hero: { backgroundColor: brand.orange, borderRadius: 22, padding: 20, overflow: 'hidden', marginTop: 6 },
  heroGlyph: { position: 'absolute', right: -18, top: -10, opacity: 0.16 },
  heroBig: { color: ui.onBrand, letterSpacing: -0.5 },
  heroLine: { fontFamily: font.bold, fontSize: 17, color: ui.onBrand },
  heroMix: { fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 4 },
  heroLink: { alignSelf: 'flex-start', marginTop: 6, minHeight: 32, justifyContent: 'center' },
  heroLinkText: { fontFamily: font.semibold, fontSize: 13, color: ui.onBrand, textDecorationLine: 'underline' },

  /* cards */
  card: { backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1, borderColor: ui.hairline, padding: 14 },
  listCard: { backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1, borderColor: ui.hairline, overflow: 'hidden' },
  cardTitle: { fontFamily: font.extrabold, fontSize: 17, color: ui.text },
  sectionTitle: { fontFamily: font.extrabold, fontSize: 18, color: ui.text, letterSpacing: -0.3 },
  meta: { fontFamily: font.medium, fontSize: 12, color: ui.textSecondary },
  rowTitle: { fontFamily: font.bold, fontSize: 15, color: ui.text },

  /* streak */
  dayDot: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: brand.orange },
  dayToday: { borderWidth: 1.5, borderColor: ui.surfaceStrong, borderStyle: 'dashed' },
  dayOpen: { backgroundColor: ui.surface },
  dayTodayText: { fontFamily: font.bold, fontSize: 12, color: ui.textSecondary },
  dayLabel: { fontFamily: font.bold, fontSize: 12, color: ui.text },

  /* stations / league */
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 64 },
  rankDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: font.extrabold, fontSize: 14, color: ui.text },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52 },
  leagueRank: { width: 22, fontFamily: font.extrabold, fontSize: 15, color: ui.text },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: ui.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.extrabold, fontSize: 12, color: ui.text },
  leagueName: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: ui.text },

  /* badges */
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgeTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: ui.surface, marginTop: 6, marginBottom: 2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: brand.orange },

  /* tiers */
  tierName: { fontFamily: font.extrabold, fontSize: 15, color: ui.text },
  tierBody: { fontFamily: font.regular, fontSize: 14, color: ui.textSecondary },
  hereText: { fontFamily: font.bold, fontSize: 13, color: ui.success },

  /* rows */
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 56 },
  navIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },

  /* sheets */
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ui.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.gutter, paddingTop: 8, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 19, color: ui.text },
  sheetClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  sheetBody: { fontFamily: font.regular, fontSize: 15, color: ui.text },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },

  /* history */
  histGroup: { fontFamily: font.semibold, fontSize: 13, color: ui.textSecondary, marginTop: 10, marginBottom: 2 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  histIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  histPts: { fontFamily: font.extrabold, fontSize: 14 },
  emptyHistory: { alignItems: 'center', gap: 10, paddingVertical: 32 },

  /* referral */
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  codeBox: { flex: 1, backgroundColor: ui.bg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: ui.hairline },
  codeText: { fontFamily: font.extrabold, fontSize: 18, color: ui.text, letterSpacing: 2 },
  codeCopy: { width: 48, height: 48, borderRadius: 14, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  codeShare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: brand.orange },
  codeShareText: { fontFamily: font.bold, fontSize: 14, color: ui.onBrand },

  /* celebration */
  ayekoo: { backgroundColor: brand.orange, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 16, alignItems: 'center' },
  ayekooSub: { fontFamily: font.semibold, fontSize: 15, color: ui.onBrand },
})
