import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, Medal } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard } from '@/lib/hooks/useRewards'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'
import type { LeaderboardEntry } from '@/lib/types'

const PODIUM_EMOJI = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId } = useApp()
  const { entries, userRank, isLoading, refetch } = useLeaderboard(deviceId)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isUser = item.device_id === deviceId
    const levelInfo = LEVELS[item.current_level as keyof typeof LEVELS] ?? LEVELS.passenger
    const rank = index + 1

    return (
      <View style={[s.row, isUser && s.rowHighlight]}>
        <View style={s.rankBox}>
          {rank <= 3 ? (
            <Text style={s.rankEmoji}>{PODIUM_EMOJI[rank - 1]}</Text>
          ) : (
            <Text style={s.rankNum}>#{rank}</Text>
          )}
        </View>
        <InitialsAvatar
          name={item.display_name}
          deviceId={item.device_id}
          size={40}
        />
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {item.display_name ?? 'Anonymous'}
            {isUser ? ' (You)' : ''}
          </Text>
          <Text style={s.level}>{levelInfo.emoji} {levelInfo.name}</Text>
        </View>
        <View style={s.pointsBox}>
          <Text style={s.points}>{item.weekly_points}</Text>
          <Text style={s.pointsLabel}>pts</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <ChevronLeft size={24} color={t.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Weekly Leaderboard</Text>
          {userRank && (
            <Text style={s.headerSub}>Your rank: #{userRank}</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      ) : entries.length === 0 ? (
        <View style={s.centered}>
          <Medal size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>No leaderboard data yet</Text>
          <Text style={s.emptySub}>Start reporting to appear on the leaderboard!</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id ?? item.device_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={c.amber500}
              colors={[c.amber500]}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    backBtn: { marginRight: 8, padding: 4 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    headerSub: { fontSize: 13, color: c.amber500, fontFamily: font.medium, marginTop: 2 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: t.textSecondary, marginTop: 16 },
    emptySub: { fontSize: 14, color: t.textTertiary, marginTop: 4, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      marginBottom: 8,
      backgroundColor: t.card,
    },
    rowHighlight: {
      borderWidth: 1.5,
      borderColor: c.amber500,
    },
    rankBox: {
      width: 36,
      alignItems: 'center',
      marginRight: 10,
    },
    rankEmoji: { fontSize: 20 },
    rankNum: {
      fontSize: 14,
      fontFamily: font.bold,
      color: t.textSecondary,
    },
    info: { flex: 1, marginLeft: 10 },
    name: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    level: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    pointsBox: { alignItems: 'flex-end' },
    points: { fontSize: 18, fontFamily: font.bold, color: c.amber500 },
    pointsLabel: { fontSize: 11, color: t.textTertiary },
  })
}
