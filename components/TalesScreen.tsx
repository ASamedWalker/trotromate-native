import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Alert,
  Share,
  DeviceEventEmitter,
  Animated,
  ScrollView,
  TouchableWithoutFeedback,
  GestureResponderEvent,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { RELEASE_MODE as REDESIGN } from '@/lib/config/release'
import { useRouter, type Href } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import {
  MessageCircle,
  MapPin,
  Camera,
  Trash2,
  Flag,
  MoreHorizontal,
  Heart,
  Send,
  Play,
  X,
} from 'lucide-react-native'
import { SvgXml } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { adinkraXml } from '@/lib/brand/adinkra'
import { brand, ui, radius, space, font } from '@/lib/theme'
import { Button, Tap } from '@/components/ui'
import ReanimatedAnimated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/contexts/AppContext'
import { useTalesFeed } from '@/lib/hooks/useTales'
import { timeAgo } from '@/lib/utils/time'
import InitialsAvatar from '@/components/InitialsAvatar'
import CommentSheet from '@/components/CommentSheet'
import ReactionBar from '@/components/ReactionBar'
import { SkeletonTaleCard } from '@/components/Skeleton'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import ImageCarousel from '@/components/ImageCarousel'
import ImageViewer from '@/components/ImageViewer'
import { LEVELS, REPORT_POINTS } from '@/lib/constants/rewards'
import type { TalePost } from '@/lib/types'
import { pulseKind, extractRoute, extractAmount, parseComposerFare } from '@/lib/utils/pulse-extract'
import { fetchBotAnswer, type BotAnswer } from '@/lib/services/pulse-bot'
import { LoadErrorState } from '@/components/StateViews'

const HELPER_DISMISSED_KEY = '@troski_pulse_helper_dismissed_v1'
const helperGlyph = adinkraXml('nyansapo', 56, '#E8461A')
const emptyGlyph = adinkraXml('nteasee', 44, '#D6CFC8')

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Contributor tier badge (REAL data) ─────────────────
// Reads the author's actual rewards tier (merged from
// contributor_profiles in fetchTales). No fabricated labels.

function getContributorBadge(post: TalePost): { label: string; color: string; ringColor: string } | null {
  if (!post.author_level) return null
  const lvl = LEVELS[post.author_level]
  if (!lvl) return null
  return { label: `${lvl.emoji} ${lvl.name}`, color: lvl.color, ringColor: lvl.color }
}

function getDisplayName(post: TalePost): string {
  if (post.display_name) return post.display_name
  return `User-${post.device_id.slice(-4).toUpperCase()}`
}

// ─── Double-tap like overlay ────────────────────────────

const DOUBLE_TAP_MS = 350

function DoubleTapLike({
  onDoubleTap,
  onSingleTap,
  edgeGuard,
  children,
}: {
  onDoubleTap: () => void
  onSingleTap?: () => void
  /** Ignore single taps this close (px) to the left/right edge of a `width`-wide media (carousel chevrons). */
  edgeGuard?: { width: number; inset: number }
  children: React.ReactNode
}) {
  const heartScale = useRef(new Animated.Value(0)).current
  const heartOpacity = useRef(new Animated.Value(0)).current
  const lastTap = useRef(0)
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (singleTimer.current) clearTimeout(singleTimer.current) }, [])

  // Plain JS tap timing instead of RNGH Gesture.Exclusive(double, single):
  // on device the exclusive single tap never fired (double tap did), so the
  // photo viewer couldn't open. A second tap within DOUBLE_TAP_MS = like;
  // otherwise the single tap fires after that window. Scrolls cancel the press.
  const handlePress = (e: GestureResponderEvent) => {
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      if (singleTimer.current) { clearTimeout(singleTimer.current); singleTimer.current = null }
      onDoubleTap()
      heartScale.setValue(0)
      heartOpacity.setValue(1)
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 12 }),
        Animated.delay(400),
        Animated.timing(heartOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
      return
    }
    lastTap.current = now
    if (!onSingleTap) return
    const x = e.nativeEvent.locationX
    if (edgeGuard && (x < edgeGuard.inset || x > edgeGuard.width - edgeGuard.inset)) return
    if (singleTimer.current) clearTimeout(singleTimer.current)
    singleTimer.current = setTimeout(() => { singleTimer.current = null; onSingleTap() }, DOUBLE_TAP_MS)
  }

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      accessibilityRole={onSingleTap ? 'imagebutton' : undefined}
      accessibilityLabel={onSingleTap ? 'Open photo. Double tap quickly to like.' : undefined}
    >
      <View>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.doubleTapHeart,
            { transform: [{ scale: heartScale }], opacity: heartOpacity },
          ]}
        >
          <Heart size={80} color={ui.onBrand} fill={ui.onBrand} />
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  )
}

// ─── Pulse kinds (type chip + filters) ──────────────────

const KIND_CHIP: Record<'fare' | 'question' | 'queue' | 'moment', { label: string; bg: string; fg: string }> = {
  fare: { label: 'Fare', bg: '#FFEDE5', fg: '#B4320B' },
  question: { label: 'Question', bg: '#E6EEFF', fg: '#1D4ED8' },
  queue: { label: 'Queue', bg: '#FDE8E8', fg: '#B91C1C' },
  moment: { label: 'Moment', bg: '#EFEAFE', fg: '#6D28D9' },
}

type PulseFilter = 'all' | 'fare' | 'question' | 'queue' | 'moment'

const FILTER_EMPTY: Record<Exclude<PulseFilter, 'all'>, string> = {
  fare: 'No fare posts yet.',
  question: 'No questions yet.',
  queue: 'No queue updates yet.',
  moment: 'No photos or videos yet.',
}

const FILTERS: { key: PulseFilter; label: string; bg: string; fg: string }[] = [
  { key: 'all', label: 'All', bg: '#FFFFFF', fg: '#1C1917' },
  { key: 'fare', label: 'Fares', bg: '#FFEDE5', fg: '#B4320B' },
  { key: 'question', label: 'Questions', bg: '#E6EEFF', fg: '#1D4ED8' },
  { key: 'queue', label: 'Queues', bg: '#FDE8E8', fg: '#B91C1C' },
  { key: 'moment', label: 'Moments', bg: '#EFEAFE', fg: '#6D28D9' },
]

function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`
}


function renderCaption(text: string, s: ReturnType<typeof cardStyles>) {
  return text.split(/(#\w+)/g).map((part, i) =>
    part.startsWith('#') ? (
      <Text key={i} style={s.hashtag}>{part}</Text>
    ) : part
  )
}

// ─── TaleCard ───────────────────────────────────────────

const CARD_MEDIA_W = SCREEN_W - 32 - 32 - 2 // list margin + card padding + border

const TaleCard = React.memo(function TaleCard({
  post,
  isDark,
  reactionSummary,
  userReactions,
  isOwn,
  onReact,
  onComment,
  onDelete,
  onReport,
  onProfilePress,
  onVideoPress,
  onOpenImages,
}: {
  post: TalePost
  isDark: boolean
  reactionSummary: Record<string, number>
  userReactions: string[]
  isOwn: boolean
  onReact: (emoji: string) => void
  onComment: () => void
  onDelete?: () => void
  onReport: () => void
  onProfilePress: () => void
  onVideoPress?: () => void
  onOpenImages: (post: TalePost, images: string[], index: number) => void
}) {
  const s = cardStyles()
  const [showMenu, setShowMenu] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [localLiked, setLocalLiked] = useState(userReactions.includes('❤️'))
  const badge = getContributorBadge(post)
  const displayName = getDisplayName(post)
  const kind = pulseKind(post)
  const chip = kind === 'post' ? null : KIND_CHIP[kind]

  const caption = post.caption ?? ''
  // Composer posts parse exactly; free-text fare posts fall back to the heuristics.
  const composed = kind === 'fare' ? parseComposerFare(caption) : null
  const fareRoute = composed ?? (kind === 'fare' ? extractRoute(caption) : null)
  const fareAmount = composed ? composed.amount : kind === 'fare' ? extractAmount(caption) : null
  const showFareCard = !!(fareRoute && fareAmount != null)
  // Under a composer fare card show only the note; free-text posts show in full.
  const bodyText = composed ? composed.note : caption

  // Troski Bot answer for question posts (fetched per visible card, cached in the service)
  const [bot, setBot] = useState<BotAnswer | null>(null)
  const [botLoading, setBotLoading] = useState(kind === 'question')
  useEffect(() => {
    if (kind !== 'question') return
    let cancelled = false
    setBotLoading(true)
    fetchBotAnswer(post.id).then((ans) => {
      if (cancelled) return
      setBot(ans)
      setBotLoading(false)
    })
    return () => { cancelled = true }
  }, [kind, post.id])
  const botText =
    bot && (bot.status === 'no_route' || bot.status === 'not_found' || bot.status === 'found') ? bot.text : null

  // Sync localLiked with userReactions prop
  useEffect(() => {
    setLocalLiked(userReactions.includes('❤️'))
  }, [userReactions])

  const totalReactions = Object.values(reactionSummary).reduce((a, b) => a + b, 0)
  const heartCount = reactionSummary['❤️'] ?? (totalReactions > 0 ? totalReactions : 0)

  const photoUrls = useMemo(
    () => (post.image_url ? (post.image_urls && post.image_urls.length > 0 ? post.image_urls : [post.image_url]) : []),
    [post.image_url, post.image_urls],
  )
  const isPhoto = !(post.media_type === 'video' && post.video_url) && photoUrls.length > 0
  const handleOpenImages = useCallback(() => {
    onOpenImages(post, photoUrls, imageIndex)
  }, [onOpenImages, post, photoUrls, imageIndex])

  const handleDoubleTapLike = useCallback(() => {
    if (!localLiked) {
      onReact('❤️')
      setLocalLiked(true)
    }
  }, [localLiked, onReact])

  const handleLikePress = useCallback(() => {
    setLocalLiked(!localLiked)
    onReact('❤️')
  }, [localLiked, onReact])

  const handleDelete = useCallback(() => {
    setShowMenu(false)
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ])
  }, [onDelete])

  const handleReport = useCallback(() => {
    setShowMenu(false)
    onReport()
  }, [onReport])

  const handleShare = useCallback(() => {
    const loc = post.location_name ?? ''
    const cap = post.caption ? `\n"${post.caption}"` : ''
    Share.share({
      message: `${displayName} shared a commuter tale from ${loc} on Troski${cap}\n\nDownload Troski: https://troski.me`,
    })
  }, [post.location_name, post.caption, displayName])

  const hasMedia = post.media_type !== 'text' && (post.media_type === 'video' ? !!post.video_url : !!post.image_url)

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${displayName} profile`}>
          <InitialsAvatar name={post.display_name} deviceId={post.device_id} size={42} />
        </TouchableOpacity>

        <View style={s.headerInfo}>
          <Text numberOfLines={1} style={s.nameLine}>
            <Text style={s.name} onPress={onProfilePress}>{displayName}</Text>
            {badge ? <Text style={s.meta}>{` · ${badge.label.replace(/^\S+\s/, '')}`}</Text> : null}
          </Text>
          <View style={s.headerMeta}>
            {post.location_name ? <MapPin size={14} color="#57534E" /> : null}
            <Text style={s.locationText} numberOfLines={1}>
              {post.location_name ? `${post.location_name} · ${timeAgo(post.created_at)}` : timeAgo(post.created_at)}
            </Text>
          </View>
        </View>

        {chip && (
          <View style={[s.typeChip, { backgroundColor: chip.bg }]}>
            <Text style={[s.typeChipText, { color: chip.fg }]}>{chip.label}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setShowMenu(!showMenu)}
          style={s.menuBtn}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <MoreHorizontal size={20} color="#57534E" />
        </TouchableOpacity>
      </View>

      {/* Menu dropdown */}
      {showMenu && (
        <>
          <Pressable style={s.menuOverlay} onPress={() => setShowMenu(false)} />
          <View style={s.menuDropdown}>
            {!isOwn && (
              <TouchableOpacity onPress={handleReport} activeOpacity={0.7} style={s.menuItem}>
                <Flag size={16} color={ui.textSecondary} />
                <Text style={s.menuItemText}>Report</Text>
              </TouchableOpacity>
            )}
            {isOwn && onDelete && (
              <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={s.menuItem}>
                <Trash2 size={16} color={ui.danger} />
                <Text style={s.menuItemTextDanger}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ── Fare card ── */}
      {showFareCard && fareRoute && fareAmount != null && (
        <View style={s.fareCard}>
          <View style={s.fareLeft}>
            <Text style={s.farePaid}>Paid</Text>
            <Text style={s.fareAmount}>{`₵${fareAmount.toFixed(2)}`}</Text>
          </View>
          <View style={s.fareRight}>
            <Text style={s.fareRoute} numberOfLines={2}>{`${fareRoute.from} → ${fareRoute.to}`}</Text>
            <Text style={s.fareSub}>Commuter report on Troski</Text>
          </View>
        </View>
      )}

      {/* ── Body text ── */}
      {bodyText ? <Text style={s.bodyText}>{renderCaption(bodyText, s)}</Text> : null}

      {/* ── Troski Bot answer (questions) ── */}
      {kind === 'question' && botLoading && (
        <View style={s.botBox}>
          <View style={s.botSkeleton} />
        </View>
      )}
      {kind === 'question' && !botLoading && botText ? (
        <View style={s.botBox}>
          <View style={s.botTitleRow}>
            <MapPin size={18} color="#F5A300" fill="#F5A300" />
            <Text style={s.botTitle}>Troski Bot answer</Text>
          </View>
          <Text style={s.botText}>{botText}</Text>
        </View>
      ) : null}
      {kind === 'question' && (
        <Tap
          onPress={onComment}
          style={s.answerBtn}
          accessibilityRole="button"
          accessibilityLabel="Answer this question and earn 8 coins"
        >
          <Text style={s.answerBtnText}>Answer this · +8 coins</Text>
        </Tap>
      )}

      {/* ── Media ── */}
      {hasMedia && (
        <DoubleTapLike onDoubleTap={handleDoubleTapLike} onSingleTap={isPhoto ? handleOpenImages : undefined}
          edgeGuard={photoUrls.length > 1 ? { width: CARD_MEDIA_W, inset: 56 } : undefined}
        >
          <View style={s.mediaWrap}>
            {post.media_type === 'video' && post.video_url ? (
              <Pressable
                onPress={onVideoPress}
                accessibilityRole="button"
                accessibilityLabel="Play video"
                style={s.videoTile}
              >
                {post.video_thumbnail_url ? (
                  <>
                    {/* Phone videos are portrait: show the WHOLE frame (contain) over a
                        blurred copy of itself, instead of cropping a strip from the middle. */}
                    <ExpoImage
                      source={{ uri: post.video_thumbnail_url }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      blurRadius={Platform.OS === 'android' ? 0 : 24}
                      cachePolicy="disk"
                    />
                    <View style={s.videoBackdropDim} />
                    <ExpoImage
                      source={{ uri: post.video_thumbnail_url }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="contain"
                      cachePolicy="disk"
                    />
                  </>
                ) : null}
                <View style={s.videoPlayOverlay}>
                  <View style={s.videoPlayBtn}>
                    <Play size={30} color={ui.onBrand} fill={ui.onBrand} />
                  </View>
                  <Text style={s.videoHint}>
                    {post.video_duration_secs != null
                      ? `Tap to play · ${formatDuration(post.video_duration_secs)}`
                      : 'Tap to play'}
                  </Text>
                </View>
              </Pressable>
            ) : post.image_url ? (
              <ImageCarousel
                images={photoUrls}
                width={CARD_MEDIA_W}
                onIndexChange={setImageIndex}
              />
            ) : null}
          </View>
        </DoubleTapLike>
      )}

      {/* ── Footer ── */}
      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleLikePress}
          onLongPress={() => setShowPicker((v) => !v)}
          activeOpacity={0.7}
          style={s.pill}
          accessibilityRole="button"
          accessibilityLabel={`${totalReactions} reactions`}
          accessibilityHint="Double tap to like, long press for more reactions"
        >
          <Heart
            size={20}
            color={localLiked ? ui.danger : '#57534E'}
            fill={localLiked ? ui.danger : 'transparent'}
          />
          {heartCount > 0 && <Text style={s.pillText}>{heartCount.toLocaleString()}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onComment}
          activeOpacity={0.7}
          style={s.pill}
          accessibilityRole="button"
          accessibilityLabel={post.comment_count > 0 ? `${post.comment_count} comments` : 'Comment'}
        >
          <MessageCircle size={20} color="#57534E" />
          <Text style={s.pillText}>{post.comment_count > 0 ? String(post.comment_count) : 'Comment'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          hitSlop={8}
          style={s.shareBtn}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <Send size={20} color="#57534E" />
        </TouchableOpacity>
      </View>

      {showPicker && (
        <ReactionBar
          reactionSummary={reactionSummary}
          userReactions={userReactions}
          onReact={onReact}
          compact
        />
      )}
    </View>
  )
})

// ─── Main Screen ────────────────────────────────────────

const PULSE_BAND = '#FFF3EA'

export function TalesScreen() {
  const topInset = useSafeAreaInsets().top
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { deviceId, profile } = useApp()
  const {
    posts, isLoading, isError, retry, isRefreshing, hasMore,
    userReactions, reactionSummaries,
    refresh, loadMore, toggleReaction, deletePost,
  } = useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])
  const haptics = useHaptics()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PulseFilter>('all')
  const [viewer, setViewer] = useState<{ images: string[]; index: number; author: string; caption: string } | null>(null)
  // Stable so TaleCard's memo isn't defeated; takes the post's data from the card.
  const handleOpenImages = useCallback((post: TalePost, images: string[], index: number) => {
    const cap = post.caption ?? ''
    const composed = pulseKind(post) === 'fare' ? parseComposerFare(cap) : null
    setViewer({ images, index, author: getDisplayName(post), caption: composed ? composed.note : cap })
  }, [])
  const closeViewer = useCallback(() => setViewer(null), [])
  const visiblePosts = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => pulseKind(p) === filter)),
    [posts, filter],
  )

  // Listen for comment open signal from reel screen
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sub = DeviceEventEmitter.addListener('openComment', (postId: string) => {
      timer = setTimeout(() => setCommentPostId(postId), 300)
    })
    return () => { sub.remove(); clearTimeout(timer) }
  }, [])

  const handleReact = (postId: string, emoji: string) => {
    haptics.light()
    toggleReaction(postId, emoji)
  }

  const handleReport = (postId: string) => {
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
  }

  // useCallback: an inline renderItem is a new function on every render, which
  // makes FlatList treat every row as changed and defeats TaleCard's memo.
  const renderItem = useCallback(({ item }: { item: TalePost }) => {
    return (
      <TaleCard
        post={item}
        isDark={isDark}
        reactionSummary={reactionSummaries.get(item.id) || {}}
        userReactions={userReactions.get(item.id) || []}
        isOwn={item.device_id === deviceId}
        onReact={(emoji) => handleReact(item.id, emoji)}
        onComment={() => setCommentPostId(item.id)}
        onDelete={() => deletePost(item.id)}
        onReport={() => handleReport(item.id)}
        onProfilePress={() => router.push(`/profile/${item.device_id}` as Href)}
        onOpenImages={handleOpenImages}
        onVideoPress={item.media_type === 'video' && item.video_url ? () => {
          const dn = item.display_name || `User-${item.device_id.slice(-4).toUpperCase()}`
          const summary = reactionSummaries.get(item.id) || {}
          const lc = Object.values(summary).reduce((a, b) => a + b, 0)
          router.push(
            `/reel?postId=${item.id}&videoUrl=${encodeURIComponent(item.video_url!)}&thumbnailUrl=${encodeURIComponent(item.video_thumbnail_url ?? '')}&durationSecs=${item.video_duration_secs ?? 0}&displayName=${encodeURIComponent(dn)}&deviceId=${item.device_id}&locationName=${encodeURIComponent(item.location_name)}&caption=${encodeURIComponent(item.caption ?? '')}&timeAgo=${encodeURIComponent(timeAgo(item.created_at))}&commentCount=${item.comment_count}&likeCount=${lc}` as Href
          )
        } : undefined}
      />
    )
  }, [isDark, reactionSummaries, userReactions, deviceId, handleReact, deletePost, handleReport, router, handleOpenImages])

  const [helperDismissed, setHelperDismissed] = useState(true) // hidden until storage is read, avoids a flash
  useEffect(() => {
    AsyncStorage.getItem(HELPER_DISMISSED_KEY)
      .then((v) => setHelperDismissed(v === '1'))
      .catch(() => setHelperDismissed(false))
  }, [])
  const dismissHelper = useCallback(() => {
    setHelperDismissed(true)
    AsyncStorage.setItem(HELPER_DISMISSED_KEY, '1').catch(() => {})
  }, [])

  const header = (
    <View style={REDESIGN ? { backgroundColor: PULSE_BAND, overflow: 'hidden' } : undefined}>
      {/* Store release: Adinkra wallpaper behind the tab header (redesign) */}
      {REDESIGN ? <AdinkraWallpaper width={Dimensions.get('window').width} height={220} size={26} color="rgba(232,70,26,0.10)" /> : null}
      <View style={s.titleWrap}>
        <Text style={s.title}>Pulse</Text>
        <Text style={s.subtitle}>From the road, by commuters</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        style={s.chipScroll}
      >
        {FILTERS.map((f) => {
          const selected = filter === f.key
          const isAll = f.key === 'all'
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${f.label}`}
              style={{
                paddingHorizontal: 16,
                height: 38,
                borderRadius: 19,
                justifyContent: 'center',
                backgroundColor: isAll ? (selected ? '#1C1917' : '#FFFFFF') : f.bg,
                borderWidth: 1.5,
                borderColor: isAll ? (selected ? '#1C1917' : '#E7E5E4') : selected ? f.fg : f.bg,
              }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 22, color: isAll && selected ? '#FFFFFF' : f.fg }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    {/* Compose bar — single entry point for text + photo/video */}
    <ReanimatedAnimated.View entering={FadeInDown.delay(100).duration(400)} style={s.composeBar}>
      <View style={s.composeAvatar}>
        <InitialsAvatar name={profile?.display_name ?? null} deviceId={deviceId ?? ''} size={36} />
      </View>
      <TouchableOpacity
        onPress={() => router.push('/report/photo?mode=text' as Href)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Write a post"
        style={s.composeInput}
      >
        <Text style={s.composePlaceholder}>What&apos;s happening?</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/report/photo' as Href)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Post a photo or video"
        style={s.composeCamera}
      >
        <Camera size={20} color={isDark ? '#a8a29e' : ui.textSecondary} />
      </TouchableOpacity>
    </ReanimatedAnimated.View>
    {!helperDismissed && (
      <View style={s.helperCard}>
        <SvgXml xml={helperGlyph} width={56} height={56} />
        <View style={{ flex: 1 }}>
          <Text style={s.helperTitle}>Know the way? Share it.</Text>
          <Text style={s.helperBody}>
            Nyansapo, the wisdom knot. Answer a rider&apos;s question and earn +{REPORT_POINTS.tale} coins.
          </Text>
        </View>
        <TouchableOpacity
          onPress={dismissHelper}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tip"
          style={s.helperClose}
        >
          <X size={16} color={ui.textSecondary} />
        </TouchableOpacity>
      </View>
    )}
    </View>
  )

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {REDESIGN ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topInset, backgroundColor: PULSE_BAND }} /> : null}
      {!isLoading && posts.length > 0 ? null : header}

      {isLoading ? (
        <View style={{ paddingTop: 12 }}>
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
        </View>
      ) : isError && posts.length === 0 ? (
        <View style={s.centered}>
          <LoadErrorState message="Couldn't load the feed. Check your connection." onRetry={() => retry()} />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.centered}>
          <SvgXml xml={emptyGlyph} width={44} height={44} />
          <Text style={s.emptyTitle}>No posts yet</Text>
          <Text style={s.emptySub}>Share a fare, a queue update, or a trotro moment!</Text>
          <View style={{ marginTop: 20 }}>
            <Button
              label="Post to Pulse"
              fullWidth={false}
              onPress={() => router.push('/report/photo?mode=text' as Href)}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          ListHeaderComponent={header}
          ListEmptyComponent={
            filter !== 'all' ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 17, lineHeight: 24, color: ui.text, textAlign: 'center' }}>
                  {FILTER_EMPTY[filter]}
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 22, color: ui.textSecondary, textAlign: 'center', marginTop: 4 }}>
                  Share one and help the next rider.
                </Text>
                <View style={{ marginTop: 16 }}>
                  <Button
                    label="Post"
                    fullWidth={false}
                    onPress={() => router.push('/report/photo?mode=text' as Href)}
                  />
                </View>
              </View>
            ) : (
              <Text style={s.emptySub}>Nothing here yet. Be the first to post.</Text>
            )
          }
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={brand.orange} />
          }
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color={brand.orange} style={{ paddingVertical: 20 }} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <CommentSheet
        postId={commentPostId}
        visible={commentPostId !== null}
        onClose={() => setCommentPostId(null)}
      />

      <ImageViewer
        visible={viewer !== null}
        images={viewer?.images ?? []}
        initialIndex={viewer?.index ?? 0}
        onClose={closeViewer}
        author={viewer?.author}
        caption={viewer?.caption}
      />
    </SafeAreaView>
  )
}

// ─── Double-tap heart overlay style ─────────────────────

const styles = StyleSheet.create({
  doubleTapHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})

// ─── Card Styles ────────────────────────────────────────

const cardStyles = () => {
  return StyleSheet.create({
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#EEEAE6',
      padding: 16,
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 14,
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerInfo: {
      flex: 1,
    },
    nameLine: {
      lineHeight: 24,
    },
    name: {
      fontFamily: font.bold,
      fontSize: 17,
      lineHeight: 24,
      color: '#1C1917',
    },
    meta: {
      fontFamily: font.regular,
      fontSize: 14,
      lineHeight: 20,
      color: '#57534E',
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationText: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: font.regular,
      color: '#57534E',
      flex: 1,
    },
    typeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    typeChipText: {
      fontFamily: font.bold,
      fontSize: 13,
      lineHeight: 18,
    },
    menuBtn: {
      width: 28,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Body ──
    bodyText: {
      fontFamily: font.regular,
      fontSize: 18,
      lineHeight: 27,
      color: '#1C1917',
    },
    hashtag: {
      color: ui.info,
      fontFamily: font.semibold,
    },

    // ── Fare card ──
    fareCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFF6F1',
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    fareLeft: {},
    farePaid: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: '#9A3412' },
    fareAmount: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 42, color: '#1C1917' },
    fareRight: { flex: 1 },
    fareRoute: { fontFamily: font.bold, fontSize: 16, lineHeight: 24, color: '#1C1917' },
    fareSub: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: '#57534E' },

    // ── Troski Bot box ──
    botBox: {
      backgroundColor: '#FFF8E8',
      borderRadius: 18,
      padding: 14,
      gap: 6,
    },
    botTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    botTitle: { fontFamily: font.bold, fontSize: 16, lineHeight: 24, color: '#7C4A03' },
    botText: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: '#1C1917' },
    botSkeleton: { height: 14, borderRadius: 7, backgroundColor: '#F3E3BC', width: '70%' },
    answerBtn: {
      height: 46,
      borderRadius: 14,
      backgroundColor: brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    answerBtnText: { fontFamily: font.bold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },

    // ── Media ──
    mediaWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: ui.bg,
    },
    // 4:5 like Instagram's feed: tall enough for portrait phone videos without
    // taking over the whole screen; landscape videos letterbox over the blur.
    videoTile: {
      width: '100%',
      aspectRatio: 4 / 5,
      backgroundColor: '#1C1917',
    },
    videoBackdropDim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    videoPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.12)',
      gap: 8,
    },
    videoPlayBtn: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 4,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    videoHint: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: '#FFFFFF' },

    // ── Footer ──
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      backgroundColor: '#F5F5F4',
    },
    pillText: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: '#44403C' },
    shareBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // ── Menu ──
    menuOverlay: {
      position: 'absolute',
      top: -200,
      left: -400,
      right: -400,
      bottom: -800,
      zIndex: 10,
    },
    menuDropdown: {
      position: 'absolute',
      right: 16,
      top: 56,
      zIndex: 20,
      backgroundColor: ui.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: ui.hairline,
      paddingVertical: 4,
      minWidth: 150,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    menuItemText: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: font.medium,
      color: ui.text,
    },
    menuItemTextDanger: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: font.medium,
      color: ui.danger,
    },
  })
}

// ─── Screen Styles ──────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = ui.bg
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.45)' : ui.textSecondary

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    helperCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#FFF7F3', borderWidth: 1, borderColor: '#FFE1D4', borderRadius: 18,
      padding: 14, marginHorizontal: 16, marginTop: 12,
    },
    helperTitle: { fontFamily: font.bold, fontSize: 15, color: '#111111' },
    helperBody: { fontFamily: font.regular, fontSize: 13, color: '#6B7280', marginTop: 2 },
    helperClose: { alignSelf: 'flex-start' },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: onSurfaceVariant, marginTop: 16 },
    emptySub: { fontSize: 14, fontFamily: font.regular, color: onSurfaceVariant, marginTop: 4, textAlign: 'center' },

    titleWrap: { paddingHorizontal: 20, paddingTop: 8 },
    title: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 42, color: '#1C1917' },
    subtitle: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: ui.textSecondary },
    chipScroll: { flexGrow: 0, marginTop: 12 },
    chipRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },

    // Threads-style compose bar
    composeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.gutter,
      paddingVertical: 12,
      gap: 12,
      marginBottom: 4,
    },
    composeAvatar: {},
    composeInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: space.lg,
      borderRadius: radius.pill,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : ui.surface,
    },
    composePlaceholder: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    composeCamera: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : ui.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
