import { useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, Users, AlertTriangle, Camera, Zap, Trash2, TrainFront, ChevronLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import { useActivity } from '@/lib/hooks/useActivity'
import { timeAgo } from '@/lib/utils/time'
import type { ActivityItem } from '@/lib/services/activity'

const TYPE_CONFIG: Record<string, { icon: typeof TrendingUp; color: string }> = {
  fare: { icon: TrendingUp, color: c.amber500 },
  queue: { icon: Users, color: c.violet500 },
  incident: { icon: AlertTriangle, color: c.red500 },
  tale: { icon: Camera, color: c.pink500 },
  train: { icon: TrainFront, color: '#0ea5e9' },
}

const SWIPE_THRESHOLD = -80

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
  const translateX = useRef(new Animated.Value(0)).current
  const rowHeight = useRef(new Animated.Value(78)).current
  const rowOpacity = useRef(new Animated.Value(1)).current

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < SWIPE_THRESHOLD) {
          // Animate off screen, then collapse height
          Animated.sequence([
            Animated.timing(translateX, {
              toValue: -400,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.parallel([
              Animated.timing(rowHeight, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(rowOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
            ]),
          ]).start(() => onDismiss(item.id))
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            friction: 8,
          }).start()
        }
      },
    })
  ).current

  const t = themed(isDark)
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.fare
  const Icon = config.icon

  return (
    <Animated.View style={{ height: rowHeight, opacity: rowOpacity, overflow: 'hidden' }}>
      {/* Red delete background */}
      <View style={swipeStyles.deleteBackground}>
        <Trash2 size={20} color={c.white} />
        <Text style={swipeStyles.deleteText}>Delete</Text>
      </View>

      {/* Foreground card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 16,
            marginBottom: 10,
            backgroundColor: t.card,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={[swipeStyles.iconBox, { backgroundColor: `${config.color}20` }]}>
          <Icon size={20} color={config.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[swipeStyles.title, { color: t.text }]}>{item.title}</Text>
          <Text style={[swipeStyles.subtitle, { color: t.textSecondary }]}>{item.subtitle}</Text>
        </View>
        <Text style={[swipeStyles.time, { color: t.textTertiary }]}>{timeAgo(item.timestamp)}</Text>
      </Animated.View>
    </Animated.View>
  )
}

// ─── Main Screen ───────────────────────────────────────────

export default function ActivityScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const {
    items,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    refresh,
    loadMore,
    dismissItem,
  } = useActivity()

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
    if (isLoadingMore) {
      return (
        <View style={s.footer}>
          <ActivityIndicator size="small" color={c.amber500} />
        </View>
      )
    }
    if (!hasMore && items.length > 0) {
      return (
        <View style={s.footer}>
          <Text style={s.footerText}>No more activity</Text>
        </View>
      )
    }
    return null
  }, [isLoadingMore, hasMore, items.length, s])

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 8, padding: 4 }}>
            <ChevronLeft size={24} color={t.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Activity</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.centered}>
          <Zap size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>No activity yet</Text>
          <Text style={s.emptySub}>
            Reports, tales, and incidents will show up here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={c.amber500}
              colors={[c.amber500]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────

const swipeStyles = StyleSheet.create({
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ef4444',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    marginBottom: 10,
  },
  deleteText: {
    color: c.white,
    fontFamily: font.semibold,
    fontSize: 14,
    marginLeft: 8,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontFamily: font.semibold, fontSize: 14 },
  subtitle: { fontSize: 13, marginTop: 2 },
  time: { fontSize: 12 },
})

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    sectionHeader: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: font.bold,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: t.textSecondary, marginTop: 16 },
    emptySub: { fontSize: 14, color: t.textTertiary, marginTop: 4, textAlign: 'center' },
    footer: { alignItems: 'center', paddingVertical: 20 },
    footerText: { fontSize: 13, color: t.textTertiary },
  })
}
