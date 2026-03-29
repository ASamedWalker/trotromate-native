import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Share,
  DeviceEventEmitter,
  Animated,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import {
  Play,
  Heart,
  MessageCircle,
  Share2,
  MapPin,
  Music,
  Plus,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
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
  const [progress, setProgress] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(parseInt(params.likeCount ?? '0', 10))

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current

  // Music disk rotation
  const diskRotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(diskRotation, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    )
    spin.start()
    return () => spin.stop()
  }, [diskRotation])

  const diskSpin = diskRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  // Fetch existing like state
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
        setProgress(player.currentTime / player.duration)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [player])

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
    // Bounce animation
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start()

    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikeCount((n) => n + (wasLiked ? -1 : 1))
    const success = wasLiked
      ? await removeReaction(params.postId, myDeviceId, '❤️')
      : await addReaction(params.postId, myDeviceId, '❤️')
    if (!success) {
      setIsLiked(wasLiked)
      setLikeCount((n) => n + (wasLiked ? 1 : -1))
    }
  }, [myDeviceId, params.postId, isLiked, likeScale])

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this Trotro Tale from ${params.locationName ?? 'Ghana'}! 🚐`,
      })
    } catch { /* user cancelled */ }
  }, [params.locationName])

  const commentCount = parseInt(params.commentCount ?? '0', 10)
  const userName = params.displayName || `User-${(params.deviceId ?? '').slice(-4).toUpperCase()}`

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
          <ActivityIndicator size="large" color="#fff" />
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
              <Play size={44} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* ─── Top: Dismiss handle + Live Tale badge ─── */}
      <View style={styles.topBar}>
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
          <Text style={styles.liveText}>Live Tale</Text>
        </View>
      </View>

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* ─── Right action bar ─── */}
      <View style={styles.actionBar}>
        {/* Profile avatar with + button */}
        <View style={styles.profileAction}>
          <View style={styles.avatarBorder}>
            <InitialsAvatar
              name={params.displayName ?? null}
              deviceId={params.deviceId ?? ''}
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
          onPress={() => {
            DeviceEventEmitter.emit('openComment', params.postId)
            router.back()
          }}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <MessageCircle size={28} color="#fff" />
          <Text style={styles.actionLabel}>{commentCount}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          style={styles.actionItem}
        >
          <Share2 size={26} color="#fff" />
        </TouchableOpacity>

        {/* Music disk — tap to toggle mute */}
        <TouchableOpacity onPress={() => setIsMuted((m) => !m)} activeOpacity={0.7}>
          <Animated.View style={[styles.musicDisk, { transform: [{ rotate: diskSpin }] }, isMuted && styles.musicDiskMuted]}>
            <Music size={16} color={isMuted ? 'rgba(255,255,255,0.4)' : '#fff'} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ─── Bottom overlay ─── */}
      <View style={styles.bottomContent}>
        {/* @username + Follow */}
        <View style={styles.userRow}>
          <Text style={styles.userName}>@{userName}</Text>
          <TouchableOpacity style={styles.followBtn} activeOpacity={0.7}>
            <Text style={styles.followText}>Follow</Text>
          </TouchableOpacity>
        </View>

        {/* Location */}
        {params.locationName ? (
          <View style={styles.locationRow}>
            <MapPin size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.locationText}>{params.locationName}</Text>
            {params.timeAgo ? (
              <Text style={styles.locationText}> · {params.timeAgo}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Caption */}
        {params.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {params.caption}
          </Text>
        ) : null}

        {/* Music ticker */}
        <View style={styles.musicTicker}>
          <Music size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.musicText} numberOfLines={1}>
            Original sound — {userName}
          </Text>
        </View>
      </View>

      {/* ─── Amber progress bar ─── */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        <View style={[styles.progressGlow, { left: `${Math.round(progress * 100)}%` }]} />
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
    bottom: 140,
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
  musicDisk: {
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
  musicDiskMuted: {
    opacity: 0.5,
  },

  // ─── Bottom content overlay ───
  bottomContent: {
    position: 'absolute',
    bottom: 24,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  locationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: font.medium,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.regular,
    marginBottom: 8,
  },
  musicTicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  musicText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: font.medium,
    flex: 1,
  },

  // ─── Amber progress bar ───
  progressTrack: {
    position: 'absolute',
    bottom: 0,
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
