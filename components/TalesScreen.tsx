import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  DeviceEventEmitter,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react-native'
import { SvgXml } from 'react-native-svg'
import { adinkraXml } from '@/lib/brand/adinkra'
import { brand, ui, font } from '@/lib/theme'
import { Button } from '@/components/ui'
import { HeroText } from '@/components/HeroText'
import { AdinkraBand, ADINKRA_BAND_DAY } from '@/components/AdinkraAccent'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/contexts/AppContext'
import { useAlerts } from '@/lib/hooks/useAlerts'
import { useTalesFeed } from '@/lib/hooks/useTales'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { timeAgo } from '@/lib/utils/time'
import CommentSheet from '@/components/CommentSheet'
import { SkeletonTaleCard } from '@/components/Skeleton'
import ImageViewer from '@/components/ImageViewer'
import { LoadErrorState } from '@/components/StateViews'
import type { TalePost } from '@/lib/types'
import { pulseKind, parseComposerFare } from '@/lib/utils/pulse-extract'
import { PulseAlerts } from '@/components/pulse/PulseAlertCard'
import { PulseRightNow, usePulseStations } from '@/components/pulse/PulseRightNow'
import { PulseReportBar } from '@/components/pulse/PulseReportBar'
import { PulseFilterSheet, FILTER_LABEL, type PulseFilter } from '@/components/pulse/PulseFilterSheet'
import {
  PulsePostCard, PulseEarlierRow, PulseRoadRow, PulseIncidentCard, isEarlier,
  type CardActions, type PulseIncident,
} from '@/components/pulse/PulseCards'
import { PAD, META, SectionTitle, SectionLabel } from '@/components/pulse/PulseBits'

/** Earlier shows this many one-line rows before "Show N more". */
const EARLIER_CAP = 5

const emptyGlyph = adinkraXml('nteasee', 44, '#D6CFC8')

const FILTER_EMPTY: Record<Exclude<PulseFilter, 'all'>, string> = {
  fare: 'No fare posts yet.',
  question: 'No questions yet.',
  queue: 'No queue updates yet.',
  moment: 'No photos or videos yet.',
}

function getDisplayName(post: TalePost): string {
  if (post.display_name) return post.display_name
  return `User-${post.device_id.slice(-4).toUpperCase()}`
}

// ─── Feed rows (one FlatList, memoized rows) ─────────────
// Order (UX v2 Direction A): Today → Earlier (stale, one line) → From the road (photos last).

type Row =
  | { t: 'today'; key: string; title: string }
  | { t: 'incident'; key: string; incident: PulseIncident }
  | { t: 'post'; key: string; post: TalePost }
  | { t: 'note'; key: string; text: string }
  | { t: 'earlierDivider'; key: string }
  | { t: 'earlier'; key: string; post: TalePost }
  | { t: 'earlierMore'; key: string; count: number }
  | { t: 'earlierFewer'; key: string }
  | { t: 'roadLabel'; key: string }
  | { t: 'road'; key: string; post: TalePost }

/** Problems riders reported in the last 2 hours (read-only, one small query, no polling). */
function useRecentIncidents(enabled: boolean) {
  return useQuery({
    queryKey: ['pulse-incidents'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PulseIncident[]> => {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('incident_reports')
        .select('id, location_name, incident_type, reported_at')
        .gte('reported_at', since)
        .gt('expires_at', new Date().toISOString())
        .order('reported_at', { ascending: false })
        .limit(2)
      if (error) return []
      return (data ?? []) as PulseIncident[]
    },
  })
}

/** "Updated N min ago" + refresh; ticks on its own so the list does not re-render. */
function UpdatedLabel({ at, onRefresh }: { at: number | null; onRefresh: () => void }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])
  const mins = at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : null
  const label = mins == null ? 'Updating' : mins < 1 ? 'Updated just now' : `Updated ${mins} min ago`
  return (
    <TouchableOpacity
      onPress={onRefresh}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Refresh`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}
    >
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: META }}>{label}</Text>
      <RefreshCw size={13} color={META} />
    </TouchableOpacity>
  )
}

export function TalesScreen() {
  const router = useRouter()
  const alerts = useAlerts().data ?? []

  const { deviceId } = useApp()
  const {
    posts, isLoading, isError, retry, isRefreshing, hasMore,
    refresh, loadMore, deletePost, reactionSummaries,
  } = useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])

  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PulseFilter>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [earlierAll, setEarlierAll] = useState(false)
  const [viewer, setViewer] = useState<{ images: string[]; index: number; author: string; caption: string } | null>(null)

  const { candidates, known, place, saved } = usePulseStations(placeId)
  const incidentsQ = useRecentIncidents(filter === 'all')

  // "Updated N min ago": when the feed last arrived.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!isLoading && !isRefreshing) setUpdatedAt(Date.now())
  }, [posts, isLoading, isRefreshing])

  // Listen for comment open signal from reel screen
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sub = DeviceEventEmitter.addListener('openComment', (postId: string) => {
      timer = setTimeout(() => setCommentPostId(postId), 300)
    })
    return () => { sub.remove(); clearTimeout(timer) }
  }, [])

  const reportPost = useCallback((postId: string) => {
    Alert.alert('Report Post', 'Are you sure you want to report this post as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('content_reports').upsert({
            reporter_device_id: deviceId,
            content_type: 'tale',
            content_id: postId,
            reason: 'inappropriate',
          }, { onConflict: 'reporter_device_id,content_type,content_id' })
          if (error) throw error
          Alert.alert('Reported', 'Thanks for helping keep Troski Pulse safe.')
        } catch {
          Alert.alert('Error', 'Could not submit report. Check your connection and try again.')
        }
      }},
    ])
  }, [deviceId])

  // Stable action bag so memoized rows never re-render for nothing.
  const actions = useMemo<CardActions>(() => ({
    onComment: (id) => setCommentPostId(id),
    onMenu: (post) => {
      const own = post.device_id === deviceId
      Alert.alert('Post', undefined, [
        own
          ? { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deletePost(post.id) },
          ]) }
          : { text: 'Report', style: 'destructive', onPress: () => reportPost(post.id) },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    onOpenImages: (post, images, index) => {
      const cap = post.caption ?? ''
      const composed = pulseKind(post) === 'fare' ? parseComposerFare(cap) : null
      setViewer({ images, index, author: getDisplayName(post), caption: composed ? composed.note : cap })
    },
    onVideo: (item) => {
      if (!item.video_url) return
      router.push(
        `/reel?postId=${item.id}&videoUrl=${encodeURIComponent(item.video_url)}&thumbnailUrl=${encodeURIComponent(item.video_thumbnail_url ?? '')}&durationSecs=${item.video_duration_secs ?? 0}&displayName=${encodeURIComponent(getDisplayName(item))}&deviceId=${item.device_id}&locationName=${encodeURIComponent(item.location_name)}&caption=${encodeURIComponent(item.caption ?? '')}&timeAgo=${encodeURIComponent(timeAgo(item.created_at))}&commentCount=${item.comment_count}&likeCount=${Object.values(reactionSummaries.get(item.id) || {}).reduce((a, b) => a + b, 0)}` as Href
      )
    },
    onFareReport: (from, to) => {
      router.push({ pathname: '/report/fare', params: { from, to } } as unknown as Href)
    },
  }), [deviceId, deletePost, reportPost, router, reactionSummaries])

  // An Earlier row opens the post on its own screen (Back returns to the feed).
  const openPost = useCallback((id: string) => {
    router.push({ pathname: '/tales/[id]', params: { id } } as unknown as Href)
  }, [router])

  const rows = useMemo<Row[]>(() => {
    const visible = filter === 'all' ? posts : posts.filter((p) => pulseKind(p) === filter)
    const road: TalePost[] = []
    const today: TalePost[] = []
    const earlier: TalePost[] = []
    for (const p of visible) {
      if (pulseKind(p) === 'moment') road.push(p)
      else if (isEarlier(p)) earlier.push(p)
      else today.push(p)
    }
    // Saved routes first, then the rest (stable); the title says "your routes" only when something matched.
    const onMyRoutes = (p: TalePost) => {
      const hay = `${p.caption ?? ''} ${p.location_name ?? ''}`.toLowerCase()
      return saved.some((n) => n.length >= 3 && hay.includes(n))
    }
    const mine = today.filter(onMyRoutes)
    const ordered = [...mine, ...today.filter((p) => !onMyRoutes(p))]
    const incidents = filter === 'all' ? incidentsQ.data ?? [] : []

    const out: Row[] = []
    if (filter !== 'moment') {
      out.push({ t: 'today', key: 'h-today', title: mine.length > 0 ? 'Today on your routes' : 'Today' })
      incidents.forEach((i) => out.push({ t: 'incident', key: `i-${i.id}`, incident: i }))
      ordered.forEach((p) => out.push({ t: 'post', key: p.id, post: p }))
      if (ordered.length === 0 && incidents.length === 0) {
        out.push({ t: 'note', key: 'n-today', text: filter === 'all' ? 'Nothing new in the last 2 hours. Tap a tile above to report what you see.' : FILTER_EMPTY[filter] })
      }
      if (earlier.length > 0) {
        out.push({ t: 'earlierDivider', key: 'h-earlier' })
        const shownEarlier = earlierAll ? earlier : earlier.slice(0, EARLIER_CAP)
        shownEarlier.forEach((p) => out.push({ t: 'earlier', key: `e-${p.id}`, post: p }))
        if (shownEarlier.length < earlier.length) out.push({ t: 'earlierMore', key: 'm-earlier', count: earlier.length - shownEarlier.length })
        else if (earlierAll && earlier.length > EARLIER_CAP) out.push({ t: 'earlierFewer', key: 'f-earlier' })
      }
    } else {
      out.push({ t: 'today', key: 'h-today', title: 'Photos and videos' })
      if (road.length === 0) out.push({ t: 'note', key: 'n-road', text: FILTER_EMPTY.moment })
    }
    if (road.length > 0) {
      if (filter !== 'moment') out.push({ t: 'roadLabel', key: 'h-road' })
      road.forEach((p) => out.push({ t: 'road', key: `r-${p.id}`, post: p }))
    }
    return out
  }, [posts, filter, saved, incidentsQ.data, earlierAll])

  const renderItem = useCallback(({ item }: { item: Row }) => {
    switch (item.t) {
      case 'today':
        return (
          <View style={{ paddingHorizontal: PAD, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexShrink: 1 }}><SectionTitle>{item.title}</SectionTitle></View>
            <TouchableOpacity
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${FILTER_LABEL[filter]}. Change`}
              hitSlop={{ top: 8, bottom: 8 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: filter === 'all' ? '#F3F4F6' : brand.orangeSoft }}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: filter === 'all' ? ui.text : brand.orangeText }}>{FILTER_LABEL[filter]}</Text>
              <ChevronDown size={14} color={filter === 'all' ? ui.text : brand.orangeText} />
            </TouchableOpacity>
          </View>
        )
      case 'incident':
        return <PulseIncidentCard incident={item.incident} />
      case 'post':
        return <PulsePostCard post={item.post} actions={actions} />
      case 'note':
        return <Text style={{ marginHorizontal: PAD, marginTop: 10, fontFamily: font.regular, fontSize: 14, color: META }}>{item.text}</Text>
      case 'earlierDivider':
        return (
          <View style={{ paddingHorizontal: PAD, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E7E5E4' }} />
            <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.7, color: '#A8A29E' }}>EARLIER</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E7E5E4' }} />
          </View>
        )
      case 'earlier':
        return <PulseEarlierRow post={item.post} onExpand={openPost} />
      case 'earlierFewer':
        return (
          <TouchableOpacity
            onPress={() => setEarlierAll(false)}
            accessibilityRole="button"
            accessibilityLabel="Show fewer earlier posts"
            accessibilityState={{ expanded: true }}
            style={{ marginHorizontal: PAD, marginTop: 6, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: brand.orangeText }}>Show less</Text>
            <ChevronUp size={16} color={brand.orangeText} />
          </TouchableOpacity>
        )
      case 'earlierMore':
        return (
          <TouchableOpacity
            onPress={() => setEarlierAll(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${item.count} more earlier posts`}
            accessibilityState={{ expanded: false }}
            style={{ marginHorizontal: PAD, marginTop: 6, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: brand.orangeText }}>Show {item.count} more</Text>
          </TouchableOpacity>
        )
      case 'roadLabel':
        return <View style={{ paddingHorizontal: PAD, marginTop: 16 }}><SectionLabel>From the road</SectionLabel></View>
      case 'road':
        return <PulseRoadRow post={item.post} actions={actions} />
    }
  }, [actions, openPost, filter])

  const placeLabel = place ? `Near ${place.name}` : 'Near me'

  const header = (
    <View style={{ paddingBottom: 4 }}>
      {/* Compact header on the Adinkra band: title, place chip, freshness (no subtitle) */}
      <AdinkraBand patternHeight={140} style={{ paddingBottom: 12 }}>
      <View style={{ paddingHorizontal: PAD, paddingTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <HeroText size={28} style={{ color: ui.text }}>Pulse</HeroText>
          <TouchableOpacity
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${placeLabel}. Change place`}
            hitSlop={{ top: 8, bottom: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: brand.orangeSoft, flexShrink: 1 }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: brand.orangeText, flexShrink: 1 }} numberOfLines={1}>{placeLabel}</Text>
            <ChevronDown size={14} color={brand.orangeText} />
          </TouchableOpacity>
        </View>
        <UpdatedLabel at={updatedAt} onRefresh={refresh} />
      </View>
      </AdinkraBand>
      <PulseAlerts alerts={alerts} />
      <PulseRightNow rows={candidates} known={known} />
      <PulseReportBar station={place ? { id: place.id, name: place.name } : null} />
    </View>
  )

  const listEmpty = isLoading ? (
    <View style={{ paddingTop: 12 }}>
      <SkeletonTaleCard isDark={false} />
      <SkeletonTaleCard isDark={false} />
    </View>
  ) : isError && posts.length === 0 ? (
    <View style={{ padding: 24 }}>
      <LoadErrorState message="Couldn't load the feed. Check your connection." onRetry={() => retry()} />
    </View>
  ) : (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <SvgXml xml={emptyGlyph} width={44} height={44} />
      <Text style={{ fontSize: 18, fontFamily: font.semibold, color: ui.textSecondary, marginTop: 16 }}>No posts yet</Text>
      <Text style={{ fontSize: 14, fontFamily: font.regular, color: ui.textSecondary, marginTop: 4, textAlign: 'center' }}>
        Share a fare, a queue update, or a trotro moment.
      </Text>
      <View style={{ marginTop: 20 }}>
        <Button label="Post to Pulse" fullWidth={false} onPress={() => router.push('/report/photo?mode=text' as Href)} />
      </View>
    </View>
  )

  const showFeed = !isLoading && posts.length > 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: ADINKRA_BAND_DAY }} edges={['top']}>
      <FlatList
        style={{ flex: 1, backgroundColor: ui.bg }}
        data={showFeed ? rows : []}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={brand.orange} colors={[brand.orange]} />
        }
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          showFeed && hasMore ? (
            <ActivityIndicator size="small" color={brand.orange} style={{ paddingVertical: 20 }} />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      <PulseFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filter={filter}
        onFilter={setFilter}
        places={candidates.filter((c) => c.source !== 'latest').map((c) => ({ id: c.station.id, name: c.station.name }))}
        placeId={placeId}
        onPlace={setPlaceId}
      />

      <CommentSheet
        postId={commentPostId}
        visible={commentPostId !== null}
        onClose={() => setCommentPostId(null)}
      />

      <ImageViewer
        visible={viewer !== null}
        images={viewer?.images ?? []}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        author={viewer?.author}
        caption={viewer?.caption}
      />
    </SafeAreaView>
  )
}
