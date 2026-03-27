import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Star,
  Flame,
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Lock,
  Zap,
  Trophy,
} from 'lucide-react-native'
import { useRouter, type Href } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import { ContributorBadge, getContributorTier } from '@/components/ContributorBadge'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard, useAllBadges, usePointsHistory } from '@/lib/hooks/useRewards'
import { LEVELS, LEVEL_ORDER, calculateProgress } from '@/lib/constants/rewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { ReferralCard } from '@/components/ReferralCard'
import { timeAgo } from '@/lib/utils/time'
import type { Badge, EarnedBadge, LeaderboardEntry } from '@/lib/types'

/* ── Constants ──────────────────────────────────────── */

const LEVEL_LIST = LEVEL_ORDER.map((slug) => LEVELS[slug])

const MAROON = {
  bg: '#6B1D1D',
  card: '#7F2828',
  cardLight: '#923232',
  dark: '#4A1212',
  ring: 'rgba(255,255,255,0.12)',
}

const PODIUM_RING: Record<number, string> = {
  1: '#4ADE80', // green
  2: '#A78BFA', // purple
  3: '#FBBF24', // amber
}

const RANK_CROWN: Record<number, string> = {
  1: '💎',
  2: '💚',
  3: '👑',
}

const AVATAR_COLORS = [
  '#059669', '#7C3AED', '#EA580C', '#0891B2',
  '#D946EF', '#2563EB', '#DC2626', '#0D9488',
]

const BADGE_COLORS: Record<string, string> = {
  amber: '#f59e0b',
  emerald: '#10b981',
  violet: '#8b5cf6',
  orange: '#f97316',
  blue: '#3b82f6',
  red: '#ef4444',
  pink: '#ec4899',
}

const REASON_LABELS: Record<string, string> = {
  fare_report: 'Fare Report',
  queue_report: 'Queue Report',
  incident_report: 'Incident Report',
  train_report: 'Train Report',
  tale_report: 'Tale Shared',
  badge_bonus: 'Badge Bonus',
  streak_bonus: 'Streak Bonus',
  referral_bonus: 'Referral Bonus',
}

/* ── Diamond Badge Icon ─────────────────────────────── */

function DiamondIcon({ color, earned, children, isDark }: {
  color: string
  earned: boolean
  children: React.ReactNode
  isDark: boolean
}) {
  return (
    <View style={{
      width: 48,
      height: 48,
      transform: [{ rotate: '45deg' }],
      borderRadius: 14,
      backgroundColor: earned ? `${color}20` : isDark ? c.stone800 : c.stone200,
      borderWidth: earned ? 2 : 1,
      borderColor: earned ? `${color}40` : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    }}>
      <View style={{ transform: [{ rotate: '-45deg' }] }}>
        {children}
      </View>
    </View>
  )
}

/* ── Podium Avatar ──────────────────────────────────── */

function PodiumAvatar({ entry, rank, isFirst }: {
  entry?: LeaderboardEntry
  rank: number
  isFirst?: boolean
}) {
  const size = isFirst ? 80 : 64
  const emojiSize = isFirst ? 30 : 22
  const ringColor = PODIUM_RING[rank] ?? c.stone400
  const levelSlug = entry?.current_level ?? 'passenger'
  const levelEmoji = LEVELS[levelSlug as keyof typeof LEVELS]?.emoji ?? '🚶'

  return (
    <View style={{ alignItems: 'center', width: isFirst ? 120 : 100 }}>
      {/* Crown/gem above avatar */}
      <Text style={{ fontSize: isFirst ? 24 : 18, marginBottom: -4 }}>
        {RANK_CROWN[rank] ?? ''}
      </Text>

      {/* Avatar circle with ring */}
      <View style={{
        width: size + 8,
        height: size + 8,
        borderRadius: (size + 8) / 2,
        borderWidth: 3,
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
      }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: MAROON.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: emojiSize }}>{levelEmoji}</Text>
        </View>
      </View>

      {/* Rank pill */}
      <View style={{
        position: 'absolute',
        bottom: isFirst ? 46 : 40,
        backgroundColor: ringColor,
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 10,
        zIndex: 1,
      }}>
        <Text style={{
          fontSize: 11,
          fontFamily: font.bold,
          color: rank === 3 ? '#78350F' : '#fff',
        }}>
          {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
        </Text>
      </View>

      {/* Name */}
      <Text
        style={{
          fontSize: isFirst ? 13 : 11,
          fontFamily: font.bold,
          color: '#fff',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
        numberOfLines={2}
      >
        {entry?.display_name ?? '--'}
      </Text>

      {/* Points */}
      <Text style={{
        fontSize: isFirst ? 16 : 13,
        fontFamily: font.semibold,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
      }}>
        {entry ? formatPts(entry.weekly_points) : '--'}
      </Text>
    </View>
  )
}

/* ── Helpers ─────────────────────────────────────────── */

function formatPts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

/* ── Main Screen ─────────────────────────────────────── */

export default function RewardsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { profile, badges: earnedBadges, rank, deviceId, refreshProfile } = useApp()
  const { entries: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(deviceId)
  const { badges: allBadges } = useAllBadges()
  const { entries: history, isLoading: historyLoading } = usePointsHistory(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['leaderboard', deviceId], ['badges'], ['history', deviceId]])

  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [showBadges, setShowBadges] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showEarnInfo, setShowEarnInfo] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchLeaderboard()])
    setRefreshing(false)
  }, [refreshProfile, refetchLeaderboard])

  // Sort leaderboard by period
  const sortedBoard = useMemo(() => {
    if (period === 'all') {
      return [...leaderboard].sort((a, b) => b.total_points - a.total_points)
    }
    return leaderboard // already sorted by weekly
  }, [leaderboard, period])

  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']
  const progress = calculateProgress(profile?.total_points ?? 0, profile?.current_level ?? 'passenger')
  const nextLevel = progress ? LEVEL_LIST.find((l) => l.min_points > (profile?.total_points ?? 0)) : null

  const points = profile?.total_points ?? 0
  const streak = profile?.current_streak ?? 0
  const totalReports = profile?.total_reports ?? 0
  const userRank = rank ?? '--'
  const progressToNext = progress?.progressPercent ?? 100
  const earnedBadgeIds = new Set((earnedBadges || []).map((b: EarnedBadge) => b.id))
  const earnedCount = earnedBadgeIds.size
  const totalBadgeCount = allBadges.length
  const contributorTier = getContributorTier(totalReports)
  const pointsKey = period === 'all' ? 'total_points' : 'weekly_points'

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.white}
            colors={[c.amber500]}
          />
        }
      >
        {/* ═══ MAROON HERO — Leaderboard ═══ */}
        <View style={s.hero}>
          {/* Decorative circles */}
          <View style={[s.heroDecor, { top: -40, right: -30, width: 160, height: 160 }]} />
          <View style={[s.heroDecor, { bottom: 40, left: -50, width: 120, height: 120 }]} />

          {/* User rank badge */}
          <View style={s.rankBadge}>
            <Text style={s.rankNumber}>{userRank}</Text>
          </View>

          <Text style={s.heroTitle}>Top Contributors</Text>

          {/* Period tabs */}
          <View style={s.periodRow}>
            <TouchableOpacity
              onPress={() => setPeriod('week')}
              activeOpacity={0.7}
              style={[s.periodTab, period === 'week' && s.periodTabActive]}
            >
              <Text style={[s.periodText, period === 'week' && s.periodTextActive]}>
                THIS WEEK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPeriod('all')}
              activeOpacity={0.7}
              style={[s.periodTab, period === 'all' && s.periodTabActive]}
            >
              <Text style={[s.periodText, period === 'all' && s.periodTextActive]}>
                ALL TIME
              </Text>
            </TouchableOpacity>
          </View>

          {/* Podium — 2nd / 1st / 3rd */}
          {sortedBoard.length > 0 ? (
            <View style={s.podiumRow}>
              <View style={{ marginTop: 24 }}>
                <PodiumAvatar entry={sortedBoard[1]} rank={2} />
              </View>
              <PodiumAvatar entry={sortedBoard[0]} rank={1} isFirst />
              <View style={{ marginTop: 24 }}>
                <PodiumAvatar entry={sortedBoard[2]} rank={3} />
              </View>
            </View>
          ) : (
            <View style={s.emptyPodium}>
              <Trophy size={40} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyPodiumText}>No contributors yet this week</Text>
            </View>
          )}
        </View>

        {/* ═══ Ranked List (4–10) ═══ */}
        {sortedBoard.length > 3 && (
          <View style={s.rankedSection}>
            {sortedBoard.slice(3, 10).map((entry, i) => {
              const isMe = entry.device_id === deviceId
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const levelSlug = entry.current_level ?? 'passenger'
              const emoji = LEVELS[levelSlug as keyof typeof LEVELS]?.emoji ?? '🚶'

              return (
                <View
                  key={entry.id}
                  style={[s.rankedRow, isMe && s.rankedRowMe]}
                >
                  <Text style={s.rankedRankNum}>{entry.rank}</Text>

                  {/* Avatar */}
                  <View style={[s.rankedAvatar, { borderColor: avatarColor }]}>
                    <Text style={{ fontSize: 16 }}>{emoji}</Text>
                  </View>

                  {/* Name */}
                  <Text style={s.rankedName} numberOfLines={1}>
                    {entry.display_name?.toUpperCase() ?? 'ANONYMOUS'}
                    {isMe ? ' (YOU)' : ''}
                  </Text>

                  {/* Points */}
                  <Text style={s.rankedPts}>
                    {formatPts(entry[pointsKey])}
                  </Text>
                </View>
              )
            })}

            {/* See all link */}
            <TouchableOpacity
              onPress={() => router.push('/leaderboard' as Href)}
              activeOpacity={0.7}
              style={s.seeAllRow}
            >
              <Text style={s.seeAllText}>See full leaderboard</Text>
              <ChevronRight size={16} color={c.amber500} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ CTA Card ═══ */}
        <View style={s.ctaCard}>
          <View style={s.ctaIconWrap}>
            <Zap size={24} color={c.amber500} />
          </View>
          <Text style={s.ctaText}>
            Use GO on your next trip and start climbing the ranks.
          </Text>
        </View>

        {/* ═══ Your Progress ═══ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Progress</Text>
          <View style={s.progressCard}>
            {/* Level row */}
            <View style={s.progressLevelRow}>
              <View style={[s.progressBadge, { backgroundColor: `${levelInfo.color}20` }]}>
                <Text style={{ fontSize: 24 }}>{levelInfo.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.progressLevelName}>{levelInfo.name}</Text>
                  {contributorTier && <ContributorBadge tier={contributorTier} />}
                </View>
                {nextLevel && (
                  <>
                    <View style={s.progressBarBg}>
                      <View style={[s.progressBarFill, {
                        width: `${progressToNext}%`,
                        backgroundColor: levelInfo.color,
                      }]} />
                    </View>
                    <Text style={s.progressBarLabel}>
                      {progress?.pointsNeeded ?? 0} pts to {nextLevel.name}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Stats mini row */}
            <View style={s.miniStatsRow}>
              <View style={s.miniStat}>
                <Zap size={14} color={c.amber500} />
                <Text style={s.miniStatValue}>{points}</Text>
                <Text style={s.miniStatLabel}>Points</Text>
              </View>
              <View style={s.miniStatDivider} />
              <View style={s.miniStat}>
                <Flame size={14} color="#ef4444" />
                <Text style={s.miniStatValue}>{streak}</Text>
                <Text style={s.miniStatLabel}>Streak</Text>
              </View>
              <View style={s.miniStatDivider} />
              <View style={s.miniStat}>
                <Target size={14} color={c.violet500} />
                <Text style={s.miniStatValue}>{totalReports}</Text>
                <Text style={s.miniStatLabel}>Reports</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ Referral Card ═══ */}
        <ReferralCard />

        {/* ═══ Badges — Collapsible ═══ */}
        <View style={s.section}>
          <TouchableOpacity
            onPress={() => setShowBadges(!showBadges)}
            activeOpacity={0.7}
            style={s.collapsibleHeader}
          >
            <Star size={18} color={c.amber500} />
            <Text style={s.collapsibleTitle}>
              Badges ({earnedCount}/{totalBadgeCount})
            </Text>
            <View style={{ flex: 1 }} />
            {showBadges ? (
              <ChevronUp size={18} color={t.textSecondary} />
            ) : (
              <ChevronDown size={18} color={t.textSecondary} />
            )}
          </TouchableOpacity>

          {showBadges && (
            <View style={s.collapsibleBody}>
              {allBadges.length === 0 ? (
                <View style={s.emptyState}>
                  <Star size={32} color={t.textTertiary} />
                  <Text style={s.emptyText}>No badges available yet</Text>
                </View>
              ) : (
                <View style={s.badgeGrid}>
                  {allBadges.map((badge: Badge) => {
                    const earned = earnedBadgeIds.has(badge.id)
                    const badgeColor = BADGE_COLORS[badge.color] ?? c.amber500
                    return (
                      <View key={badge.id} style={[s.badgeItem, !earned && s.badgeItemLocked]}>
                        <DiamondIcon color={badgeColor} earned={earned} isDark={isDark}>
                          {earned ? (
                            <Star size={20} color={badgeColor} />
                          ) : (
                            <Lock size={16} color={t.textTertiary} />
                          )}
                        </DiamondIcon>
                        <Text style={[s.badgeName, !earned && { color: t.textTertiary }]} numberOfLines={1}>
                          {badge.name}
                        </Text>
                        <Text style={s.badgeDesc} numberOfLines={2}>
                          {badge.description}
                        </Text>
                        {badge.points_bonus > 0 && (
                          <Text style={[s.badgeBonus, { color: earned ? c.amber500 : t.textTertiary }]}>
                            +{badge.points_bonus} pts
                          </Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ═══ History — Collapsible ═══ */}
        <View style={s.section}>
          <TouchableOpacity
            onPress={() => setShowHistory(!showHistory)}
            activeOpacity={0.7}
            style={s.collapsibleHeader}
          >
            <Clock size={18} color={c.amber500} />
            <Text style={s.collapsibleTitle}>Recent Activity</Text>
            <View style={{ flex: 1 }} />
            {showHistory ? (
              <ChevronUp size={18} color={t.textSecondary} />
            ) : (
              <ChevronDown size={18} color={t.textSecondary} />
            )}
          </TouchableOpacity>

          {showHistory && (
            <View style={s.collapsibleBody}>
              {historyLoading ? (
                <ActivityIndicator size="small" color={c.amber500} style={{ marginVertical: 32 }} />
              ) : history.length === 0 ? (
                <View style={s.emptyState}>
                  <Clock size={32} color={t.textTertiary} />
                  <Text style={s.emptyText}>No activity yet</Text>
                  <Text style={s.emptySubText}>Submit reports to earn points!</Text>
                </View>
              ) : (
                <View>
                  {history.map((entry, index) => (
                    <View
                      key={entry.id}
                      style={[s.historyRow, index < history.length - 1 && s.historyRowBorder]}
                    >
                      <View style={s.historyIcon}>
                        <Star size={16} color={c.amber500} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyReason}>
                          {REASON_LABELS[entry.reason] ?? entry.reason}
                        </Text>
                        <Text style={s.historyTime}>{timeAgo(entry.created_at)}</Text>
                      </View>
                      <Text style={s.historyPoints}>+{entry.points}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ═══ How to Earn — Collapsible ═══ */}
        <View style={[s.section, { marginBottom: 32 }]}>
          <TouchableOpacity
            onPress={() => setShowEarnInfo(!showEarnInfo)}
            activeOpacity={0.7}
            style={s.collapsibleHeader}
          >
            <TrendingUp size={18} color={c.amber500} />
            <Text style={s.collapsibleTitle}>How to Earn Points</Text>
            <View style={{ flex: 1 }} />
            {showEarnInfo ? (
              <ChevronUp size={18} color={t.textSecondary} />
            ) : (
              <ChevronDown size={18} color={t.textSecondary} />
            )}
          </TouchableOpacity>

          {showEarnInfo && (
            <View style={s.collapsibleBody}>
              {[
                { action: 'Report a fare', points: '+10' },
                { action: 'Report queue status', points: '+5' },
                { action: 'Report incident', points: '+15' },
                { action: 'Report train', points: '+10' },
                { action: 'Share a tale', points: '+8' },
                { action: '7-day streak bonus', points: '+5' },
              ].map((item, index, arr) => (
                <View
                  key={index}
                  style={[s.earnRow, index < arr.length - 1 && s.earnRowBorder]}
                >
                  <Text style={s.earnAction}>{item.action}</Text>
                  <Text style={s.earnPoints}>{item.points}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

/* ── Styles ──────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    section: { paddingHorizontal: 20, marginBottom: 16 },
    sectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
      marginBottom: 12,
    },

    /* ═══ MAROON HERO ═══ */
    hero: {
      backgroundColor: MAROON.bg,
      paddingTop: 20,
      paddingBottom: 28,
      paddingHorizontal: 20,
      overflow: 'hidden',
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      marginBottom: 4,
    },
    heroDecor: {
      position: 'absolute',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    rankBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: MAROON.card,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.2)',
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    rankNumber: {
      fontSize: 28,
      fontFamily: font.bold,
      color: '#fff',
    },
    heroTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: '#fff',
      textAlign: 'center',
      marginBottom: 16,
    },

    /* Period tabs */
    periodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginBottom: 20,
    },
    periodTab: {
      paddingBottom: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    periodTabActive: {
      borderBottomColor: '#fff',
    },
    periodText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.5)',
      letterSpacing: 1,
    },
    periodTextActive: {
      color: '#fff',
    },

    /* Podium */
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 4,
      paddingTop: 4,
    },
    emptyPodium: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyPodiumText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 14,
      fontFamily: font.medium,
      marginTop: 12,
    },

    /* ═══ Ranked List ═══ */
    rankedSection: {
      backgroundColor: isDark ? MAROON.dark : '#F5E6E6',
      marginHorizontal: 16,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 16,
    },
    rankedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    rankedRowMe: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      borderRadius: 14,
    },
    rankedRankNum: {
      width: 24,
      fontSize: 15,
      fontFamily: font.bold,
      color: isDark ? 'rgba(255,255,255,0.6)' : MAROON.bg,
      textAlign: 'center',
    },
    rankedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2.5,
      backgroundColor: isDark ? MAROON.card : '#E8D0D0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankedName: {
      flex: 1,
      fontSize: 14,
      fontFamily: font.bold,
      color: isDark ? '#fff' : MAROON.bg,
      letterSpacing: 0.3,
    },
    rankedPts: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: isDark ? 'rgba(255,255,255,0.7)' : MAROON.cardLight,
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 4,
    },
    seeAllText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: c.amber500,
    },

    /* ═══ CTA Card ═══ */
    ctaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : c.amber50,
      gap: 12,
    },
    ctaIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : c.amber100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      flex: 1,
      fontSize: 14,
      fontFamily: font.medium,
      color: isDark ? c.amber100 : c.amber900,
      lineHeight: 20,
    },

    /* ═══ Your Progress ═══ */
    progressCard: {
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
    },
    progressLevelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    progressBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressLevelName: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    progressBarBg: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? c.stone700 : c.stone200,
      overflow: 'hidden',
      marginTop: 8,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressBarLabel: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textSecondary,
      marginTop: 4,
    },
    miniStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: isDark ? c.stone800 : c.stone100,
      paddingTop: 14,
    },
    miniStat: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    miniStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: isDark ? c.stone700 : c.stone200,
    },
    miniStatValue: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    miniStatLabel: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textSecondary,
    },

    /* ═══ Collapsible sections ═══ */
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      padding: 14,
      borderRadius: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    collapsibleTitle: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: t.text,
    },
    collapsibleBody: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.card,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      marginTop: -8,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: t.border,
    },

    /* ═══ Badges ═══ */
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeItem: {
      width: '30%',
      alignItems: 'center',
      padding: 10,
      borderRadius: 14,
      backgroundColor: isDark ? c.stone800 : c.stone100,
    },
    badgeItemLocked: { opacity: 0.5 },
    badgeName: { fontSize: 12, fontFamily: font.semibold, color: t.text, textAlign: 'center' },
    badgeDesc: { fontSize: 10, color: t.textSecondary, textAlign: 'center', marginTop: 2 },
    badgeBonus: { fontSize: 10, fontFamily: font.semibold, marginTop: 4 },

    /* ═══ History ═══ */
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    historyRowBorder: { borderBottomWidth: 1, borderBottomColor: isDark ? c.stone800 : c.stone100 },
    historyIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : c.amber100,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    historyReason: { fontSize: 14, fontFamily: font.medium, color: t.text },
    historyTime: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    historyPoints: { fontSize: 14, fontFamily: font.semibold, color: c.amber500 },

    /* ═══ Empty state ═══ */
    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: t.textSecondary, marginTop: 8 },
    emptySubText: { fontSize: 12, color: t.textTertiary, marginTop: 4 },

    /* ═══ How to earn ═══ */
    earnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    earnRowBorder: { borderBottomWidth: 1, borderBottomColor: isDark ? c.stone800 : c.stone200 },
    earnAction: { fontSize: 14, color: isDark ? c.stone300 : c.stone700 },
    earnPoints: { fontSize: 14, color: c.amber500, fontFamily: font.semibold },
  })
}
