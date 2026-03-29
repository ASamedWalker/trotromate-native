import { useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
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
  TrendingUp,
  Users,
  AlertTriangle,
  Camera,
  Trash2,
  TrainFront,
  Navigation,
  Bell,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useActivity } from '@/lib/hooks/useActivity'
import { timeAgo } from '@/lib/utils/time'
import type { ActivityItem } from '@/lib/services/activity'
import { SkeletonActivityItem } from '@/components/Skeleton'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'

const TYPE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string }> = {
  fare: { icon: TrendingUp, color: '#f59e0b' },
  queue: { icon: Users, color: '#8b5cf6' },
  incident: { icon: AlertTriangle, color: '#ef4444' },
  tale: { icon: Camera, color: '#8b5cf6' },
  train: { icon: TrainFront, color: '#0ea5e9' },
  trip: { icon: Navigation, color: '#22c55e' },
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

// ─── Swipeable Row ─────────────────────────────────────────

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
            <Trash2 size={20} color="#fff" />
            <Text style={rs.deleteText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      )
    },
    [handleDelete, rs]
  )

  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.fare
  const Icon = config.icon
  const iconColor = item.type === 'trip' && item.meta !== 'arrived'
    ? '#9ca3af'
    : config.color

  // Check if unread (within last hour as heuristic)
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
          <Icon size={20} color="#fff" />
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

export default function ActivityScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const {
    items,
    isLoading,
    isRefreshing,
    hasMore,
    refresh,
    loadMore,
    dismissItem,
    dismissAll,
  } = useActivity()
  useRefreshOnFocus([['activity']])

  // Prevent onEndReached from firing before user has scrolled
  const hasScrolledRef = useRef(false)
  const handleEndReached = useCallback(() => {
    if (hasScrolledRef.current) loadMore()
  }, [loadMore])

  const sections = groupByDate(items)

  const renderItem = useCallback(
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

  const renderFooter = useCallback(() => {
    if (!hasMore && items.length > 0) {
      return (
        <View style={s.footer}>
          <Text style={s.footerText}>No more activity</Text>
        </View>
      )
    }
    return null
  }, [hasMore, items.length, s])

  const renderEmpty = useCallback(() => (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconBox}>
        <Bell size={28} color="#815100" />
      </View>
      <Text style={s.emptyTitle}>Keep the pulse.</Text>
      <Text style={s.emptySub}>
        You're all caught up with the transit heartbeat of Accra.
      </Text>
    </View>
  ), [s])

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Activity</Text>
        {items.length > 0 && (
          <TouchableOpacity activeOpacity={0.7} onPress={dismissAll}>
            <Text style={s.markRead}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SkeletonActivityItem isDark={isDark} />
          <SkeletonActivityItem isDark={isDark} />
          <SkeletonActivityItem isDark={isDark} />
          <SkeletonActivityItem isDark={isDark} />
          <SkeletonActivityItem isDark={isDark} />
        </View>
      ) : items.length === 0 ? (
        renderEmpty()
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#815100"
              colors={['#815100']}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          onScroll={() => { hasScrolledRef.current = true }}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Row Styles ─────────────────────────────────────────────

const getRowStyles = (isDark: boolean) => {
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#fafaf9' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outline = isDark ? 'rgba(255,255,255,0.25)' : '#7a7674'

  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: surfaceLow,
      gap: 14,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
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
      backgroundColor: '#3b82f6',
      marginLeft: 8,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    time: {
      fontSize: 11,
      fontFamily: font.medium,
      color: outline,
      marginTop: 4,
    },
    deleteAction: {
      backgroundColor: '#b02500',
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      width: 90,
      marginBottom: 12,
      marginLeft: -4,
    },
    deleteContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      color: '#fff',
      fontFamily: font.semibold,
      fontSize: 12,
      marginTop: 4,
    },
  })
}

// ─── Main Styles ────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#0c0a09' : '#fcf5f2'
  const onSurface = isDark ? '#fafaf9' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: font.bold,
      color: isDark ? '#fafaf9' : '#78350f', // amber-900
      letterSpacing: -0.3,
    },
    markRead: {
      fontSize: 13,
      fontFamily: font.medium,
      color: isDark ? '#f8a010' : '#b45309', // amber-700
    },
    sectionHeader: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: -16,
      backgroundColor: isDark ? 'rgba(12,10,9,0.85)' : 'rgba(252,245,242,0.85)',
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    footerText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },

    // Empty state
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '12deg' }],
      marginBottom: 20,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0 : 0.12,
      shadowRadius: 20,
      elevation: isDark ? 0 : 8,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: font.bold,
      color: onSurface,
    },
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
