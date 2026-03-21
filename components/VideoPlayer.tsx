import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { Volume2, VolumeX, Play } from 'lucide-react-native'
import { c, font } from '@/lib/theme'

interface VideoPlayerProps {
  uri: string
  thumbnailUri?: string | null
  width: number
  isVisible: boolean
  durationSecs?: number | null
}

export default function VideoPlayer({
  uri,
  thumbnailUri,
  width,
  isVisible,
  durationSecs,
}: VideoPlayerProps) {
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false)
  const [progress, setProgress] = useState(0)
  const controlsOpacity = useRef(new Animated.Value(1)).current
  const height = width * (4 / 3)

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // Sync muted state
  useEffect(() => {
    player.muted = isMuted
  }, [isMuted, player])

  // Visibility-based play/pause
  useEffect(() => {
    if (isVisible && !isPaused) {
      player.play()
    } else {
      player.pause()
    }
  }, [isVisible, isPaused, player])

  // Track playback progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (player.duration > 0) {
        setProgress(player.currentTime / player.duration)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [player])

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m)
  }, [])

  const togglePlayPause = useCallback(() => {
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
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
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

      {/* Loading spinner */}
      {!hasRenderedFirstFrame && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={c.white} />
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

      {/* Bottom gradient for sharp overlay contrast */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Tap to play/pause overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={togglePlayPause}
      >
        {isPaused && (
          <View style={styles.playOverlay}>
            <View style={styles.playBtn}>
              <Play size={32} color={c.white} fill={c.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom controls row */}
      <Animated.View style={[styles.controlsRow, { opacity: controlsOpacity }]}>
        {/* Duration badge */}
        {durationSecs != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatTime(durationSecs)}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Mute/unmute button */}
        <TouchableOpacity
          style={styles.muteBtn}
          onPress={toggleMute}
          activeOpacity={0.8}
          hitSlop={8}
        >
          {isMuted ? (
            <VolumeX size={16} color={c.white} />
          ) : (
            <Volume2 size={16} color={c.white} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Progress bar — thin line at bottom */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
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
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controlsRow: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: {
    color: c.white,
    fontSize: 11,
    fontFamily: font.semibold,
  },
  muteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.white,
    borderRadius: 1.5,
  },
})
