import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Bell,
  TrendingDown,
  Users,
  Flame,
  Award,
  Star,
  MessageCircle,
  Megaphone,
} from 'lucide-react-native'
import { router, type Href } from 'expo-router'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { timeAgo } from '@/lib/utils/time'
import type { NotificationType } from '@/lib/services/notifications'

const ICON_MAP: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  fare_drop: { icon: TrendingDown, color: '#22c55e' },
  queue_alert: { icon: Users, color: '#f97316' },
  streak_risk: { icon: Flame, color: '#ef4444' },
  level_up: { icon: Award, color: '#f59e0b' },
  badge_earned: { icon: Star, color: '#8b5cf6' },
  community: { icon: MessageCircle, color: '#8b5cf6' },
  official_announcement: { icon: Megaphone, color: '#f59e0b' },
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { deviceId } = useApp()
  const { notifications, unreadCount, isLoading, markAsRead, markAllRead, refetch } =
    useNotifications(deviceId)
  // Refresh stale notifications when the screen regains focus (no realtime yet).
  useRefreshOnFocus([['notifications']])

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  // Group notifications into relative time buckets for easier scanning.
  const sections = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)

    const today: typeof notifications = []
    const thisWeek: typeof notifications = []
    const earlier: typeof notifications = []

    for (const item of notifications) {
      const ts = new Date(item.timestamp)
      if (ts >= startOfToday) today.push(item)
      else if (ts >= startOfWeek) thisWeek.push(item)
      else earlier.push(item)
    }

    return [
      { title: 'Today', data: today },
      { title: 'This Week', data: thisWeek },
      { title: 'Earlier', data: earlier },
    ].filter((section) => section.data.length > 0)
  }, [notifications])

  const renderItem = ({ item }: { item: (typeof notifications)[0] }) => {
    const config = ICON_MAP[item.type] ?? ICON_MAP.community
    const Icon = config.icon

    return (
      <TouchableOpacity
        onPress={() => {
          markAsRead(item.id)
          if (item.linkTo) router.push(item.linkTo as Href)
        }}
        activeOpacity={0.7}
        style={[s.card, !item.read && s.cardUnread]}
      >
        <View style={[s.iconBox, { backgroundColor: item.read ? t.textTertiary + '20' : `${config.color}20` }]}>
          <Icon size={20} color={item.read ? t.textTertiary : config.color} />
        </View>
        <View style={s.cardContent}>
          <Text style={[s.cardTitle, item.read && s.cardTitleRead]}>{item.title}</Text>
          <Text style={s.cardBody} numberOfLines={2}>{item.body}</Text>
          <Text style={s.cardTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        {!item.read && <View style={s.unreadDot} />}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <GlassBackButton isDark={isDark} />
          <Text style={s.headerTitle}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.centered}>
          <Bell size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptySub}>
            Favorite some routes to get fare drop and queue alerts!
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionHeader}>{section.title}</Text>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    markAllText: { fontSize: 14, fontFamily: font.medium, color: c.amber500 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: t.textSecondary, marginTop: 16 },
    emptySub: { fontSize: 14, color: t.textTertiary, marginTop: 4, textAlign: 'center' },
    sectionHeader: {
      fontSize: 13,
      fontFamily: font.bold,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 12,
      marginBottom: 8,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      backgroundColor: t.card,
    },
    cardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: c.amber500,
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    cardTitleRead: { color: t.textSecondary, fontFamily: font.medium },
    cardBody: { fontSize: 13, color: t.textSecondary, marginTop: 2, lineHeight: 18 },
    cardTime: { fontSize: 12, color: t.textTertiary, marginTop: 4 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.amber500,
      marginTop: 4,
    },
  })
}
