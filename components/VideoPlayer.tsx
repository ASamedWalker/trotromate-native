import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Volume2, VolumeX, Play, Pause, Maximize2 } from 'lucide-react-native'
import { c, font } from '@/lib/theme'

interface VideoPlayerProps {
  uri: string
  thumbnailUri?: string | null
  width: number
  isVisible: boolean
  isMounted?: boolean
  durationSecs?: number | null
  onExpand?: () => void
}

export default function VideoPlayer({
  uri,
  thumbnailUri,
  width,
  isVisible,
  isMounted = true,
  durationSecs,
  onExpand,
}: VideoPlayerProps) {
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationSecs ?? 0)
  const [progress, setProgress] = useState(0)
  const height = Math.round(width * (4 / 3)) // tall video like X/Twitter

  const player = useVideoPlayer(isMounted ? uri : null, (p) => {
    p.loop = true
    p.muted = true
    if (isVisible) p.play()
  })

  // Sync muted state
  useEffect(() => {
    if (!player) return
    player.muted = isMuted
  }, [isMuted, player])

  // Visibility-based play/pause
  useEffect(() => {
    if (!player) return
    if (isVisible && !isPaused) {
      player.play()
    } else {
      player.pause()
    }
  }, [isVisible, isPaused, player])

  // Track playback progress + remaining time
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
      if (next) {
        player.pause()
      } else {
        player.play()
      }
      return next
    })
  }, [player])

  const formatTime = (secs: number) => {
    const m = Math.floor(Math.abs(secs) / 60)
    const s = Math.floor(Math.abs(secs) % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const remaining = duration - currentTime

  // If not mounted, show thumbnail only (memory-saving for distant posts)
  if (!isMounted) {
    return (
      <View style={[styles.container, { width, height }]}>
        {thumbnailUri && (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="disk"
          />
        )}
        <View style={styles.playOverlay}>
          <View style={styles.playBtnLarge}>
            <Play size={36} color={c.white} fill={c.white} />
          </View>
        </View>
        {durationSecs != null && (
          <View style={styles.thumbnailDuration}>
            <Text style={styles.thumbnailDurationText}>{formatTime(durationSecs)}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Thumbnail placeholder until video renders */}
      {!hasRenderedFirstFrame && thumbnailUri && (
        <Image
          source={{ uri: thumbnailUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}

      {/* Play icon + spinner on thumbnail while loading */}
      {!hasRenderedFirstFrame && (
        <View style={styles.playOverlay}>
          <View style={styles.playBtnLarge}>
            <Play size={36} color={c.white} fill={c.white} />
          </View>
          <ActivityIndicator
            size="small"
            color={c.white}
            style={styles.loadingSpinner}
          />
        </View>
      )}

      {/* Video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
      />

      {/* Bottom gradient for control bar readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Tap to play/pause — full overlay */}
      <TouchableOpacity
        style={styles.tapArea}
        activeOpacity={1}
        onPress={togglePlayPause}
      >
        {isPaused && (
          <View style={styles.playOverlay}>
            <View style={styles.playBtnLarge}>
              <Play size={36} color={c.white} fill={c.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Progress bar — thin line above control bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* X/Twitter-style glass control bar */}
      <View style={styles.controlBar}>
        <BlurView
          intensity={40}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.controlBarContent}>
          {/* Play/Pause */}
          <TouchableOpacity
            onPress={togglePlayPause}
            activeOpacity={0.7}
            hitSlop={6}
          >
            {isPaused ? (
              <Play size={18} color={c.white} fill={c.white} />
            ) : (
              <Pause size={18} color={c.white} fill={c.white} />
            )}
          </TouchableOpacity>

          {/* Remaining time (countdown like X) */}
          <Text style={styles.timeText}>
            -{formatTime(remaining)}
          </Text>

          <View style={{ flex: 1 }} />

          {/* Mute/unmute */}
          <TouchableOpacity
            onPress={toggleMute}
            activeOpacity={0.7}
            hitSlop={6}
          >
            {isMuted ? (
              <VolumeX size={18} color={c.white} />
            ) : (
              <Volume2 size={18} color={c.white} />
            )}
          </TouchableOpacity>

          {/* Expand to fullscreen reel */}
          {onExpand && (
            <TouchableOpacity
              onPress={onExpand}
              activeOpacity={0.7}
              hitSlop={6}
            >
              <Maximize2 size={16} color={c.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 2,
  },
  playBtnLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  loadingSpinner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  thumbnailDuration: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  thumbnailDurationText: {
    color: c.white,
    fontSize: 12,
    fontFamily: font.semibold,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    zIndex: 1,
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 42,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 5,
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
    height: 42,
    overflow: 'hidden',
    zIndex: 4,
  },
  controlBarContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  timeText: {
    color: c.white,
    fontSize: 13,
    fontFamily: font.semibold,
    minWidth: 40,
  },
})
