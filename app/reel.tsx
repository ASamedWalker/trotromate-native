import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Share,
  DeviceEventEmitter,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MapPin,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { addReaction, removeReaction, fetchUserReactions } from '@/lib/services/tales'
import InitialsAvatar from '@/components/InitialsAvatar'

export default function ReelScreen() {
  const router = useRouter()
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

  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(
    params.durationSecs ? parseFloat(params.durationSecs) : 0
  )
  const [progress, setProgress] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(parseInt(params.likeCount ?? '0', 10))
  const [isSaved, setIsSaved] = useState(false)

  // Fetch existing like state from API
  useEffect(() => {
    if (!myDeviceId || !params.postId) return
    fetchUserReactions([params.postId], myDeviceId).then((reactions) => {
      const emojis = reactions.get(params.postId) || []
      setIsLiked(emojis.includes('❤️'))
    })
  }, [myDeviceId, params.postId])

  const player = useVideoPlayer(params.videoUrl, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  useEffect(() => {
    if (!player) return
    player.muted = isMuted
  }, [isMuted, player])

  useEffect(() => {
    if (!player) return
    const interval = setInterval(() => {
      if (player.duration > 0) {
        setDuration(player.duration)
        setCurrentTime(player.currentTime)
        setProgress(player.currentTime / player.duration)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [player])

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m)
  }, [])

  const togglePlayPause = useCallback(() => {
    if (!player) return
    setIsPaused((prev) => {
      const next = !prev
      if (next) player.pause()
      else player.play()
      return next
    })
  }, [player])

  const toggleLike = useCallback(async () => {
    if (!myDeviceId || !params.postId) return
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    const success = wasLiked
      ? await removeReaction(params.postId, myDeviceId, '❤️')
      : await addReaction(params.postId, myDeviceId, '❤️')
    if (!success) {
      setIsLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
    }
  }, [myDeviceId, params.postId, isLiked])

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this Trotro Tale from ${params.locationName ?? 'Ghana'}! 🚐`,
      })
    } catch { /* user cancelled */ }
  }, [params.locationName])

  const formatTime = (secs: number) => {
    const m = Math.floor(Math.abs(secs) / 60)
    const s = Math.floor(Math.abs(secs) % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const remaining = duration - currentTime
  const commentCount = parseInt(params.commentCount ?? '0', 10)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Thumbnail while loading */}
      {!hasRenderedFirstFrame && params.thumbnailUrl && (
        <Image
          source={{ uri: params.thumbnailUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}

      {/* Loading spinner */}
      {!hasRenderedFirstFrame && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.white} />
        </View>
      )}

      {/* Fullscreen video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="contain"
        nativeControls={false}
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
      />

      {/* Tap to play/pause */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={togglePlayPause}
      >
        {isPaused && (
          <View style={styles.playOverlay}>
            <View style={styles.playBtn}>
              <Play size={44} color={c.white} fill={c.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Top bar — close button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.closeBtn}
        >
          <X size={22} color={c.white} />
        </TouchableOpacity>
      </View>

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* ─── TikTok-style vertical action bar (right side) ─── */}
      <View style={styles.actionBar}>
        {/* Like */}
        <TouchableOpacity
          onPress={toggleLike}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <Heart
            size={28}
            color={isLiked ? '#ef4444' : c.white}
            fill={isLiked ? '#ef4444' : 'transparent'}
          />
          <Text style={styles.actionLabel}>{likeCount}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          onPress={() => {
            DeviceEventEmitter.emit('openComment', params.postId)
            router.back()
          }}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <MessageCircle size={28} color={c.white} />
          <Text style={styles.actionLabel}>{commentCount}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <Share2 size={26} color={c.white} />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>

        {/* Save / Bookmark */}
        <TouchableOpacity
          onPress={() => setIsSaved((v) => !v)}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <Bookmark
            size={26}
            color={isSaved ? c.amber500 : c.white}
            fill={isSaved ? c.amber500 : 'transparent'}
          />
          <Text style={styles.actionLabel}>Save</Text>
        </TouchableOpacity>

        {/* Volume */}
        <TouchableOpacity
          onPress={toggleMute}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          {isMuted ? (
            <VolumeX size={26} color={c.white} />
          ) : (
            <Volume2 size={26} color={c.white} />
          )}
          <Text style={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
      </View>

      {/* User info overlay — bottom left */}
      <View style={styles.userInfo}>
        <InitialsAvatar
          name={params.displayName ?? null}
          deviceId={params.deviceId ?? ''}
          size={36}
        />
        <View style={styles.userTextCol}>
          <Text style={styles.userName} numberOfLines={1}>
            {params.displayName || `User-${(params.deviceId ?? '').slice(-4).toUpperCase()}`}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.metaText}>{params.locationName}</Text>
            <Text style={styles.metaText}> · {params.timeAgo}</Text>
          </View>
        </View>
      </View>

      {/* Caption */}
      {params.caption ? (
        <View style={styles.captionBox}>
          <Text style={styles.captionText} numberOfLines={3}>
            {params.caption}
          </Text>
        </View>
      ) : null}

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Glass control bar */}
      <View style={styles.controlBar}>
        <BlurView
          intensity={50}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.controlBarContent}>
          <TouchableOpacity onPress={togglePlayPause} activeOpacity={0.7} hitSlop={8}>
            {isPaused ? (
              <Play size={20} color={c.white} fill={c.white} />
            ) : (
              <Pause size={20} color={c.white} fill={c.white} />
            )}
          </TouchableOpacity>

          <Text style={styles.timeText}>-{formatTime(remaining)}</Text>

          <View style={{ flex: 1 }} />

          <TouchableOpacity onPress={toggleMute} activeOpacity={0.7} hitSlop={8}>
            {isMuted ? (
              <VolumeX size={20} color={c.white} />
            ) : (
              <Volume2 size={20} color={c.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    zIndex: 2,
  },
  // ─── TikTok-style vertical action bar ───
  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 180,
    alignItems: 'center',
    gap: 20,
    zIndex: 8,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: font.medium,
  },
  // ─── User info + caption ───
  userInfo: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 70,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
  },
  userTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    color: c.white,
    fontFamily: font.bold,
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginLeft: 3,
  },
  captionBox: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 70,
    zIndex: 5,
  },
  captionText: {
    color: c.white,
    fontSize: 14,
    lineHeight: 20,
  },
  // ─── Progress + control bar ───
  progressTrack: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.white,
  },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    overflow: 'hidden',
    zIndex: 5,
  },
  controlBarContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  timeText: {
    color: c.white,
    fontSize: 14,
    fontFamily: font.semibold,
    minWidth: 44,
  },
})
