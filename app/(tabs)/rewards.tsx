import { useState, useCallback } from 'react'
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
  Medal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Lock,
} from 'lucide-react-native'
import { useRouter, type Href } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard, useAllBadges, usePointsHistory } from '@/lib/hooks/useRewards'
import { LEVELS, LEVEL_ORDER, calculateProgress } from '@/lib/constants/rewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { ReferralCard } from '@/components/ReferralCard'
import { timeAgo } from '@/lib/utils/time'
import type { Badge, EarnedBadge } from '@/lib/types'

const LEVEL_LIST = LEVEL_ORDER.map((slug) => LEVELS[slug])

type TabKey = 'badges' | 'history' | 'top'

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

  const [activeTab, setActiveTab] = useState<TabKey>('badges')
  const [showEarnInfo, setShowEarnInfo] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchLeaderboard()])
    setRefreshing(false)
  }, [refreshProfile, refetchLeaderboard])

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

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.amber500}
            colors={[c.amber500]}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4 }}>
            <ChevronLeft size={24} color={t.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Rewards</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Profile Card */}
        <View style={s.section}>
          <View style={s.profileCard}>
            <View style={s.profileRow}>
              <View style={s.levelCircle}>
                <Text style={s.levelEmoji}>{levelInfo.emoji}</Text>
              </View>
              <View style={s.profileInfo}>
                <Text style={s.levelName}>{levelInfo.name}</Text>
                <Text style={s.levelPoints}>{points} total points</Text>
              </View>
            </View>

            {/* Progress bar */}
            {nextLevel && (
              <View style={{ marginTop: 16 }}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>Progress to {nextLevel.name}</Text>
                  <Text style={s.progressValue}>
                    {points}/{nextLevel.min_points}
                  </Text>
                </View>
                <View style={s.progressBarBg}>
                  <View style={[s.progressBarFill, { width: `${progressToNext}%` }]} />
                </View>
              </View>
            )}

            {/* Inline stats row */}
            <View style={s.inlineStats}>
              <TouchableOpacity
                onPress={() => setActiveTab('history')}
                activeOpacity={0.7}
                style={s.inlineStat}
              >
                <Flame size={14} color="#ef4444" />
                <Text style={s.inlineStatValue}>{streak}</Text>
                <Text style={s.inlineStatLabel}>Streak</Text>
              </TouchableOpacity>
              <View style={s.inlineStatDivider} />
              <TouchableOpacity
                onPress={() => setActiveTab('history')}
                activeOpacity={0.7}
                style={s.inlineStat}
              >
                <Target size={14} color={c.violet500} />
                <Text style={s.inlineStatValue}>{totalReports}</Text>
                <Text style={s.inlineStatLabel}>Reports</Text>
              </TouchableOpacity>
              <View style={s.inlineStatDivider} />
              <TouchableOpacity
                onPress={() => setActiveTab('top')}
                activeOpacity={0.7}
                style={s.inlineStat}
              >
                <Medal size={14} color={c.emerald500} />
                <Text style={s.inlineStatValue}>#{userRank}</Text>
                <Text style={s.inlineStatLabel}>Rank</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Referral Card */}
        <ReferralCard />

        {/* Tabs */}
        <View style={s.section}>
          <View style={s.tabRow}>
            {([
              { key: 'badges' as TabKey, label: `Badges (${earnedCount}/${totalBadgeCount})` },
              { key: 'history' as TabKey, label: 'History' },
              { key: 'top' as TabKey, label: 'Top' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                style={[s.tab, activeTab === tab.key && s.tabActive]}
              >
                <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={s.tabContent}>
            {activeTab === 'badges' && (
              <View>
                <Text style={s.tabContentTitle}>Badge Collection</Text>
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
                          <View style={[s.badgeIcon, { backgroundColor: earned ? `${badgeColor}20` : isDark ? c.stone800 : c.stone200 }]}>
                            {earned ? (
                              <Star size={20} color={badgeColor} />
                            ) : (
                              <Lock size={16} color={t.textTertiary} />
                            )}
                          </View>
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

            {activeTab === 'history' && (
              <View>
                <Text style={s.tabContentTitle}>Recent Activity</Text>
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

            {activeTab === 'top' && (
              <View>
                <View style={s.sectionTitleRow}>
                  <Text style={s.tabContentTitle}>Weekly Top Contributors</Text>
                  <TouchableOpacity onPress={() => router.push('/leaderboard' as Href)} style={s.seeAllBtn}>
                    <Text style={s.seeAllText}>See all</Text>
                    <ChevronRight size={16} color={c.amber500} />
                  </TouchableOpacity>
                </View>
                {leaderboard.length === 0 ? (
                  <View style={s.emptyState}>
                    <TrendingUp size={32} color={t.textTertiary} />
                    <Text style={s.emptyText}>No activity this week</Text>
                  </View>
                ) : (
                  <View>
                    {/* Podium */}
                    <View style={s.podiumRow}>
                      {/* 2nd Place */}
                      <View style={s.podiumItem}>
                        <View style={[s.podiumAvatar, { backgroundColor: c.stone300 }]}>
                          <Text style={s.podiumEmojiMd}>🥈</Text>
                        </View>
                        <View style={[s.podiumBar, s.podiumBar2nd]}>
                          <Text style={s.podiumBarText}>
                            {leaderboard[1]?.display_name?.split(' ')[0] ?? '--'}
                          </Text>
                        </View>
                      </View>
                      {/* 1st Place */}
                      <View style={s.podiumItem}>
                        <View style={[s.podiumAvatarLg, { backgroundColor: c.amber400 }]}>
                          <Text style={s.podiumEmojiLg}>🥇</Text>
                        </View>
                        <View style={[s.podiumBar, s.podiumBar1st]}>
                          <Text style={s.podiumBarTextWhite}>
                            {leaderboard[0]?.display_name?.split(' ')[0] ?? '--'}
                          </Text>
                        </View>
                      </View>
                      {/* 3rd Place */}
                      <View style={s.podiumItem}>
                        <View style={[s.podiumAvatar, { backgroundColor: c.amber700 }]}>
                          <Text style={s.podiumEmojiMd}>🥉</Text>
                        </View>
                        <View style={[s.podiumBar, s.podiumBar3rd]}>
                          <Text style={s.podiumBarText3rd}>
                            {leaderboard[2]?.display_name?.split(' ')[0] ?? '--'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* List below podium */}
                    {leaderboard.slice(3, 10).map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          s.leaderboardRow,
                          entry.device_id === deviceId && s.leaderboardRowHighlight,
                        ]}
                      >
                        <View style={s.leaderboardRank}>
                          <Text style={s.leaderboardRankText}>{entry.rank}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.leaderboardName} numberOfLines={1}>
                            {entry.display_name}
                            {entry.device_id === deviceId ? ' (You)' : ''}
                          </Text>
                          <Text style={s.leaderboardMeta}>{entry.badge_count} badges</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.leaderboardPts}>{entry.weekly_points} pts</Text>
                          <Text style={s.leaderboardMeta}>this week</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* How to Earn — collapsible */}
        <View style={[s.section, { marginBottom: 32 }]}>
          <TouchableOpacity
            onPress={() => setShowEarnInfo(!showEarnInfo)}
            activeOpacity={0.7}
            style={s.earnToggle}
          >
            <Star size={16} color={c.amber500} />
            <Text style={s.earnToggleText}>How to Earn Points</Text>
            {showEarnInfo ? (
              <ChevronUp size={18} color={t.textSecondary} />
            ) : (
              <ChevronDown size={18} color={t.textSecondary} />
            )}
          </TouchableOpacity>

          {showEarnInfo && (
            <View style={s.earnCard}>
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
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },

    // Profile card
    profileCard: { padding: 20, borderRadius: 24, backgroundColor: t.card },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    levelCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelEmoji: { fontSize: 28 },
    profileInfo: { marginLeft: 16, flex: 1 },
    levelName: { fontSize: 20, fontFamily: font.bold, color: t.text },
    levelPoints: { fontSize: 14, color: t.textSecondary },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 12, color: t.textSecondary },
    progressValue: { fontSize: 12, fontFamily: font.medium, color: isDark ? c.stone300 : c.stone600 },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: isDark ? c.stone800 : c.stone200,
    },
    progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: c.amber500 },

    // Inline stats
    inlineStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? c.stone800 : c.stone200,
    },
    inlineStat: { flex: 1, alignItems: 'center', gap: 2 },
    inlineStatValue: { fontSize: 18, fontFamily: font.bold, color: t.text, marginTop: 2 },
    inlineStatLabel: { fontSize: 11, fontFamily: font.medium, color: t.textSecondary },
    inlineStatDivider: { width: 1, height: 32, backgroundColor: isDark ? c.stone800 : c.stone200 },

    // Tabs
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: t.card,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: c.amber500 },
    tabText: { fontSize: 13, fontFamily: font.medium, color: isDark ? c.stone400 : c.stone600 },
    tabTextActive: { color: c.white, fontFamily: font.semibold },
    tabContent: { padding: 16, borderRadius: 20, backgroundColor: t.card },
    tabContentTitle: { fontSize: 16, fontFamily: font.semibold, color: t.text, marginBottom: 14 },

    // Badges
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeItem: {
      width: '30%',
      alignItems: 'center',
      padding: 10,
      borderRadius: 14,
      backgroundColor: isDark ? c.stone800 : c.stone100,
    },
    badgeItemLocked: { opacity: 0.5 },
    badgeIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    badgeName: { fontSize: 12, fontFamily: font.semibold, color: t.text, textAlign: 'center' },
    badgeDesc: { fontSize: 10, color: t.textSecondary, textAlign: 'center', marginTop: 2 },
    badgeBonus: { fontSize: 10, fontFamily: font.semibold, marginTop: 4 },

    // History
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

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: t.textSecondary, marginTop: 8 },
    emptySubText: { fontSize: 12, color: t.textTertiary, marginTop: 4 },

    // Leaderboard
    seeAllBtn: { flexDirection: 'row', alignItems: 'center' },
    seeAllText: { color: c.amber500, fontSize: 14, fontFamily: font.medium },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingVertical: 16,
    },
    podiumItem: { alignItems: 'center', marginHorizontal: 8 },
    podiumAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    podiumAvatarLg: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    podiumEmojiMd: { fontSize: 20 },
    podiumEmojiLg: { fontSize: 24 },
    podiumBar: {
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    podiumBar1st: { height: 112, backgroundColor: c.amber500 },
    podiumBar2nd: { height: 80, backgroundColor: isDark ? c.stone700 : c.stone200 },
    podiumBar3rd: {
      height: 64,
      backgroundColor: isDark ? 'rgba(120, 53, 15, 0.5)' : c.amber100,
    },
    podiumBarText: { fontSize: 12, fontFamily: font.medium, color: isDark ? c.stone300 : c.stone600 },
    podiumBarTextWhite: { fontSize: 12, fontFamily: font.medium, color: c.white },
    podiumBarText3rd: { fontSize: 12, fontFamily: font.medium, color: isDark ? c.amber400 : c.amber700 },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
      gap: 10,
    },
    leaderboardRowHighlight: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : c.amber100,
    },
    leaderboardRank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? c.stone700 : c.stone200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderboardRankText: { fontSize: 13, fontFamily: font.bold, color: isDark ? c.stone300 : c.stone600 },
    leaderboardName: { fontSize: 14, fontFamily: font.medium, color: t.text },
    leaderboardMeta: { fontSize: 12, color: t.textSecondary, marginTop: 1 },
    leaderboardPts: { fontSize: 14, fontFamily: font.semibold, color: c.amber500 },

    // How to earn — collapsible
    earnToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      padding: 14,
      borderRadius: 16,
      gap: 8,
    },
    earnToggleText: { flex: 1, fontSize: 15, fontFamily: font.semibold, color: t.text },
    earnCard: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      backgroundColor: t.card,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      marginTop: -8,
    },
    earnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    earnRowBorder: { borderBottomWidth: 1, borderBottomColor: isDark ? c.stone800 : c.stone200 },
    earnAction: { fontSize: 14, color: isDark ? c.stone300 : c.stone700 },
    earnPoints: { fontSize: 14, color: c.amber500, fontFamily: font.semibold },
  })
}
