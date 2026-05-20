import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Megaphone,
  TrendingUp,
  AlertTriangle,
  Route as RouteIcon,
  FileText,
  Info,
  BarChart3,
} from 'lucide-react-native'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, themed, font } from '@/lib/theme'
import { supabase } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils/time'

type Category =
  | 'fare_update'
  | 'strike'
  | 'route_change'
  | 'policy'
  | 'public_notice'
  | 'insights'

type Priority = 'low' | 'normal' | 'high' | 'urgent'

type Source = 'GPRTU' | 'GRDA' | 'GRA' | 'MMTL' | 'MOT' | 'TROSKI'

type Announcement = {
  id: string
  source: Source
  title: string
  body: string
  category: Category
  priority: Priority
  attachment_url: string | null
  published_at: string
}

type FilterKey = 'all' | Category

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fare_update', label: 'Fares' },
  { key: 'route_change', label: 'Routes' },
  { key: 'strike', label: 'Strikes' },
  { key: 'policy', label: 'Policy' },
  { key: 'public_notice', label: 'Notices' },
  { key: 'insights', label: 'Insights' },
]

const CATEGORY_META: Record<
  Category,
  { icon: typeof Megaphone; color: string; label: string }
> = {
  fare_update: { icon: TrendingUp, color: '#22c55e', label: 'Fare Update' },
  strike: { icon: AlertTriangle, color: '#ef4444', label: 'Strike Notice' },
  route_change: { icon: RouteIcon, color: '#f97316', label: 'Route Change' },
  policy: { icon: FileText, color: '#8b5cf6', label: 'Policy' },
  public_notice: { icon: Info, color: '#3b82f6', label: 'Public Notice' },
  insights: { icon: BarChart3, color: '#f59e0b', label: 'Troski Insights' },
}

const SOURCE_META: Record<Source, { color: string; label: string }> = {
  GPRTU: { color: '#16a34a', label: 'GPRTU' },
  GRDA: { color: '#2563eb', label: 'GRDA' },
  GRA: { color: '#dc2626', label: 'GRA' },
  MMTL: { color: '#0891b2', label: 'MMTL' },
  MOT: { color: '#7c3aed', label: 'Ministry of Transport' },
  TROSKI: { color: '#f59e0b', label: 'Troski' },
}

export default function BulletinScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('official_announcements')
      .select('id, source, title, body, category, priority, attachment_url, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('[bulletin] load failed', error.message)
      setAnnouncements([])
    } else {
      setAnnouncements((data ?? []) as Announcement[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await load()
    setIsRefreshing(false)
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return announcements
    return announcements.filter((a) => a.category === filter)
  }, [announcements, filter])

  const renderItem = ({ item }: { item: Announcement }) => {
    const meta = CATEGORY_META[item.category]
    const Icon = meta.icon
    const source = SOURCE_META[item.source]
    const isUrgent = item.priority === 'urgent' || item.priority === 'high'

    return (
      <View style={[s.card, isUrgent && s.cardUrgent]}>
        <View style={s.cardHeader}>
          <View style={[s.iconBox, { backgroundColor: `${meta.color}20` }]}>
            <Icon size={18} color={meta.color} />
          </View>
          <View style={s.cardHeaderText}>
            <View style={s.sourceRow}>
              <View style={[s.sourceBadge, { backgroundColor: source.color }]}>
                <Text style={s.sourceBadgeText}>{source.label}</Text>
              </View>
              {isUrgent && (
                <View style={s.urgentBadge}>
                  <Text style={s.urgentBadgeText}>
                    {item.priority === 'urgent' ? 'URGENT' : 'IMPORTANT'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.categoryLabel}>{meta.label}</Text>
          </View>
          <Text style={s.timeText}>{timeAgo(item.published_at)}</Text>
        </View>

        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <GlassBackButton isDark={isDark} />
          <View style={s.headerTitleWrap}>
            <View style={s.headerTitleRow}>
              <Megaphone size={22} color={c.amber500} />
              <Text style={s.headerTitle}>Transport Pulse</Text>
            </View>
            <Text style={s.headerSub}>
              Official announcements from GPRTU, GRDA, and partners
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.centered}>
          <Megaphone size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>No announcements yet</Text>
          <Text style={s.emptySub}>
            Official announcements from GPRTU, GRDA, and other partners will appear here as
            soon as they're published.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
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
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    headerTitleWrap: { flex: 1, marginTop: 2 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 22, fontFamily: font.bold, color: t.text },
    headerSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textTertiary,
      marginTop: 2,
    },
    filterBar: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: isDark ? c.stone700 : c.stone200,
    },
    filterChipActive: {
      backgroundColor: c.amber500,
      borderColor: c.amber500,
    },
    filterChipText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    filterChipTextActive: {
      color: '#fff',
      fontFamily: font.semibold,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 17,
      fontFamily: font.semibold,
      color: t.textSecondary,
      marginTop: 16,
    },
    emptySub: {
      fontSize: 13,
      color: t.textTertiary,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 19,
    },
    card: {
      padding: 16,
      borderRadius: 18,
      marginBottom: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: isDark ? c.stone800 : c.stone100,
    },
    cardUrgent: {
      borderLeftWidth: 3,
      borderLeftColor: c.amber500,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
      gap: 10,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeaderText: { flex: 1 },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sourceBadge: {
      paddingHorizontal: 8,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sourceBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 0.4,
    },
    urgentBadge: {
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ef4444',
    },
    urgentBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 0.5,
    },
    categoryLabel: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      marginTop: 3,
    },
    timeText: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textTertiary,
    },
    title: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
      lineHeight: 21,
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      lineHeight: 19,
    },
  })
}
