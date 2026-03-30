import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, Text } from 'react-native'
import Svg, { Path, Rect, Circle, G } from 'react-native-svg'
import { font } from '@/lib/theme'
import type { QueueStatus } from '@/lib/services/stations'

/* ─── Types ─────────────────────────────────────────────────── */

export type StationPinType = 'trotro' | 'train' | 'major' | 'queue'

interface StationMapPinProps {
  type: StationPinType
  name: string
  waitText?: string
  queueStatus?: QueueStatus
}

/* ─── Color configs ─────────────────────────────────────────── */

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

interface PinConfig {
  color: string
  darkColor: string
  size: number
  animated: boolean // pulse + breathe
}

function getConfig(type: StationPinType, queueStatus?: QueueStatus): PinConfig {
  switch (type) {
    case 'queue': {
      const qc = queueStatus ? QUEUE_COLORS[queueStatus] : '#f59e0b'
      return { color: qc, darkColor: qc, size: 48, animated: true }
    }
    case 'train':
      return { color: '#0ea5e9', darkColor: '#0284c7', size: 42, animated: true }
    case 'major':
      return { color: '#f59e0b', darkColor: '#d97706', size: 44, animated: true }
    case 'trotro':
    default:
      return { color: '#f59e0b', darkColor: '#d97706', size: 36, animated: false }
  }
}

/* ─── Semantic SVG icons ────────────────────────────────────── */

function TrotroSvg({ color }: { color: string }) {
  return (
    <Svg width="16" height="14" viewBox="0 0 16 14">
      <G transform="translate(0, 0)">
        <Rect x="1" y="2" width="12" height="7" rx="1.8" fill={color} />
        <Rect x="9" y="3" width="3" height="4.5" rx="0.8" fill="#bfdbfe" opacity="0.9" />
        <Circle cx="4" cy="10.5" r="1.5" fill="#374151" />
        <Circle cx="10" cy="10.5" r="1.5" fill="#374151" />
        <Rect x="1.5" y="1" width="11" height="1.5" rx="0.7" fill={color} opacity="0.7" />
      </G>
    </Svg>
  )
}

function TrainSvg({ color }: { color: string }) {
  return (
    <Svg width="14" height="16" viewBox="0 0 14 16">
      <G transform="translate(0, 0)">
        <Rect x="1" y="1" width="12" height="10" rx="2.5" fill={color} />
        <Rect x="3" y="3" width="8" height="3.5" rx="1" fill="#bfdbfe" opacity="0.85" />
        <Path d="M4 1 Q7 -1 10 1" fill={color} opacity="0.7" />
        <Circle cx="7" cy="1.5" r="1" fill="#fef08a" />
        <Rect x="0" y="11.5" width="14" height="1.5" rx="0.7" fill="#374151" />
        <Circle cx="4" cy="12.5" r="1" fill="#6b7280" />
        <Circle cx="10" cy="12.5" r="1" fill="#6b7280" />
      </G>
    </Svg>
  )
}

function QueueSvg({ color }: { color: string }) {
  return (
    <Svg width="18" height="14" viewBox="0 0 18 14">
      <G transform="translate(0, 0)">
        {/* Person 1 */}
        <Circle cx="5" cy="3" r="2.5" fill={color} />
        <Path d="M1.5 8 Q5 6 8.5 8 L8.5 13 L1.5 13 Z" fill={color} />
        {/* Person 2 */}
        <Circle cx="13" cy="3" r="2.5" fill={color} opacity="0.65" />
        <Path d="M9.5 8 Q13 6 16.5 8 L16.5 13 L9.5 13 Z" fill={color} opacity="0.65" />
      </G>
    </Svg>
  )
}

function MajorSvg({ color }: { color: string }) {
  // Larger bus with star accent
  return (
    <Svg width="18" height="14" viewBox="0 0 18 14">
      <G transform="translate(0, 0)">
        <Rect x="1" y="2" width="14" height="7" rx="2" fill={color} />
        <Rect x="10.5" y="3" width="3.5" height="4.5" rx="0.8" fill="#bfdbfe" opacity="0.9" />
        <Circle cx="4.5" cy="10.5" r="1.5" fill="#374151" />
        <Circle cx="11.5" cy="10.5" r="1.5" fill="#374151" />
        <Rect x="1.5" y="1" width="13" height="1.5" rx="0.7" fill={color} opacity="0.7" />
        {/* Star */}
        <Circle cx="15.5" cy="2" r="2.5" fill={color} />
        <Path d="M15.5 0.5 L16 1.5 L17 1.7 L16.3 2.4 L16.5 3.5 L15.5 3 L14.5 3.5 L14.7 2.4 L14 1.7 L15 1.5 Z" fill="white" />
      </G>
    </Svg>
  )
}

const ICON_MAP: Record<StationPinType, React.FC<{ color: string }>> = {
  trotro: TrotroSvg,
  train: TrainSvg,
  queue: QueueSvg,
  major: MajorSvg,
}

/* ─── Animated Pin Component ────────────────────────────────── */

export const StationMapPin = React.memo(function StationMapPin({ type, name, waitText, queueStatus }: StationMapPinProps) {
  const config = getConfig(type, queueStatus)
  const IconComponent = ICON_MAP[type]

  // Pulse ring — only for animated types (queue, train, major)
  const pulseScale = useRef(new Animated.Value(1)).current
  const pulseOpacity = useRef(new Animated.Value(0.5)).current

  // Breathing — subtle scale oscillation
  const breathScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!config.animated) return

    const pulseDuration = type === 'queue' ? 2000 : 3000

    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 2,
          duration: pulseDuration,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: pulseDuration,
          useNativeDriver: true,
        }),
      ]),
    )

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.06,
          duration: pulseDuration * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1,
          duration: pulseDuration * 0.5,
          useNativeDriver: true,
        }),
      ]),
    )

    pulseLoop.start()
    breathLoop.start()
    return () => { pulseLoop.stop(); breathLoop.stop() }
  }, [config.animated, type, pulseScale, pulseOpacity, breathScale])

  const sz = config.size
  const iconArea = sz * 0.6
  const containerSz = sz * 2.5

  return (
    <View style={[styles.pinContainer, { width: containerSz, height: containerSz + 20 }]}>
      {/* Animated pulse ring (only for animated types) */}
      {config.animated && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: sz,
              height: sz,
              borderRadius: sz / 2,
              backgroundColor: config.color,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}

      {/* Static ring (animated types only) */}
      {config.animated && (
        <View
          style={[
            styles.staticRing,
            {
              width: sz * 1.2,
              height: sz * 1.2,
              borderRadius: (sz * 1.2) / 2,
              borderColor: config.color,
            },
          ]}
        />
      )}

      {/* Main circle — breathing for animated, static for trotro */}
      <Animated.View
        style={[
          styles.mainCircle,
          {
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            backgroundColor: config.color,
            borderColor: config.darkColor,
            transform: config.animated ? [{ scale: breathScale }] : [],
          },
        ]}
      >
        <View
          style={[
            styles.innerCircle,
            {
              width: iconArea,
              height: iconArea,
              borderRadius: iconArea / 2,
            },
          ]}
        >
          <IconComponent color={config.color} />
        </View>
      </Animated.View>

      {/* Live dot for queue-active stations */}
      {type === 'queue' && (
        <View style={[styles.liveBadge, { backgroundColor: config.color }]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Station name label */}
      <Text style={styles.nameLabel} numberOfLines={1}>{name}</Text>

      {/* Wait time (queue only) */}
      {waitText ? (
        <Text style={styles.waitLabel}>{waitText}</Text>
      ) : null}
    </View>
  )
})

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.15,
  },
  mainCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  innerCircle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 8,
    fontFamily: font.bold,
    color: '#fff',
    letterSpacing: 1,
  },
  nameLabel: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: font.semibold,
    color: '#374151',
    textAlign: 'center',
    maxWidth: 80,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  waitLabel: {
    fontSize: 9,
    fontFamily: font.medium,
    color: '#6b7280',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
})
