import { useState } from 'react'
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
import { Star, Flame, Target, Medal, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard } from '@/lib/hooks/useRewards'
import { LEVELS, LEVEL_ORDER, calculateProgress } from '@/lib/constants/rewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'

const LEVEL_LIST = LEVEL_ORDER.map((slug) => LEVELS[slug])

export default function RewardsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { profile, rank, deviceId, refreshProfile } = useApp()
  const { entries: leaderboard, refetch: refetchLeaderboard } = useLeaderboard(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['leaderboard', deviceId]])
  const [showEarnInfo, setShowEarnInfo] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchLeaderboard()])
    setRefreshing(false)
  }

  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']
  const progress = calculateProgress(profile?.total_points ?? 0, profile?.current_level ?? 'passenger')
  const nextLevel = progress ? LEVEL_LIST.find((l) => l.min_points > (profile?.total_points ?? 0)) : null

  const points = profile?.total_points ?? 0
  const streak = profile?.current_streak ?? 0
  const totalReports = profile?.total_reports ?? 0
  const userRank = rank ?? '--'
  const progressToNext = progress?.progressPercent ?? 100

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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 8, padding: 4 }}>
              <ChevronLeft size={24} color={t.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Rewards</Text>
          </View>
        </View>

        {/* Profile Card — with stats merged in */}
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
              <View style={s.inlineStat}>
                <Flame size={14} color="#ef4444" />
                <Text style={s.inlineStatValue}>{streak}</Text>
                <Text style={s.inlineStatLabel}>Streak</Text>
              </View>
              <View style={s.inlineStatDivider} />
              <View style={s.inlineStat}>
                <Target size={14} color={c.violet500} />
                <Text style={s.inlineStatValue}>{totalReports}</Text>
                <Text style={s.inlineStatLabel}>Reports</Text>
              </View>
              <View style={s.inlineStatDivider} />
              <View style={s.inlineStat}>
                <Medal size={14} color={c.emerald500} />
                <Text style={s.inlineStatValue}>#{userRank}</Text>
                <Text style={s.inlineStatLabel}>Rank</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>Weekly Leaderboard</Text>
            <TouchableOpacity onPress={() => router.push('/leaderboard' as any)} style={s.seeAllBtn}>
              <Text style={s.seeAllText}>See all</Text>
              <ChevronRight size={16} color={c.amber500} />
            </TouchableOpacity>
          </View>

          {leaderboard.length === 0 ? (
            <View style={s.emptyLeaderboard}>
              <Medal size={32} color={t.textTertiary} />
              <Text style={s.emptyLeaderboardText}>
                Start contributing to see the leaderboard!
              </Text>
            </View>
          ) : (
            <View style={s.leaderboardCard}>
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
            </View>
          )}
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
                { action: 'Daily check-in', points: '+2' },
                { action: '7-day streak bonus', points: '+10' },
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
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontFamily: font.semibold, marginBottom: 12, color: t.text },
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
    inlineStat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    inlineStatValue: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
      marginTop: 2,
    },
    inlineStatLabel: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    inlineStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: isDark ? c.stone800 : c.stone200,
    },

    // Leaderboard
    seeAllBtn: { flexDirection: 'row', alignItems: 'center' },
    seeAllText: { color: c.amber500, fontSize: 14, fontFamily: font.medium },
    leaderboardCard: { padding: 16, borderRadius: 16, backgroundColor: t.card },
    emptyLeaderboard: {
      padding: 24,
      borderRadius: 16,
      backgroundColor: t.card,
      alignItems: 'center',
      gap: 8,
    },
    emptyLeaderboardText: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
    },
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
    podiumBarText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? c.stone300 : c.stone600,
    },
    podiumBarTextWhite: { fontSize: 12, fontFamily: font.medium, color: c.white },
    podiumBarText3rd: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? c.amber400 : c.amber700,
    },

    // How to earn — collapsible
    earnToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      padding: 14,
      borderRadius: 16,
      gap: 8,
    },
    earnToggleText: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.semibold,
      color: t.text,
    },
    earnCard: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      backgroundColor: t.card,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      marginTop: -8,
    },
    earnRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    earnRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDark ? c.stone800 : c.stone200,
    },
    earnAction: { fontSize: 14, color: isDark ? c.stone300 : c.stone700 },
    earnPoints: { fontSize: 14, color: c.amber500, fontFamily: font.semibold },
  })
}
