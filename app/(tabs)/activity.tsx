import { useState, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  FlatList,
  useColorScheme,
  RefreshControl,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  AlertTriangle,
  Award,
  Bell,
  Camera,
  Flame,
  Heart,
  Megaphone,
  MessageCircle,
  Navigation,
  Star,
  TrainFront,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react-native'
import { router, type Href } from 'expo-router'
import { brand, ui, space, radius, type, cardShadow, font } from '@/lib/theme'
import ReanimatedAnimated, { FadeInDown } from 'react-native-reanimated'
import { useApp } from '@/lib/contexts/AppContext'
import { useActivity } from '@/lib/hooks/useActivity'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { timeAgo } from '@/lib/utils/time'
import type { ActivityItem } from '@/lib/services/activity'
import type { NotificationType } from '@/lib/services/notifications'
import { SkeletonActivityItem } from '@/components/Skeleton'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'

// ─── Config ─────────────────────────────────────────────

type Segment = 'notifications' | 'activity'

const ACTIVITY_TYPE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string }> = {
  fare: { icon: TrendingUp, color: ui.warning },
  queue: { icon: Users, color: ui.info },
  incident: { icon: AlertTriangle, color: ui.danger },
  tale: { icon: Camera, color: brand.orange },
  train: { icon: TrainFront, color: ui.info },
  trip: { icon: Navigation, color: ui.success },
}

const NOTIF_ICON_MAP: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  fare_drop: { icon: TrendingDown, color: ui.success },
  queue_alert: { icon: Users, color: ui.info },
  streak_risk: { icon: Flame, color: ui.danger },
  level_up: { icon: Award, color: brand.orange },
  badge_earned: { icon: Star, color: brand.orange },
  community: { icon: MessageCircle, color: ui.info },
  post_activity: { icon: Heart, color: brand.orange },
  official_announcement: { icon: Megaphone, color: ui.warning },
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ─── Date grouping ─────────────────────────────────────────

function getDateBucket(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  if (date >= today) return 'Today'
  if (date >= yesterday) return 'Yesterday'
  if (date >= weekAgo) return 'This Week'
  return 'Older'
}

function groupByDate(items: ActivityItem[]): { title: string; data: ActivityItem[] }[] {
  const bucketOrder = ['Today', 'Yesterday', 'This Week', 'Older']
  const groups: Record<string, ActivityItem[]> = {}

  for (const item of items) {
    const bucket = getDateBucket(item.timestamp)
    if (!groups[bucket]) groups[bucket] = []
    groups[bucket].push(item)
  }

  return bucketOrder
    .filter((b) => groups[b]?.length)
    .map((title) => ({ title, data: groups[title] }))
}

// ─── Swipeable Row (Activity) ─────────────────────────────

function SwipeableRow({
  item,
  isDark,
  onDismiss,
}: {
  item: ActivityItem
  isDark: boolean
  onDismiss: (id: string) => void
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const rs = getRowStyles(isDark)

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onDismiss(item.id)
  }, [onDismiss, item.id])

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-100, -50, 0],
        outputRange: [1, 0.8, 0],
        extrapolate: 'clamp',
      })
      return (
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.8}
          style={rs.deleteAction}
        >
          <Animated.View style={[rs.deleteContent, { transform: [{ scale }] }]}>
            <Trash2 size={20} color={ui.onBrand} />
            <Text style={rs.deleteText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      )
    },
    [handleDelete, rs]
  )

  const config = ACTIVITY_TYPE_CONFIG[item.type] ?? ACTIVITY_TYPE_CONFIG.fare
  const Icon = config.icon
  const iconColor = item.type === 'trip' && item.meta !== 'arrived'
    ? ui.textTertiary
    : config.color

  const isRecent = Date.now() - new Date(item.timestamp).getTime() < 3600000

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={80}
      onSwipeableOpen={handleDelete}
      overshootRight={false}
      friction={2}
    >
      <View style={rs.card}>
        <View style={[rs.iconCircle, { backgroundColor: iconColor }]}>
          <Icon size={20} color={ui.onBrand} />
        </View>
        <View style={rs.content}>
          <View style={rs.titleRow}>
            <Text style={rs.title} numberOfLines={1}>{item.title}</Text>
            {isRecent && <View style={rs.unreadDot} />}
          </View>
          <Text style={rs.subtitle} numberOfLines={1}>{item.subtitle}</Text>
          <Text style={rs.time}>{timeAgo(item.timestamp)}</Text>
        </View>
      </View>
    </Swipeable>
  )
}

// ─── Main Screen ───────────────────────────────────────────

export default function UpdatesScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  const [segment, setSegment] = useState<Segment>('notifications')

  // ── Activity data ──
  const {
    items: activityItems,
    isLoading: activityLoading,
    isRefreshing: activityRefreshing,
    hasMore,
    refresh: activityRefresh,
    loadMore,
    dismissItem,
    dismissAll,
  } = useActivity()
  useRefreshOnFocus([['activity']])

  const hasScrolledRef = useRef(false)
  const handleEndReached = useCallback(() => {
    if (hasScrolledRef.current) loadMore()
  }, [loadMore])

  const sections = groupByDate(activityItems)

  // ── Notifications data ──
  const { deviceId } = useApp()
  const {
    notifications,
    unreadCount,
    isLoading: notifLoading,
    markAsRead,
    markAllRead,
    refetch: notifRefetch,
  } = useNotifications(deviceId)

  const [notifRefreshing, setNotifRefreshing] = useState(false)
  const handleNotifRefresh = async () => {
    setNotifRefreshing(true)
    await notifRefetch()
    setNotifRefreshing(false)
  }

  // ── Renderers ──

  const renderActivityItem = useCallback(
    ({ item }: { item: ActivityItem }) => (
      <SwipeableRow item={item} isDark={isDark} onDismiss={dismissItem} />
    ),
    [isDark, dismissItem]
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [s]
  )

  const renderActivityFooter = useCallback(() => {
    if (!hasMore && activityItems.length > 0) {
      return (
        <View style={s.footer}>
          <Text style={s.footerText}>No more activity</Text>
        </View>
      )
    }
    return null
  }, [hasMore, activityItems.length, s])

  const renderNotifItem = useCallback(
    ({ item }: { item: (typeof notifications)[0] }) => {
      const config = NOTIF_ICON_MAP[item.type] ?? NOTIF_ICON_MAP.community
      const Icon = config.icon

      return (
        <TouchableOpacity
          onPress={() => {
            markAsRead(item.id)
            if (item.linkTo) router.push(item.linkTo as Href)
          }}
          activeOpacity={0.7}
          style={[s.notifCard, !item.read && s.notifCardUnread]}
        >
          <View style={[s.notifIconBox, { backgroundColor: `${config.color}20` }]}>
            <Icon size={20} color={config.color} />
          </View>
          <View style={s.notifContent}>
            <Text style={s.notifTitle}>{item.title}</Text>
            <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text>
            <Text style={s.notifTime}>{timeAgo(item.timestamp)}</Text>
          </View>
          {!item.read && <View style={s.notifUnreadDot} />}
        </TouchableOpacity>
      )
    },
    [s, markAsRead]
  )

  const isNotifSegment = segment === 'notifications'

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <ReanimatedAnimated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Text style={s.headerTitle}>Activity</Text>
        {isNotifSegment && unreadCount > 0 ? (
          <TouchableOpacity activeOpacity={0.7} onPress={markAllRead}>
            <Text style={s.markRead}>Mark all read</Text>
          </TouchableOpacity>
        ) : !isNotifSegment && activityItems.length > 0 ? (
          <TouchableOpacity activeOpacity={0.7} onPress={dismissAll}>
            <Text style={s.markRead}>Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </ReanimatedAnimated.View>

      {/* Segmented Control */}
      <ReanimatedAnimated.View entering={FadeInDown.delay(100).duration(400)} style={s.segmentWrap}>
        <View style={s.segmentRow}>
          <TouchableOpacity
            onPress={() => setSegment('notifications')}
            activeOpacity={0.7}
            style={[s.segmentBtn, isNotifSegment && s.segmentBtnActive]}
          >
            <Text style={[s.segmentLabel, isNotifSegment && s.segmentLabelActive]}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSegment('activity')}
            activeOpacity={0.7}
            style={[s.segmentBtn, !isNotifSegment && s.segmentBtnActive]}
          >
            <Text style={[s.segmentLabel, !isNotifSegment && s.segmentLabelActive]}>
              Activity
            </Text>
          </TouchableOpacity>
        </View>
      </ReanimatedAnimated.View>

      {/* ── Notifications Segment ── */}
      {isNotifSegment && (
        notifLoading ? (
          <View style={s.centered}>
            <View style={{ paddingHorizontal: space.gutter, paddingTop: space.lg, width: '100%' }}>
              <SkeletonActivityItem isDark={isDark} />
              <SkeletonActivityItem isDark={isDark} />
              <SkeletonActivityItem isDark={isDark} />
            </View>
          </View>
        ) : notifications.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIconBox}>
              <Bell size={28} color={isDark ? '#fbbf24' : brand.orange} />
            </View>
            <Text style={s.emptyTitle}>All caught up</Text>
            <Text style={s.emptySub}>
              Favorite some routes to get fare alerts and queue updates.
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotifItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 90 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={notifRefreshing}
                onRefresh={handleNotifRefresh}
                tintColor={brand.orange}
                colors={[brand.orange]}
              />
            }
          />
        )
      )}

      {/* ── Activity Segment ── */}
      {!isNotifSegment && (
        activityLoading ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.lg }}>
            <SkeletonActivityItem isDark={isDark} />
            <SkeletonActivityItem isDark={isDark} />
            <SkeletonActivityItem isDark={isDark} />
            <SkeletonActivityItem isDark={isDark} />
            <SkeletonActivityItem isDark={isDark} />
          </View>
        ) : activityItems.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIconBox}>
              <Bell size={28} color={isDark ? '#fbbf24' : brand.orange} />
            </View>
            <Text style={s.emptyTitle}>Keep the pulse.</Text>
            <Text style={s.emptySub}>
              You're all caught up with the transit heartbeat of Accra.
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            renderItem={renderActivityItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            refreshControl={
              <RefreshControl
                refreshing={activityRefreshing}
                onRefresh={activityRefresh}
                tintColor={brand.orange}
                colors={[brand.orange]}
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            onScroll={() => { hasScrolledRef.current = true }}
            ListFooterComponent={renderActivityFooter}
            contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 90 }}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  )
}

// ─── Activity Row Styles ────────────────────────────────────

const getRowStyles = (isDark: boolean) => {
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : ui.card
  const onSurface = isDark ? '#fafaf9' : ui.text
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary
  const outline = isDark ? 'rgba(255,255,255,0.25)' : ui.textTertiary

  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: space.lg,
      borderRadius: radius.lg,
      marginBottom: space.md,
      backgroundColor: surfaceLow,
      gap: 14,
      ...(isDark ? {} : cardShadow),
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 15,
      color: onSurface,
      flex: 1,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: brand.orange,
      marginLeft: 8,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    time: {
      fontSize: 12,
      fontFamily: font.medium,
      color: outline,
      marginTop: 4,
    },
    deleteAction: {
      backgroundColor: ui.danger,
      borderRadius: radius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      marginBottom: 12,
      marginLeft: -4,
    },
    deleteContent: { alignItems: 'center', justifyContent: 'center' },
    deleteText: {
      color: ui.onBrand,
      fontFamily: font.semibold,
      fontSize: 12,
      marginTop: 4,
    },
  })
}

// ─── Main Styles ────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#0c0a09' : ui.bg
  const onSurface = isDark ? '#fafaf9' : ui.text
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
      paddingBottom: space.sm,
    },
    headerTitle: {
      ...type.title,
      color: isDark ? '#fafaf9' : ui.text,
    },
    markRead: {
      ...type.labelStrong,
      color: isDark ? '#f8a010' : brand.orangeText,
    },

    // Segmented control
    segmentWrap: {
      paddingHorizontal: space.gutter,
      paddingBottom: 12,
    },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : ui.surface,
      borderRadius: radius.md,
      padding: 3,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    segmentBtnActive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : ui.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 3,
      elevation: isDark ? 0 : 2,
    },
    segmentLabel: {
      fontSize: 14,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    segmentLabelActive: {
      fontFamily: font.semibold,
      color: onSurface,
    },
    badge: {
      backgroundColor: ui.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: ui.onBrand,
    },

    // Section list
    sectionHeader: {
      paddingVertical: 10,
      paddingHorizontal: space.gutter,
      marginHorizontal: -space.gutter,
      backgroundColor: isDark ? 'rgba(12,10,9,0.85)' : 'rgba(250,250,249,0.92)',
    },
    sectionTitle: {
      ...type.labelStrong,
      color: onSurfaceVariant,
    },
    footer: { alignItems: 'center', paddingVertical: 20 },
    footerText: { fontSize: 13, fontFamily: font.regular, color: onSurfaceVariant },

    // Notification cards (match the existing notification screen style)
    notifCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: space.lg,
      borderRadius: radius.lg,
      marginBottom: space.md,
      backgroundColor: isDark ? cardBg : ui.card,
      ...(isDark ? {} : cardShadow),
    },
    notifCardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: brand.orange,
    },
    notifIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 15, fontFamily: font.semibold, color: onSurface },
    notifBody: { fontSize: 14, color: onSurfaceVariant, marginTop: 2, lineHeight: 20 },
    notifTime: { fontSize: 12, color: isDark ? 'rgba(255,255,255,0.25)' : ui.textTertiary, marginTop: 4 },
    notifUnreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: brand.orange,
      marginTop: 4,
    },

    // Empty / loading
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : brand.orangeSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontFamily: font.bold, color: onSurface },
    emptySub: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 220,
      lineHeight: 20,
    },
  })
}
