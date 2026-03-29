import React, { useEffect, useRef, useMemo } from 'react'
import { View, Animated, StyleSheet, Text, TouchableOpacity } from 'react-native'
import Svg, { Path, Rect, Circle, G } from 'react-native-svg'
import { font } from '@/lib/theme'

/* ─── Types ─────────────────────────────────────────────────── */

interface IncidentPinProps {
  type: string
  createdAt: string // ISO date — drives pulse speed
  size?: number
  onPress?: () => void
}

/* ─── Icon configs per incident type ────────────────────────── */

interface IncidentConfig {
  color: string
  darkColor: string
  label: string
  size: number // base size — road closures are biggest
}

const CONFIGS: Record<string, IncidentConfig> = {
  traffic:           { color: '#f59e0b', darkColor: '#d97706', label: 'TRAFFIC',  size: 44 },
  accident:          { color: '#dc2626', darkColor: '#991b1b', label: 'ACCIDENT', size: 48 },
  police_checkpoint: { color: '#3b82f6', darkColor: '#2563eb', label: 'POLICE',   size: 42 },
  road_closure:      { color: '#f97316', darkColor: '#ea580c', label: 'CLOSED',   size: 54 },
  flooding:          { color: '#0d9488', darkColor: '#0f766e', label: 'HAZARD',   size: 44 },
  breakdown:         { color: '#d97706', darkColor: '#b45309', label: 'WORK',     size: 44 },
}

const DEFAULT_CONFIG: IncidentConfig = {
  color: '#ef4444', darkColor: '#dc2626', label: 'ALERT', size: 44,
}

/* ─── Semantic SVG icons ────────────────────────────────────── */

function TrafficIcon({ color }: { color: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <G transform="translate(1, 2)">
        <Path d="M3 4 L4 0 L12 0 L13 4 L15 4 L15 9 L1 9 L1 4 Z" fill={color} />
        <Rect x="4" y="1" width="3.5" height="2.5" rx="0.6" fill="white" opacity="0.85" />
        <Rect x="8.5" y="1" width="3.5" height="2.5" rx="0.6" fill="white" opacity="0.85" />
        <Circle cx="4.5" cy="10" r="1.4" fill="#374151" />
        <Circle cx="11.5" cy="10" r="1.4" fill="#374151" />
      </G>
    </Svg>
  )
}

function AccidentIcon({ color }: { color: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <G transform="translate(2, 1)">
        <Path d="M7 0 L14 12 L0 12 Z" fill={color} />
        <Path d="M7 3.5 L7 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="7" cy="9.5" r="1" fill="white" />
      </G>
    </Svg>
  )
}

function PoliceIcon({ color }: { color: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <G transform="translate(2, 1)">
        <Path d="M7 0 L13 3 L13 8 C13 12 10 14 7 15 C4 14 1 12 1 8 L1 3 Z" fill={color} />
        <Path d="M4.5 8 L6 9.5 L9.5 5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    </Svg>
  )
}

function ClosureIcon({ color }: { color: string }) {
  // Traffic barrier — the "hero" icon for road closures
  return (
    <Svg width="22" height="22" viewBox="0 0 22 22">
      <G transform="translate(1, 3)">
        {/* Top bar */}
        <Rect x="0" y="0" width="20" height="5" rx="1.2" fill={color} />
        {/* Diagonal warning stripes */}
        <Path d="M3 0 L7 5" stroke="white" strokeWidth="1.5" />
        <Path d="M8 0 L12 5" stroke="white" strokeWidth="1.5" />
        <Path d="M13 0 L17 5" stroke="white" strokeWidth="1.5" />
        {/* Support legs */}
        <Rect x="3" y="5" width="2.5" height="8" rx="0.6" fill="#374151" />
        <Rect x="14.5" y="5" width="2.5" height="8" rx="0.6" fill="#374151" />
        {/* Base feet */}
        <Rect x="1" y="12" width="7" height="2.5" rx="0.6" fill="#6b7280" />
        <Rect x="12" y="12" width="7" height="2.5" rx="0.6" fill="#6b7280" />
      </G>
    </Svg>
  )
}

function FloodIcon({ color }: { color: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <G transform="translate(1, 0)">
        {/* Warning triangle */}
        <Path d="M8 0 L15 10 L1 10 Z" fill={color} />
        <Path d="M8 3 L8 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="8" cy="8" r="0.8" fill="white" />
        {/* Water waves */}
        <Path d="M0 13 Q2.5 11 5 13 Q7.5 15 10 13 Q12.5 11 15 13" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M1 16 Q3.5 14 6 16 Q8.5 18 11 16 Q13.5 14 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
      </G>
    </Svg>
  )
}

function BreakdownIcon({ color }: { color: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18">
      <G transform="translate(3, 1)">
        {/* Cone body */}
        <Path d="M6 0 L4 11 L1.5 14 L10.5 14 L8 11 Z" fill={color} />
        {/* White stripes */}
        <Rect x="4.5" y="3.5" width="3" height="1.8" rx="0.4" fill="white" />
        <Rect x="3.5" y="7.5" width="5" height="1.8" rx="0.4" fill="white" />
        {/* Base */}
        <Rect x="0.5" y="14" width="11" height="2.5" rx="0.6" fill="#374151" />
      </G>
    </Svg>
  )
}

const ICON_COMPONENTS: Record<string, React.FC<{ color: string }>> = {
  traffic: TrafficIcon,
  accident: AccidentIcon,
  police_checkpoint: PoliceIcon,
  road_closure: ClosureIcon,
  flooding: FloodIcon,
  breakdown: BreakdownIcon,
}

/* ─── Animated Pin Component ────────────────────────────────── */

export { CONFIGS as INCIDENT_CONFIGS }

export function IncidentMapPin({ type, createdAt, onPress }: IncidentPinProps) {
  const config = CONFIGS[type] || DEFAULT_CONFIG
  const IconComponent = ICON_COMPONENTS[type] || AccidentIcon

  // Recency drives pulse speed: <10 min → fast (1.5s), <30 min → medium (2.5s), else slow (3.5s)
  const pulseDuration = useMemo(() => {
    const ageMs = Date.now() - new Date(createdAt).getTime()
    const ageMins = ageMs / 60_000
    if (ageMins < 10) return 1500
    if (ageMins < 30) return 2500
    return 3500
  }, [createdAt])

  // Pulse ring animation — expanding outward + fading
  const pulseScale = useRef(new Animated.Value(1)).current
  const pulseOpacity = useRef(new Animated.Value(0.6)).current

  // Breathing animation — subtle scale oscillation on main circle
  const breathScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Radial pulse
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 2.2,
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

    // Breathing
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.08,
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

    return () => {
      pulseLoop.stop()
      breathLoop.stop()
    }
  }, [pulseDuration, pulseScale, pulseOpacity, breathScale])

  const circleSize = config.size
  const iconAreaSize = circleSize * 0.65

  const content = (
    <View style={[styles.pinContainer, { width: circleSize * 2.5, height: circleSize * 2.5 }]}>
      {/* Animated pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: config.color,
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* Static secondary ring (always visible, subtle) */}
      <View
        style={[
          styles.staticRing,
          {
            width: circleSize * 1.3,
            height: circleSize * 1.3,
            borderRadius: (circleSize * 1.3) / 2,
            borderColor: config.color,
          },
        ]}
      />

      {/* Breathing main circle */}
      <Animated.View
        style={[
          styles.mainCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: config.color,
            borderColor: config.darkColor,
            transform: [{ scale: breathScale }],
          },
        ]}
      >
        {/* White inner circle */}
        <View
          style={[
            styles.innerCircle,
            {
              width: iconAreaSize,
              height: iconAreaSize,
              borderRadius: iconAreaSize / 2,
            },
          ]}
        >
          <IconComponent color={config.color} />
        </View>
      </Animated.View>

      {/* LIVE badge */}
      <View style={[styles.liveBadge, { backgroundColor: config.color }]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

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
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
})
