import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  Animated,
  Platform,
  useWindowDimensions,
  AppState,
  type ViewToken,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronUp } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { timeAgo } from '@/lib/utils/time'
import type { TalePost } from '@/lib/types'
import ReelItem, { type ReelPost } from '@/components/reels/ReelItem'

type CachedFeed = { posts: (TalePost & { reaction_summary?: Record<string, number> })[] } | undefined

export default function ReelScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { height } = useWindowDimensions()
  // Page = the list's real height (a modal sheet can be shorter than the window).
  const [pageH, setPageH] = useState(height)
  const params = useLocalSearchParams<{
    postId: string
    videoUrl: string
    thumbnailUrl?: string
    durationSecs?: string
    displayName?: string
    deviceId?: string
    locationName?: string
    caption?: string
    timeAgo?: string
    commentCount?: string
    likeCount?: string
  }>()

  const { deviceId: myDeviceId } = useApp()

  // Fallback single item built from URL params (deep link / notification / empty cache)
  const paramPost = useMemo<ReelPost>(() => ({
    postId: params.postId,
    videoUrl: params.videoUrl,
    thumbnailUrl: params.thumbnailUrl || undefined,
    durationSecs: params.durationSecs ? parseInt(params.durationSecs, 10) : undefined,
    displayName: params.displayName,
    deviceId: params.deviceId,
    locationName: params.locationName,
    caption: params.caption,
    timeAgo: params.timeAgo,
    commentCount: parseInt(params.commentCount ?? '0', 10),
    likeCount: parseInt(params.likeCount ?? '0', 10),
  }), [params])

  // Build the list ONCE from the cached feed (video posts, feed order) so it
  // doesn't reshuffle under the user if the feed refetches mid-session.
  const [{ posts, startIndex }] = useState(() => {
    const cached = queryClient.getQueryData<CachedFeed>(['tales', myDeviceId])
    const list: ReelPost[] = (cached?.posts ?? [])
      .filter((p) => p.media_type === 'video' && !!p.video_url)
      .map((p) => {
        if (p.id === params.postId) return paramPost // keeps the tapped card's live like count
        const summary = p.reaction_summary ?? {}
        return {
          postId: p.id,
          videoUrl: p.video_url as string,
          thumbnailUrl: p.video_thumbnail_url || undefined,
          durationSecs: p.video_duration_secs ?? undefined,
          displayName: p.display_name || `User-${p.device_id.slice(-4).toUpperCase()}`,
          deviceId: p.device_id,
          locationName: p.location_name,
          caption: p.caption ?? '',
          timeAgo: timeAgo(p.created_at),
          commentCount: p.comment_count,
          likeCount: Object.values(summary).reduce((a, b) => a + b, 0),
        }
      })
    const idx = list.findIndex((p) => p.postId === params.postId)
    if (idx < 0) return { posts: [paramPost], startIndex: 0 }
    return { posts: list, startIndex: idx }
  })

  const [activeIndex, setActiveIndex] = useState(startIndex)
  const [isMuted, setIsMuted] = useState(true)
  const [isFocused, setIsFocused] = useState(true)

  // Pause everything when the screen loses focus (and on unmount)
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true)
      return () => setIsFocused(false)
    }, [])
  )
  // Also pause when the app goes to the background (and resume on return).
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'))
    return () => sub.remove()
  }, [])
  const playing = isFocused && appActive

  // "Swipe up for more" hint — multi-video lists only, fades after first swipe
  const showHint = posts.length > 1 && startIndex < posts.length - 1
  const hintOpacity = useRef(new Animated.Value(1)).current
  const hintDismissed = useRef(false)

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.index != null)
      if (!first || first.index == null) return
      setActiveIndex(first.index)
      if (first.index !== startIndex && !hintDismissed.current) {
        hintDismissed.current = true
        Animated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start()
      }
    }
  ).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: pageH, offset: pageH * index, index }),
    [pageH]
  )

  const toggleMute = useCallback(() => setIsMuted((m) => !m), [])

  // Release hint animation work on unmount
  useEffect(() => () => hintOpacity.stopAnimation(), [hintOpacity])

  const renderItem = useCallback(
    ({ item, index }: { item: ReelPost; index: number }) => (
      <ReelItem
        post={item}
        isActive={playing && index === activeIndex}
        // DATA COST: only the active item and the very next one ever load
        shouldLoad={index === activeIndex || index === activeIndex + 1}
        muted={isMuted}
        onToggleMute={toggleMute}
        height={pageH}
      />
    ),
    [activeIndex, playing, isMuted, toggleMute, pageH]
  )

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        renderItem={renderItem}
        extraData={`${activeIndex}-${playing}-${isMuted}-${pageH}`}
        pagingEnabled
        snapToInterval={pageH}
        onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h > 0 && h !== pageH) setPageH(h) }}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={getItemLayout}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === 'android'}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* ─── Top: Dismiss handle + Live Tale badge ─── */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.handleArea}
          hitSlop={16}
        >
          <View style={styles.dismissHandle} />
        </TouchableOpacity>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Pulse</Text>
        </View>
      </View>

      {showHint && (
        <Animated.View style={StyleSheet.flatten([styles.hint, { opacity: hintOpacity }])} pointerEvents="none">
          <ChevronUp size={18} color="rgba(255,255,255,0.85)" />
          <Text style={styles.hintText}>Swipe up for more</Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ─── Top bar ───
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
    zIndex: 10,
  },
  handleArea: {
    padding: 12,
  },
  dismissHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  liveText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: font.semibold,
    letterSpacing: 0.5,
  },

  // ─── Swipe hint ───
  hint: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 11,
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: font.medium,
  },
})
