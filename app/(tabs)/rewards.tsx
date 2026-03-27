import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react-native'
import { useRouter, type Href } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard } from '@/lib/hooks/useRewards'
import { LEVELS } from '@/lib/constants/rewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { ReferralCard } from '@/components/ReferralCard'
import type { LeaderboardEntry } from '@/lib/types'

/* ── Constants ──────────────────────────────────────── */

const MAROON = {
  bg: '#6B1D1D',
  card: '#7F2828',
  cardLight: '#923232',
  dark: '#4A1212',
}

const PODIUM_RING: Record<number, string> = {
  1: '#4ADE80',
  2: '#A78BFA',
  3: '#FBBF24',
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
      <Text style={{ fontSize: isFirst ? 24 : 18, marginBottom: -4 }}>
        {RANK_CROWN[rank] ?? ''}
      </Text>

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
  const s = getStyles(isDark)
  const { rank, deviceId, refreshProfile } = useApp()
  const { entries: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['leaderboard', deviceId]])

  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [showEarnInfo, setShowEarnInfo] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchLeaderboard()])
    setRefreshing(false)
  }, [refreshProfile, refetchLeaderboard])

  const sortedBoard = useMemo(() => {
    if (period === 'all') {
      return [...leaderboard].sort((a, b) => b.total_points - a.total_points)
    }
    return leaderboard
  }, [leaderboard, period])

  const userRank = rank ?? '--'
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
          <View style={[s.heroDecor, { top: -40, right: -30, width: 160, height: 160 }]} />
          <View style={[s.heroDecor, { bottom: 40, left: -50, width: 120, height: 120 }]} />

          <View style={s.rankBadge}>
            <Text style={s.rankNumber}>{userRank}</Text>
          </View>

          <Text style={s.heroTitle}>Top Contributors</Text>

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
                  <View style={[s.rankedAvatar, { borderColor: avatarColor }]}>
                    <Text style={{ fontSize: 16 }}>{emoji}</Text>
                  </View>
                  <Text style={s.rankedName} numberOfLines={1}>
                    {entry.display_name?.toUpperCase() ?? 'ANONYMOUS'}
                    {isMe ? ' (YOU)' : ''}
                  </Text>
                  <Text style={s.rankedPts}>
                    {formatPts(entry[pointsKey])}
                  </Text>
                </View>
              )
            })}

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

        {/* ═══ Invite Friends ═══ */}
        <ReferralCard />

        {/* ═══ How to Earn Points — M3 Card ═══ */}
        <View style={s.section}>
          <TouchableOpacity
            onPress={() => setShowEarnInfo(!showEarnInfo)}
            activeOpacity={0.7}
            style={s.earnHeader}
          >
            <View style={s.earnIconWrap}>
              <TrendingUp size={20} color={isDark ? c.amber400 : c.amber600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.earnTitle}>Earn Points</Text>
              <Text style={s.earnSubtitle}>Report fares, queues & more</Text>
            </View>
            {showEarnInfo ? (
              <ChevronUp size={20} color={isDark ? c.stone400 : c.stone500} />
            ) : (
              <ChevronDown size={20} color={isDark ? c.stone400 : c.stone500} />
            )}
          </TouchableOpacity>

          {showEarnInfo && (
            <View style={s.earnBody}>
              {[
                { action: 'Report a fare', points: '+10', icon: '🚐' },
                { action: 'Report queue status', points: '+5', icon: '🕐' },
                { action: 'Report incident', points: '+15', icon: '⚠️' },
                { action: 'Report train', points: '+10', icon: '🚆' },
                { action: 'Share a tale', points: '+8', icon: '📸' },
                { action: '7-day streak bonus', points: '+5', icon: '🔥' },
              ].map((item, index, arr) => (
                <View
                  key={index}
                  style={[s.earnRow, index < arr.length - 1 && s.earnRowBorder]}
                >
                  <Text style={s.earnEmoji}>{item.icon}</Text>
                  <Text style={s.earnAction}>{item.action}</Text>
                  <View style={s.earnPointsPill}>
                    <Zap size={12} color={c.amber500} />
                    <Text style={s.earnPointsText}>{item.points}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

/* ── Styles ──────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)

  const surfaceContainer = isDark ? '#211F26' : '#F3EDF7'
  const outlineVariant = isDark ? '#49454F' : '#CAC4D0'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    section: { paddingHorizontal: 20, marginBottom: 16 },

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

    /* ═══ Earn Points — M3 ═══ */
    earnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      borderRadius: 24,
      backgroundColor: surfaceContainer,
      borderWidth: 1,
      borderColor: outlineVariant,
      gap: 14,
    },
    earnIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    earnTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
      letterSpacing: 0.15,
    },
    earnSubtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },
    earnBody: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      backgroundColor: surfaceContainer,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      marginTop: -12,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: outlineVariant,
    },
    earnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    earnRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: outlineVariant,
    },
    earnEmoji: {
      fontSize: 20,
      width: 28,
      textAlign: 'center',
    },
    earnAction: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.medium,
      color: t.text,
    },
    earnPointsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
    },
    earnPointsText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: c.amber500,
    },
  })
}
