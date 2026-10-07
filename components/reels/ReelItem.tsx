import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Animated,
  type GestureResponderEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { safePlayer } from '@/lib/utils/safe-player'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import {
  Play,
  Heart,
  MessageCircle,
  Share2,
  MapPin,
  Volume2,
  VolumeX,
  Plus,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { addReaction, removeReaction, fetchUserReactions } from '@/lib/services/tales'
import { useFollow } from '@/lib/hooks/useFollow'
import InitialsAvatar from '@/components/InitialsAvatar'
import { formatGHS } from '@/lib/utils/currency'
import { useReelRoute } from '@/components/reels/useReelRoute'
import SoundHint from '@/components/reels/SoundHint'

export interface ReelPost {
  postId: string
  videoUrl: string
  thumbnailUrl?: string
  durationSecs?: number
  displayName?: string
  deviceId?: string
  locationName?: string
  caption?: string
  timeAgo?: string
  commentCount: number
  likeCount: number
}

interface ReelItemProps {
  post: ReelPost
  /** This item is the visible one AND the screen is focused */
  isActive: boolean
  /** Create the player (active item + the next one only — data cost) */
  shouldLoad: boolean
  muted: boolean
  onToggleMute: () => void
  /** Open the pager-level comments sheet for this post (viewer stays open, video keeps playing) */
  onOpenComments: (postId: string) => void
  /** Fresher comment count from the pager (after posting), overrides post.commentCount */
  commentCountOverride?: number
  /** Show the one-time "Tap for sound" pill on this item */
  showSoundHint?: boolean
  onSoundHintDone?: () => void
  height: number
}

export default function ReelItem({ post, isActive, shouldLoad, muted, onToggleMute, onOpenComments, commentCountOverride, showSoundHint, onSoundHintDone, height }: ReelItemProps) {
  const router = useRouter()
  const { deviceId: myDeviceId } = useApp()

  const [isPaused, setIsPaused] = useState(false)
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likeCount)

  // Follow
  const isOwnPost = myDeviceId === post.deviceId
  const { isFollowing, toggle: toggleFollow, isLoading: followLoading } = useFollow(myDeviceId, post.deviceId || '')

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current

  // Route chip (caption → from/to → routes row). Lookup only for loaded items.
  const route = useReelRoute(post.caption, shouldLoad)

  // Double-tap heart burst (core Animated)
  const burstScale = useRef(new Animated.Value(0)).current
  const burstOpacity = useRef(new Animated.Value(0)).current
  const [burstPos, setBurstPos] = useState({ x: 0, y: 0 })
  const lastTapAt = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  const insets = useSafeAreaInsets()
  // Caption collapsed to 2 lines; tap to read it all.
  const [captionOpen, setCaptionOpen] = useState(false)
  // Overlay (name, caption, actions) fades out when this reel isn't the one in
  // focus (mid-swipe / next item) and fades back in when it settles.
  const overlayOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: isActive ? 1 : 0,
      duration: isActive ? 260 : 140,
      useNativeDriver: true,
    }).start()
    if (!isActive) setCaptionOpen(false)
  }, [isActive, overlayOpacity])

  // Fetch existing like state
  useEffect(() => {
    if (!myDeviceId || !post.postId) return
    fetchUserReactions([post.postId], myDeviceId).then((reactions) => {
      const emojis = reactions.get(post.postId) || []
      setIsLiked(emojis.includes('❤️'))
    }).catch(() => { /* like state stays default */ })
  }, [myDeviceId, post.postId])

  // Null source = no player resources, no network (thumbnail only)
  const player = useVideoPlayer(shouldLoad ? post.videoUrl : null, (p) => {
    p.loop = true
    p.muted = true
  })

  // Source dropped (scrolled away) → show thumbnail again until next first frame
  useEffect(() => {
    if (!shouldLoad) {
      setHasRenderedFirstFrame(false)
      setProgress(0)
    }
  }, [shouldLoad])

  useEffect(() => {
    if (!player) return
    safePlayer(() => { player.muted = muted })
  }, [muted, player])

  // Play only while active (and screen focused — pager folds focus into isActive);
  // pause + rewind to 0 on leaving, like Reels. Runs on unmount too — by then
  // useVideoPlayer may have released the player, hence safePlayer.
  useEffect(() => {
    if (!player || !shouldLoad) return
    if (isActive) {
      setIsPaused(false)
      safePlayer(() => player.play())
    } else {
      safePlayer(() => {
        player.pause()
        player.currentTime = 0
      })
      setProgress(0)
    }
    return () => { safePlayer(() => player.pause()) }
  }, [isActive, shouldLoad, player])

  useEffect(() => {
    if (!player || !isActive || !shouldLoad) return
    const interval = setInterval(() => {
      safePlayer(() => {
        if (player.duration > 0) setProgress(player.currentTime / player.duration)
      })
    }, 250)
    return () => clearInterval(interval)
  }, [player, isActive, shouldLoad])

  const togglePlayPause = useCallback(() => {
    if (!player || !shouldLoad) return
    setIsPaused((prev) => {
      const next = !prev
      safePlayer(() => (next ? player.pause() : player.play()))
      return next
    })
  }, [player, shouldLoad])

  const toggleLike = useCallback(async () => {
    if (!myDeviceId || !post.postId) return
    // Bounce animation
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start()

    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount((n) => n + (wasLiked ? -1 : 1))
    const success = wasLiked
      ? await removeReaction(post.postId, myDeviceId, '❤️')
      : await addReaction(post.postId, myDeviceId, '❤️')
    if (!success) {
      setIsLiked(wasLiked)
      setLikeCount((n) => n + (wasLiked ? 1 : -1))
    }
  }, [myDeviceId, post.postId, isLiked, likeScale])

  // A pending single tap must not toggle a reel the user already swiped away from.
  useEffect(() => {
    if (!isActive && tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null }
  }, [isActive])

  const DOUBLE_TAP_MS = 300
  const handleVideoPress = useCallback((e: GestureResponderEvent) => {
    const now = Date.now()
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null }
      // Like only — never unlike (Instagram behaviour). No burst if a like
      // can't actually be sent (no device id yet).
      if (!myDeviceId) return
      if (!isLiked) toggleLike()
      setBurstPos({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })
      burstScale.setValue(0.3)
      burstOpacity.setValue(1)
      Animated.parallel([
        Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(burstOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      ]).start()
      return
    }
    lastTapAt.current = now
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => { tapTimer.current = null; togglePlayPause() }, DOUBLE_TAP_MS)
  }, [isLiked, myDeviceId, toggleLike, togglePlayPause, burstScale, burstOpacity])

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this Trotro Tale from ${post.locationName ?? 'Ghana'}! 🚐`,
      })
    } catch { /* user cancelled */ }
  }, [post.locationName])

  const commentCount = commentCountOverride ?? post.commentCount
  const userName = post.displayName || `User-${(post.deviceId ?? '').slice(-4).toUpperCase()}`

  return (
    <View style={[styles.container, { height }]}>
      {/* Thumbnail while loading */}
      {!hasRenderedFirstFrame && post.thumbnailUrl ? (
        <Image
          source={{ uri: post.thumbnailUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : null}

      {/* Loading spinner (only for items that are actually loading) */}
      {shouldLoad && !hasRenderedFirstFrame && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Fullscreen video */}
      {shouldLoad && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          nativeControls={false}
          onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
        />
      )}

      {/* Tap to play/pause */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleVideoPress}
        accessibilityLabel="Video. Activate to pause or play."
        accessibilityRole="button"
      >
        {isPaused && (
          <View style={styles.playOverlay}>
            <View style={styles.playBtn}>
              <Play size={44} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
        <Animated.View
          pointerEvents="none"
          style={StyleSheet.flatten([
            styles.burst,
            { left: burstPos.x - 55, top: burstPos.y - 55, opacity: burstOpacity, transform: [{ scale: burstScale }] },
          ])}
        >
          <Heart size={110} color="#ef4444" fill="#ef4444" />
        </Animated.View>
      </Pressable>

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Readability gradient under the text (fades with the overlay) */}
      <Animated.View pointerEvents="none" style={StyleSheet.flatten([styles.bottomShade, { opacity: overlayOpacity }])}>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFillObject} />
      </Animated.View>

      {/* ─── Right action bar ─── */}
      <Animated.View
        pointerEvents={isActive ? 'auto' : 'none'}
        style={StyleSheet.flatten([styles.actionBar, { bottom: insets.bottom + 150, opacity: overlayOpacity }])}
      >
        {/* Profile avatar with + button */}
        <View style={styles.profileAction}>
          <View style={styles.avatarBorder}>
            <InitialsAvatar
              name={post.displayName ?? null}
              deviceId={post.deviceId ?? ''}
              size={44}
            />
          </View>
          <View style={styles.plusBadge}>
            <Plus size={10} color="#fff" strokeWidth={3} />
          </View>
        </View>

        {/* Like */}
        <TouchableOpacity
          onPress={toggleLike}
          activeOpacity={0.7}
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? `Unlike. ${likeCount} likes` : `Like. ${likeCount} likes`}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Heart
              size={30}
              color={isLiked ? '#ef4444' : '#fff'}
              fill={isLiked ? '#ef4444' : 'transparent'}
            />
          </Animated.View>
          <Text style={styles.actionLabel}>{likeCount}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          onPress={() => onOpenComments(post.postId)}
          activeOpacity={0.7}
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel={`Comments. ${commentCount} comments`}
        >
          <MessageCircle size={28} color="#fff" />
          <Text style={styles.actionLabel}>{commentCount}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel="Share"
        >
          <Share2 size={26} color="#fff" />
        </TouchableOpacity>

        {/* Sound toggle */}
        <View>
          <TouchableOpacity
            onPress={onToggleMute}
            activeOpacity={0.7}
            style={styles.soundBtn}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
          >
            {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
          </TouchableOpacity>
          {showSoundHint && isActive && onSoundHintDone ? <SoundHint onDone={onSoundHintDone} /> : null}
        </View>
      </Animated.View>

      {/* ─── Bottom overlay ─── */}
      <Animated.View
        pointerEvents={isActive ? 'box-none' : 'none'}
        style={StyleSheet.flatten([styles.bottomContent, { bottom: insets.bottom + 28, opacity: overlayOpacity }])}
      >
        {/* @username + Follow */}
        <View style={styles.userRow}>
          <Text style={styles.userName}>@{userName}</Text>
          {!isOwnPost && (
            <TouchableOpacity
              style={StyleSheet.flatten([styles.followBtn, isFollowing && styles.followingBtn])}
              activeOpacity={0.7}
              onPress={toggleFollow}
              disabled={followLoading}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? `Unfollow ${userName}` : `Follow ${userName}`}
            >
              <Text style={StyleSheet.flatten([styles.followText, isFollowing && styles.followingText])}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Location pill */}
        {post.locationName ? (
          <View style={styles.locationPill}>
            <MapPin size={12} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.locationPillText} numberOfLines={1}>{post.locationName}</Text>
            {post.timeAgo ? (
              <Text style={styles.locationPillText}> · {post.timeAgo}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Caption */}
        {post.caption ? (
          <Text
            style={styles.caption}
            numberOfLines={captionOpen ? undefined : 2}
            onPress={() => setCaptionOpen((v) => !v)}
            suppressHighlighting
            accessibilityRole="button"
            accessibilityHint={captionOpen ? 'Collapse caption' : 'Show full caption'}
          >
            {post.caption}
            {captionOpen ? <Text style={styles.captionMore}>  less</Text> : null}
          </Text>
        ) : null}
        {post.caption && !captionOpen && post.caption.length > 70 ? (
          <Text style={styles.captionMore} onPress={() => setCaptionOpen(true)} suppressHighlighting>…more</Text>
        ) : null}

        {/* Route chip — from the caption, fare only if a real route row resolved */}
        {route ? (
          route.routeId ? (
            <TouchableOpacity
              style={styles.routeChip}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/routes/[id]', params: { id: route.routeId as string } })}
              accessibilityRole="button"
              accessibilityLabel={`View route ${route.from} to ${route.to}`}
            >
              <Text style={styles.routeChipText} numberOfLines={1}>
                📍 {route.from} → {route.to}
                {route.officialFare != null ? ` · ${formatGHS(route.officialFare)}` : ''} · View route
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.routeChip}>
              <Text style={styles.routeChipText} numberOfLines={1}>{route.from} → {route.to}</Text>
            </View>
          )
        ) : null}
      </Animated.View>

      {/* ─── Amber progress bar ─── */}
      <View style={styles.progressTrack}>
        <View style={StyleSheet.flatten([styles.progressFill, { width: `${Math.round(progress * 100)}%` }])} />
        <View style={StyleSheet.flatten([styles.progressGlow, { left: `${Math.round(progress * 100)}%` }])} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // ─── Bottom gradient ───
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 350,
    zIndex: 2,
  },

  // ─── Right action bar ───
  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 180,
    alignItems: 'center',
    gap: 20,
    zIndex: 8,
  },
  profileAction: {
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: font.semibold,
  },
  soundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  burst: {
    position: 'absolute',
    width: 110,
    height: 110,
  },

  // ─── Bottom content overlay ───
  bottomContent: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    right: 72,
    zIndex: 5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  userName: {
    color: '#fff',
    fontFamily: font.bold,
    fontSize: 16,
  },
  followBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  followText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: font.semibold,
  },
  followingBtn: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  followingText: {
    color: '#1c1917',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  locationPillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: font.medium,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    zIndex: 4,
  },
  captionMore: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: font.semibold,
    marginTop: -4,
    marginBottom: 8,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.regular,
    marginBottom: 8,
  },
  routeChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    maxWidth: '100%',
  },
  routeChipText: {
    color: '#1c1917',
    fontSize: 12,
    fontFamily: font.semibold,
  },

  // ─── Amber progress bar ───
  progressTrack: {
    position: 'absolute',
    bottom: 34,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },
  progressGlow: {
    position: 'absolute',
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    marginLeft: -4,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
})
