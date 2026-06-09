import { useCallback, useMemo, useState, useEffect } from 'react'
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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import {
  Wallet as WalletIcon,
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
  TrendingUp,
} from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { useRouter, type Href } from 'expo-router'
import { themed, font } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useApp } from '@/lib/contexts/AppContext'
import { useProfile, usePointsHistory } from '@/lib/hooks/useRewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { SkeletonRewards } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase'
import { REPORT_POINTS, STREAK_CONFIG } from '@/lib/constants/rewards'
import type { PointsHistoryEntry } from '@/lib/types'

/* ── Constants ──────────────────────────────────────── */

const BRAND = '#FF4D1C'
const COIN_TO_GHS = 0.1 // 1 coin ≈ GH₵0.10 (124 coins → GH₵12.40)
const TABS = ['Coins', 'Earn', 'History', 'Referrals'] as const
type Tab = (typeof TABS)[number]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']

/* ── Semicircular coin gauge ─────────────────────────── */

function CoinGauge({ value, max, isDark }: { value: number; max: number; isDark: boolean }) {
  const W = 240
  const R = 96
  const SW = 18
  const cx = W / 2
  const cy = R + SW / 2
  const H = cy + SW / 2 + 2
  const len = Math.PI * R
  const f = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  // Top semicircle: left point → right point, sweep over the top
  const d = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const track = isDark ? 'rgba(255,255,255,0.10)' : '#F1ECEA'

  return (
    <View style={{ width: W, height: H + 22, alignItems: 'center' }}>
      <Svg width={W} height={H}>
        <Path d={d} stroke={track} strokeWidth={SW} fill="none" strokeLinecap="round" />
        <Path
          d={d}
          stroke={BRAND}
          strokeWidth={SW}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len * f} ${len}`}
        />
      </Svg>
      {/* Center value */}
      <View style={{ position: 'absolute', top: cy - 58, width: W, alignItems: 'center' }}>
        <Coins size={22} color={BRAND} />
        <Text style={{ fontFamily: font.extrabold, fontSize: 40, color: isDark ? '#fff' : '#1c1917', letterSpacing: -1, marginTop: 2 }}>
          {value.toLocaleString()}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}>
          Troski Coin
        </Text>
      </View>
      {/* Scale labels */}
      <View style={{ position: 'absolute', top: cy - 4, width: W, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
        <Text style={gaugeScaleStyle(isDark)}>0</Text>
        <Text style={gaugeScaleStyle(isDark)}>{max}</Text>
      </View>
    </View>
  )
}

function gaugeScaleStyle(isDark: boolean) {
  return { fontFamily: font.bold, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' } as const
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
  const { deviceId, refreshProfile } = useApp()

  const { profile, rank, isLoading, refetch: refetchProfile } = useProfile(deviceId)
  const { entries: history, refetch: refetchHistory } = usePointsHistory(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['history', deviceId]])

  const [tab, setTab] = useState<Tab>('Coins')
  const [refreshing, setRefreshing] = useState(false)

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchProfile(), refetchHistory()])
    setRefreshing(false)
  }, [refreshProfile, refetchProfile, refetchHistory])

  /* ── Derived data ── */
  const coins = profile?.total_points ?? 0
  const streak = profile?.current_streak ?? 0
  const ghsValue = (coins * COIN_TO_GHS).toFixed(2)
  const gaugeMax = Math.max(200, Math.ceil((coins + 1) / 100) * 100)

  const derived = useMemo(() => {
    const now = Date.now()
    const dayMs = 86_400_000
    const todayStr = new Date(now).toDateString()
    const yestStr = new Date(now - dayMs).toDateString()
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()

    let todayPoints = 0
    let thisWeek = 0
    let prevWeek = 0
    let monthEarned = 0
    let redeemed = 0
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
      if (now - t < 7 * dayMs && h.points > 0) thisWeek += h.points
      else if (now - t >= 7 * dayMs && now - t < 14 * dayMs && h.points > 0) prevWeek += h.points
      if (t >= monthStart && h.points > 0) monthEarned += h.points
      if (h.points < 0) redeemed += Math.abs(h.points)
    }
    return {
      todayPoints,
      weekDelta: thisWeek - prevWeek,
      monthEarned,
      redeemed,
      groups: groups.filter((g) => g.items.length > 0),
    }
  }, [history])

  /* ── Earn actions (real point values) ── */
  const earnActions = useMemo(() => [
    { label: 'Report a fare', sub: 'Tell the community what you paid', pts: REPORT_POINTS.fare, Icon: Bus, route: '/report/fare' },
    { label: 'Report a queue status', sub: 'Update bay queue at the terminal', pts: REPORT_POINTS.queue, Icon: Users, route: '/report/queue' },
    { label: 'Report incidents', sub: 'Accidents, breakdowns, roadblocks', pts: REPORT_POINTS.incident, Icon: AlertTriangle, route: '/report/incident' },
    { label: 'Share to Pulse', sub: 'Post your commute experience', pts: REPORT_POINTS.tale, Icon: Camera, route: '/report/photo' },
    { label: '7-day streak bonus', sub: 'Use Troski 7 days in a row', pts: STREAK_CONFIG.BONUS_POINTS, Icon: Flame, route: null },
    { label: 'Refer a friend', sub: 'They must complete 3 trips', pts: 500, Icon: Gift, route: null },
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(route as Href)
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Rewards</Text>
      </View>

      {/* Sub-tabs */}
      <View style={s.tabRow}>
        {TABS.map((tb) => {
          const active = tab === tb
          return (
            <TouchableOpacity
              key={tb}
              activeOpacity={0.8}
              onPress={() => { setTab(tb); Haptics.selectionAsync() }}
              style={[s.tabPill, active && s.tabPillActive]}
            >
              <Text style={[s.tabPillText, active && s.tabPillTextActive]}>{tb}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} colors={[BRAND]} />}
      >
        {isLoading ? (
          <SkeletonRewards isDark={isDark} />
        ) : (
          <Animated.View entering={FadeInDown.duration(350)}>
            {/* ═══════════ COINS ═══════════ */}
            {tab === 'Coins' && (
              <>
                <View style={s.card}>
                  <Text style={s.coinCaption}>1 coin ≈ GH₵{COIN_TO_GHS.toFixed(2)}</Text>
                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                    <CoinGauge value={coins} max={gaugeMax} isDark={isDark} />
                  </View>
                  <View style={s.statRow}>
                    <Stat label="Today" value={`${derived.todayPoints >= 0 ? '' : ''}${derived.todayPoints}`} isDark={isDark} />
                    <View style={s.statDivider} />
                    <Stat label="Streak" value={`${streak}`} isDark={isDark} />
                    <View style={s.statDivider} />
                    <Stat label="Rank" value={rank ? `#${rank}` : '--'} isDark={isDark} onPress={() => router.push('/leaderboard' as Href)} />
                  </View>
                </View>

                <TouchableOpacity activeOpacity={0.9} style={s.primaryBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/wallet' as Href) }}>
                  <WalletIcon size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>View Wallet</Text>
                </TouchableOpacity>

                <View style={s.banner}>
                  <TrendingUp size={16} color="#16a34a" />
                  <Text style={s.bannerText}>
                    {derived.weekDelta > 0
                      ? `You've earned ${derived.weekDelta}+ more points than last week`
                      : 'Keep earning coins to climb the ranks'}
                  </Text>
                </View>
              </>
            )}

            {/* ═══════════ EARN ═══════════ */}
            {tab === 'Earn' && (
              <>
                {/* Daily streak */}
                <View style={s.streakCard}>
                  <View style={s.streakTop}>
                    <Text style={s.streakTitle}>Daily Streak</Text>
                    <Text style={s.streakBadge}>{streak} day streak</Text>
                  </View>
                  <View style={s.streakDays}>
                    {DAYS.map((d, i) => {
                      const done = i < Math.min(streak, 7)
                      return (
                        <View key={d} style={{ alignItems: 'center', gap: 6 }}>
                          <View style={[s.dayDot, done && s.dayDotDone]}>
                            {done ? <Check size={14} color={BRAND} strokeWidth={3} /> : <Text style={s.dayNum}>{i + 1}</Text>}
                          </View>
                          <Text style={s.dayLabel}>{d}</Text>
                        </View>
                      )
                    })}
                  </View>
                  <View style={s.streakNote}>
                    <Text style={s.streakNoteText}>
                      Complete 7 days and earn +{STREAK_CONFIG.BONUS_POINTS} bonus pts
                      {streak < 7 ? ` — ${7 - streak} day${7 - streak === 1 ? '' : 's'} left!` : ' — done!'}
                    </Text>
                  </View>
                </View>

                {/* Earn coin list */}
                <Text style={s.sectionTitle}>Earn Coin</Text>
                <Text style={s.sectionSub}>Report fares, queues & more</Text>
                <View style={s.listCard}>
                  {earnActions.map((a, i) => (
                    <TouchableOpacity
                      key={a.label}
                      activeOpacity={0.7}
                      onPress={() => goEarn(a.route)}
                      style={[s.earnRow, i < earnActions.length - 1 && s.rowBorder]}
                    >
                      <View style={s.earnIcon}><a.Icon size={18} color={BRAND} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.earnLabel}>{a.label}</Text>
                        <Text style={s.earnSub}>{a.sub}</Text>
                      </View>
                      <View style={s.ptsPill}>
                        <Text style={s.ptsPillText}>+{a.pts}</Text>
                        <Coins size={12} color={BRAND} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ═══════════ HISTORY ═══════════ */}
            {tab === 'History' && (
              <>
                <Text style={s.availLabel}>Available Coin</Text>
                <View style={s.availRow}>
                  <Coins size={26} color={BRAND} />
                  <Text style={s.availValue}>{coins.toLocaleString()}</Text>
                </View>
                <Text style={s.availSub}>Equivalent to <Text style={{ fontFamily: font.bold, color: isDark ? '#fff' : '#1c1917' }}>GH₵{ghsValue}</Text> in value</Text>

                <TouchableOpacity activeOpacity={0.85} style={s.cashOutBtn} onPress={() => Alert.alert('Cash Out — Coming soon', 'Redeeming Troski Coins for MoMo cash is on the way. Keep earning in the meantime!')}>
                  <Banknote size={18} color="#16a34a" />
                  <Text style={s.cashOutText}>Cash Out</Text>
                </TouchableOpacity>

                <View style={s.summaryRow}>
                  <View style={[s.summaryCard, { marginRight: 6 }]}>
                    <Text style={s.summaryLabel}>This Month</Text>
                    <Text style={[s.summaryValue, { color: '#16a34a' }]}>+{derived.monthEarned}</Text>
                  </View>
                  <View style={[s.summaryCard, { marginLeft: 6 }]}>
                    <Text style={s.summaryLabel}>Redeemed</Text>
                    <Text style={[s.summaryValue, { color: derived.redeemed > 0 ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF') }]}>
                      {derived.redeemed > 0 ? `-${derived.redeemed}` : '0'}
                    </Text>
                  </View>
                </View>

                <Text style={s.sectionTitle}>Coin History</Text>
                {derived.groups.length === 0 ? (
                  <View style={s.emptyHistory}>
                    <Coins size={36} color={isDark ? '#57534e' : '#D4D4D2'} />
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
                              <View style={[s.histIcon, !positive && { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEECEC' }]}>
                                <meta.Icon size={16} color={positive ? BRAND : '#ef4444'} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.histLabel}>{meta.label}</Text>
                                <Text style={s.histTime}>{histTime(h.created_at)}</Text>
                              </View>
                              <Text style={[s.histPts, { color: positive ? '#16a34a' : '#ef4444' }]}>
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
                      <View key={i} style={[s.refAvatar, { marginLeft: i === 0 ? 0 : -10, backgroundColor: ['#FFD6C7', '#C7E5FF', '#D7F5D7', '#EAD7FF'][i] }]}>
                        <Users size={14} color="#fff" />
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert('Referral History', referralCount > 0 ? `${referralCount} friend${referralCount === 1 ? '' : 's'} have joined with your code.` : 'No referrals yet. Share your code to get started!')}>
                    <Text style={s.refHistoryLink}>View History</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.refCountRow}>
                  <Text style={s.refCountLabel}>Total Completed Referrals</Text>
                  <Text style={s.refCountValue}>{referralCount} Friend{referralCount === 1 ? '' : 's'}</Text>
                </View>

                {/* Gift graphic */}
                <View style={s.giftWrap}>
                  <View style={[s.orbit, { width: 200, height: 200, borderRadius: 100 }]} />
                  <View style={[s.orbit, { width: 140, height: 140, borderRadius: 70 }]} />
                  <View style={s.giftCircle}><Gift size={40} color={BRAND} /></View>
                  {[
                    { top: 6, left: 30 }, { top: 30, right: 18 }, { bottom: 12, left: 18 }, { bottom: 24, right: 30 },
                  ].map((pos, i) => (
                    <View key={i} style={[s.orbitAvatar, pos as object, { backgroundColor: ['#FFD6C7', '#C7E5FF', '#D7F5D7', '#EAD7FF'][i] }]}>
                      <Users size={13} color="#fff" />
                    </View>
                  ))}
                </View>

                <Text style={s.refTitle}>Invite Friends</Text>
                <Text style={s.refSub}>Get 500 pts per referral who completes 3 trips</Text>

                <View style={s.codeRow}>
                  <View style={s.codeBox}>
                    <Text style={s.codeLabel}>Your referral code</Text>
                    <Text style={s.codeText}>{referralCode ?? '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.codeCopy}>
                    {copied ? <Check size={18} color="#16a34a" /> : <Copy size={18} color={BRAND} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={s.codeShare}>
                    <Share2 size={16} color="#fff" />
                    <Text style={s.codeShareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/* ── Small stat cell ─────────────────────────────────── */

function Stat({ label, value, isDark, onPress }: { label: string; value: string; isDark: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: isDark ? '#fff' : '#1c1917' }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}>{label}</Text>
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
  const t = themed(isDark)
  const surface = isDark ? '#1c1c1e' : '#ffffff'
  const subText = isDark ? 'rgba(255,255,255,0.55)' : '#9CA3AF'
  const border = isDark ? 'rgba(255,255,255,0.07)' : '#F1ECEA'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? t.bg : '#fafaf9' },

    header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8, alignItems: 'center' },
    headerTitle: { fontFamily: font.bold, fontSize: 18, color: t.text },

    /* sub-tabs */
    tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
    tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F1F0' },
    tabPillActive: { backgroundColor: BRAND },
    tabPillText: { fontFamily: font.semibold, fontSize: 13, color: subText },
    tabPillTextActive: { color: '#fff' },

    card: {
      backgroundColor: surface, borderRadius: 20, paddingVertical: 20, padding: 20,
      borderWidth: isDark ? 1 : 0, borderColor: border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 16, elevation: isDark ? 0 : 3,
    },
    coinCaption: { alignSelf: 'center', fontFamily: font.medium, fontSize: 12, color: subText },

    statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 16, borderTopWidth: 1, borderTopColor: border },
    statDivider: { width: 1, height: 28, backgroundColor: border },

    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 52, borderRadius: 14, backgroundColor: BRAND, marginTop: 16,
    },
    primaryBtnText: { fontFamily: font.bold, fontSize: 15, color: '#fff' },

    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
      backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#EAF7EE', borderRadius: 12, padding: 14,
    },
    bannerText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: isDark ? '#86efac' : '#15803d' },

    /* streak */
    streakCard: { backgroundColor: BRAND, borderRadius: 20, padding: 18, overflow: 'hidden' },
    streakTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    streakTitle: { fontFamily: font.bold, fontSize: 18, color: '#fff' },
    streakBadge: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
    streakDays: { flexDirection: 'row', justifyContent: 'space-between' },
    dayDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
    dayDotDone: { backgroundColor: '#fff' },
    dayNum: { fontFamily: font.bold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
    dayLabel: { fontFamily: font.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },
    streakNote: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: 12, marginTop: 16 },
    streakNoteText: { fontFamily: font.medium, fontSize: 12.5, color: '#fff', textAlign: 'center' },

    sectionTitle: { fontFamily: font.bold, fontSize: 18, color: t.text, marginTop: 22 },
    sectionSub: { fontFamily: font.regular, fontSize: 13, color: subText, marginTop: 2, marginBottom: 12 },

    listCard: { backgroundColor: surface, borderRadius: 16, paddingHorizontal: 14, borderWidth: isDark ? 1 : 0, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 12, elevation: isDark ? 0 : 2, marginTop: 8 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: border },

    earnRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    earnIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : '#FFF0EB', alignItems: 'center', justifyContent: 'center' },
    earnLabel: { fontFamily: font.semibold, fontSize: 15, color: t.text },
    earnSub: { fontFamily: font.regular, fontSize: 12, color: subText, marginTop: 2 },
    ptsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : '#FFF0EB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    ptsPillText: { fontFamily: font.bold, fontSize: 14, color: BRAND },

    /* history */
    availLabel: { fontFamily: font.medium, fontSize: 13, color: subText, marginTop: 4 },
    availRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    availValue: { fontFamily: font.extrabold, fontSize: 34, color: t.text, letterSpacing: -1 },
    availSub: { fontFamily: font.regular, fontSize: 13, color: subText, marginTop: 2 },
    cashOutBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#16a34a', borderRadius: 12, paddingHorizontal: 16, height: 42, marginTop: 16 },
    cashOutText: { fontFamily: font.bold, fontSize: 14, color: '#16a34a' },
    summaryRow: { flexDirection: 'row', marginTop: 18 },
    summaryCard: { flex: 1, backgroundColor: surface, borderRadius: 14, padding: 16, borderWidth: isDark ? 1 : 0, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 10, elevation: isDark ? 0 : 2 },
    summaryLabel: { fontFamily: font.medium, fontSize: 12, color: subText },
    summaryValue: { fontFamily: font.extrabold, fontSize: 22, marginTop: 6 },
    histGroup: { fontFamily: font.bold, fontSize: 12, color: subText, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 2 },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    histIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : '#FFF0EB', alignItems: 'center', justifyContent: 'center' },
    histLabel: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    histTime: { fontFamily: font.regular, fontSize: 12, color: subText, marginTop: 2 },
    histPts: { fontFamily: font.extrabold, fontSize: 15 },
    emptyHistory: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    emptyHistoryText: { fontFamily: font.medium, fontSize: 13, color: subText, textAlign: 'center', paddingHorizontal: 40 },

    /* referrals */
    refTopCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: surface, borderRadius: 16, padding: 16, borderWidth: isDark ? 1 : 0, borderColor: border },
    refAvatars: { flexDirection: 'row', alignItems: 'center' },
    refAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: surface },
    refHistoryLink: { fontFamily: font.bold, fontSize: 13, color: BRAND },
    refCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
    refCountLabel: { fontFamily: font.medium, fontSize: 14, color: subText },
    refCountValue: { fontFamily: font.bold, fontSize: 14, color: t.text },

    giftWrap: { alignItems: 'center', justifyContent: 'center', height: 220, marginTop: 10 },
    orbit: { position: 'absolute', borderWidth: 1, borderColor: border },
    giftCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : '#FFF0EB', alignItems: 'center', justifyContent: 'center' },
    orbitAvatar: { position: 'absolute', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#0c0a09' : '#fafaf9' },

    refTitle: { fontFamily: font.bold, fontSize: 20, color: t.text, textAlign: 'center', marginTop: 4 },
    refSub: { fontFamily: font.regular, fontSize: 13, color: subText, textAlign: 'center', marginTop: 4, marginBottom: 18, paddingHorizontal: 20 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    codeBox: { flex: 1, backgroundColor: surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: border },
    codeLabel: { fontFamily: font.regular, fontSize: 11, color: subText },
    codeText: { fontFamily: font.extrabold, fontSize: 18, color: t.text, letterSpacing: 2, marginTop: 2 },
    codeCopy: { width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,77,28,0.14)' : '#FFF0EB', alignItems: 'center', justifyContent: 'center' },
    codeShare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: BRAND },
    codeShareText: { fontFamily: font.bold, fontSize: 14, color: '#fff' },
  })
}
