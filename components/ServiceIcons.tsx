import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Rect, Circle, G, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg'

/**
 * Vibrant 2D illustrated icons for the service mode pills.
 * More personality than plain Lucide outlines — each has gradients,
 * depth, and transport-specific character.
 */

/** Trotro — side-view minibus with Ghanaian character */
export function TrotroIcon({ size = 22, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#f59e0b'
  const bodyColor = active ? '#fff' : '#f59e0b'
  const accentColor = active ? 'rgba(255,255,255,0.7)' : '#d97706'
  const windowColor = active ? 'rgba(255,255,255,0.5)' : '#bfdbfe'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 22 22">
        {/* Bus body */}
        <Rect x="2" y="6" width="18" height="9" rx="2.5" fill={bodyColor} />
        {/* Roof rack */}
        <Rect x="3" y="4.5" width="16" height="2.5" rx="1.2" fill={accentColor} />
        {/* Windshield */}
        <Rect x="15" y="7" width="4" height="6" rx="1" fill={windowColor} />
        {/* Side windows */}
        <Rect x="4" y="7.5" width="3.5" height="3" rx="0.8" fill={windowColor} />
        <Rect x="8.5" y="7.5" width="3.5" height="3" rx="0.8" fill={windowColor} />
        {/* Door */}
        <Rect x="12.5" y="7.5" width="2" height="5.5" rx="0.5" fill={accentColor} />
        {/* Wheels */}
        <Circle cx="6" cy="16" r="2" fill={active ? 'rgba(255,255,255,0.4)' : '#374151'} />
        <Circle cx="6" cy="16" r="1" fill={active ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
        <Circle cx="16" cy="16" r="2" fill={active ? 'rgba(255,255,255,0.4)' : '#374151'} />
        <Circle cx="16" cy="16" r="1" fill={active ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
        {/* Headlight */}
        <Circle cx="19.5" cy="12" r="1" fill={active ? 'rgba(255,255,255,0.8)' : '#fef08a'} />
        {/* Tail light */}
        <Circle cx="2.5" cy="12" r="0.8" fill={active ? 'rgba(255,255,255,0.6)' : '#ef4444'} />
        {/* Bumper */}
        <Rect x="1" y="14.5" width="20" height="1" rx="0.5" fill={accentColor} />
      </Svg>
    </View>
  )
}

/** Train — sleek front-view modern railcar */
export function TrainIcon({ size = 22, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#0ea5e9'
  const accentColor = active ? 'rgba(255,255,255,0.6)' : '#0284c7'
  const windowColor = active ? 'rgba(255,255,255,0.5)' : '#bfdbfe'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 22 22">
        {/* Body */}
        <Rect x="4" y="3" width="14" height="14" rx="3" fill={color} />
        {/* Nose taper */}
        <Path d="M6 3 Q11 0.5 16 3" fill={active ? 'rgba(255,255,255,0.8)' : '#38bdf8'} />
        {/* Main windshield */}
        <Rect x="6" y="5" width="10" height="4.5" rx="1.5" fill={windowColor} />
        {/* Side windows */}
        <Rect x="6" y="11" width="4" height="2.5" rx="0.8" fill={windowColor} />
        <Rect x="12" y="11" width="4" height="2.5" rx="0.8" fill={windowColor} />
        {/* Center stripe */}
        <Rect x="5" y="9.8" width="12" height="1" rx="0.5" fill={accentColor} />
        {/* Headlight */}
        <Circle cx="11" cy="3.5" r="1.3" fill={active ? 'rgba(255,255,255,0.9)' : '#fef08a'} />
        {/* Tail lights */}
        <Circle cx="7" cy="16.5" r="0.8" fill={active ? 'rgba(255,255,255,0.6)' : '#ef4444'} />
        <Circle cx="15" cy="16.5" r="0.8" fill={active ? 'rgba(255,255,255,0.6)' : '#ef4444'} />
        {/* Rail / wheels */}
        <Rect x="3" y="17.5" width="16" height="1.5" rx="0.7" fill={accentColor} />
        <Circle cx="7" cy="18.5" r="1" fill={active ? 'rgba(255,255,255,0.4)' : '#374151'} />
        <Circle cx="15" cy="18.5" r="1" fill={active ? 'rgba(255,255,255,0.4)' : '#374151'} />
      </Svg>
    </View>
  )
}

/** GO Mode — navigation arrow with speed lines */
export function GoIcon({ size = 22, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#22c55e'
  const accentColor = active ? 'rgba(255,255,255,0.5)' : '#16a34a'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 22 22">
        {/* Speed lines */}
        <Rect x="1" y="8" width="5" height="1.2" rx="0.6" fill={accentColor} opacity="0.5" />
        <Rect x="2" y="11" width="4" height="1.2" rx="0.6" fill={accentColor} opacity="0.3" />
        <Rect x="1.5" y="14" width="3.5" height="1.2" rx="0.6" fill={accentColor} opacity="0.2" />
        {/* Navigation arrow — bold, filled */}
        <Path
          d="M19 11L8 4.5V9H6v4h2v4.5L19 11z"
          fill={color}
        />
        {/* Inner highlight */}
        <Path
          d="M16 11L10 7v2.5h-1.5v3H10V15L16 11z"
          fill={active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.4)'}
        />
        {/* Circle pulse behind arrow */}
        <Circle cx="13" cy="11" r="8" fill={color} opacity="0.08" />
      </Svg>
    </View>
  )
}

/** Tales — camera/photo icon with creative flair */
export function TalesIcon({ size = 22, active = false }: { size?: number; active?: boolean }) {
  const color = active ? '#fff' : '#a855f7'
  const accentColor = active ? 'rgba(255,255,255,0.6)' : '#7c3aed'
  const lensColor = active ? 'rgba(255,255,255,0.4)' : '#c4b5fd'

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 22 22">
        {/* Camera body */}
        <Rect x="2" y="6" width="18" height="12" rx="2.5" fill={color} />
        {/* Top bump (viewfinder) */}
        <Rect x="7.5" y="3.5" width="7" height="3.5" rx="1.2" fill={accentColor} />
        {/* Lens outer ring */}
        <Circle cx="11" cy="12" r="4.5" fill={accentColor} />
        {/* Lens middle */}
        <Circle cx="11" cy="12" r="3.2" fill={lensColor} />
        {/* Lens inner */}
        <Circle cx="11" cy="12" r="1.8" fill={color} />
        {/* Lens highlight */}
        <Circle cx="9.8" cy="10.8" r="0.8" fill="white" opacity="0.5" />
        {/* Flash */}
        <Circle cx="17" cy="8" r="1" fill={active ? 'rgba(255,255,255,0.8)' : '#fef08a'} />
        {/* Shutter button */}
        <Circle cx="4.5" cy="8" r="0.8" fill={accentColor} />
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
