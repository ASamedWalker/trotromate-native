import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Rect, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg'

/**
 * Custom map marker icons for Mapbox SymbolLayer.
 * Rendered as React components, registered via <Mapbox.Images>.
 * Each icon is 32x32 for crisp display at map zoom levels.
 */

/** Trotro station marker — amber pin with minibus silhouette */
export function TrotroStationIcon({ size = 32 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="trotroGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fbbf24" />
            <Stop offset="1" stopColor="#f59e0b" />
          </LinearGradient>
        </Defs>
        {/* Pin body */}
        <Path
          d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="url(#trotroGrad)"
        />
        <Path
          d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="none"
          stroke="#d97706"
          strokeWidth="0.8"
        />
        {/* White circle background for icon */}
        <Circle cx="16" cy="11" r="6.5" fill="white" opacity="0.95" />
        {/* Mini bus silhouette */}
        <G transform="translate(11, 6.5)">
          {/* Bus body */}
          <Rect x="1" y="2" width="8" height="5" rx="1.2" fill="#f59e0b" />
          {/* Windshield */}
          <Rect x="6.5" y="2.8" width="2" height="3.2" rx="0.6" fill="#bfdbfe" opacity="0.9" />
          {/* Wheels */}
          <Circle cx="3" cy="7.5" r="1" fill="#374151" />
          <Circle cx="7" cy="7.5" r="1" fill="#374151" />
          {/* Roof line */}
          <Rect x="1.5" y="1.5" width="7" height="1" rx="0.5" fill="#e88a3a" />
        </G>
      </Svg>
    </View>
  )
}

/** Train station marker — blue pin with train silhouette */
export function TrainStationIcon({ size = 32 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="trainGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#38bdf8" />
            <Stop offset="1" stopColor="#0ea5e9" />
          </LinearGradient>
        </Defs>
        {/* Pin body */}
        <Path
          d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="url(#trainGrad)"
        />
        <Path
          d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="none"
          stroke="#0284c7"
          strokeWidth="0.8"
        />
        {/* White circle background */}
        <Circle cx="16" cy="11" r="6.5" fill="white" opacity="0.95" />
        {/* Train silhouette */}
        <G transform="translate(12.5, 6)">
          {/* Train body */}
          <Rect x="0.5" y="1" width="6" height="7" rx="1.5" fill="#0ea5e9" />
          {/* Windshield */}
          <Rect x="1.5" y="2" width="4" height="2" rx="0.8" fill="#bfdbfe" opacity="0.85" />
          {/* Front nose */}
          <Path d="M2 1 Q3.5 -0.5 5 1" fill="#38bdf8" />
          {/* Headlight */}
          <Circle cx="3.5" cy="1" r="0.7" fill="#fef08a" />
          {/* Wheels / rail */}
          <Rect x="0" y="8.2" width="7" height="1" rx="0.5" fill="#374151" />
          <Circle cx="2" cy="8.5" r="0.7" fill="#6b7280" />
          <Circle cx="5" cy="8.5" r="0.7" fill="#6b7280" />
        </G>
      </Svg>
    </View>
  )
}

/** Major trotro station — larger amber marker with star accent */
export function MajorStationIcon({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Defs>
          <LinearGradient id="majorGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fbbf24" />
            <Stop offset="1" stopColor="#f59e0b" />
          </LinearGradient>
        </Defs>
        {/* Outer glow */}
        <Circle cx="18" cy="13" r="14" fill="#f59e0b" opacity="0.12" />
        {/* Pin body */}
        <Path
          d="M18 2C11.92 2 7 6.92 7 13c0 8.5 11 20 11 20s11-11.5 11-20c0-6.08-4.92-11-11-11z"
          fill="url(#majorGrad)"
        />
        <Path
          d="M18 2C11.92 2 7 6.92 7 13c0 8.5 11 20 11 20s11-11.5 11-20c0-6.08-4.92-11-11-11z"
          fill="none"
          stroke="#d97706"
          strokeWidth="1"
        />
        {/* White circle */}
        <Circle cx="18" cy="12" r="7.5" fill="white" opacity="0.95" />
        {/* Bus icon - larger */}
        <G transform="translate(12.5, 7)">
          <Rect x="1" y="2" width="9.5" height="5.5" rx="1.5" fill="#f59e0b" />
          <Rect x="7.5" y="2.8" width="2.5" height="3.5" rx="0.7" fill="#bfdbfe" opacity="0.9" />
          <Circle cx="3.5" cy="8.2" r="1.1" fill="#374151" />
          <Circle cx="8" cy="8.2" r="1.1" fill="#374151" />
          <Rect x="1.5" y="1.2" width="8.5" height="1.2" rx="0.6" fill="#e88a3a" />
        </G>
        {/* Star badge */}
        <Circle cx="24" cy="6" r="4" fill="#f59e0b" />
        <Path
          d="M24 3.5l0.8 1.6 1.7 0.2-1.2 1.2 0.3 1.7-1.6-0.8-1.6 0.8 0.3-1.7-1.2-1.2 1.7-0.2z"
          fill="white"
        />
      </Svg>
    </View>
  )
}

/** Queue active marker — amber pin with glowing rings */
export function QueueActiveIcon({ size = 44 }: { size?: number }) {
  // Larger viewBox to fit the glow rings around the pin
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 44 44">
        <Defs>
          <LinearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fbbf24" />
            <Stop offset="1" stopColor="#f59e0b" />
          </LinearGradient>
        </Defs>
        {/* Outer glow rings — concentric fading circles */}
        <Circle cx="22" cy="16" r="20" fill="#f59e0b" opacity="0.06" />
        <Circle cx="22" cy="16" r="16" fill="#f59e0b" opacity="0.1" />
        <Circle cx="22" cy="16" r="13" fill="#f59e0b" opacity="0.12" />
        {/* Glow ring stroke */}
        <Circle cx="22" cy="16" r="16" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.2" />
        {/* Pin body */}
        <Path
          d="M22 6C16.48 6 12 10.48 12 16c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="url(#queueGrad)"
        />
        <Path
          d="M22 6C16.48 6 12 10.48 12 16c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill="none"
          stroke="#d97706"
          strokeWidth="0.8"
        />
        {/* White circle */}
        <Circle cx="22" cy="15" r="6.5" fill="white" opacity="0.95" />
        {/* People/queue icon */}
        <G transform="translate(16.5, 11)">
          <Circle cx="3.5" cy="2" r="1.5" fill="#f59e0b" />
          <Path d="M1.5 5.5 Q3.5 4 5.5 5.5 L5.5 8 L1.5 8 Z" fill="#f59e0b" />
          <Circle cx="7.5" cy="2" r="1.5" fill="#d97706" />
          <Path d="M5.5 5.5 Q7.5 4 9.5 5.5 L9.5 8 L5.5 8 Z" fill="#d97706" />
        </G>
        {/* Green live dot — top right */}
        <Circle cx="34" cy="7" r="4.5" fill="#22c55e" />
        <Circle cx="34" cy="7" r="2.5" fill="white" />
        <Circle cx="34" cy="7" r="1.2" fill="#22c55e" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
