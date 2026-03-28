import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Rect, Circle } from 'react-native-svg'

/**
 * Clean, minimal monochrome icons for service mode pills.
 * Designed to blend with map UI — no gradients, no vibrant colors.
 */

/** Trotro — simple minibus silhouette */
export function TrotroIcon({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#78716c'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 11V16a1 1 0 001 1h1a2 2 0 104 0h6a2 2 0 104 0h1a1 1 0 001-1v-5l-2-5H5L3 11z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M3 11h18" stroke={color} strokeWidth={1.5} />
        <Path d="M8 6v5M16 6v5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  )
}

/** Train — simple railcar outline */
export function TrainIcon({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#78716c'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="4" y="3" width="16" height="16" rx="3" stroke={color} strokeWidth={1.8} />
        <Path d="M4 11h16" stroke={color} strokeWidth={1.5} />
        <Circle cx="8.5" cy="15" r="1" fill={color} />
        <Circle cx="15.5" cy="15" r="1" fill={color} />
        <Path d="M8 7h8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M7 22l3-3M17 22l-3-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  )
}

/** GO Mode — simple navigation arrow */
export function GoIcon({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#78716c'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 11l19-9-9 19-2-8-8-2z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

/** Tales — simple camera outline */
export function TalesIcon({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#78716c'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.8} />
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
