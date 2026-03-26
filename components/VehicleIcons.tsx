import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path, Rect, Circle, Ellipse, G } from 'react-native-svg'

/**
 * Top-down trotro minibus icon for GO Mode map marker.
 * Designed to look like a Ghanaian trotro from above — boxy shape,
 * windshield, side mirrors, rear window.
 */
export function TrotroTopDown({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {/* Shadow / ground effect */}
        <Rect x="9" y="4" width="22" height="34" rx="4" fill="rgba(0,0,0,0.15)" />

        {/* Body — amber/orange trotro color */}
        <Rect x="8" y="3" width="24" height="34" rx="5" fill="#f59e0b" />
        <Rect x="8" y="3" width="24" height="34" rx="5" fill="none" stroke="#d97706" strokeWidth="1" />

        {/* Roof rack area — darker stripe */}
        <Rect x="10" y="10" width="20" height="18" rx="2" fill="#e88a3a" opacity="0.5" />

        {/* Front windshield */}
        <Rect x="11" y="5" width="18" height="6" rx="2.5" fill="#bfdbfe" opacity="0.85" />

        {/* Rear window */}
        <Rect x="12" y="31" width="16" height="4" rx="2" fill="#93c5fd" opacity="0.7" />

        {/* Side mirrors */}
        <Rect x="4" y="7" width="5" height="3" rx="1.5" fill="#78716c" />
        <Rect x="31" y="7" width="5" height="3" rx="1.5" fill="#78716c" />

        {/* Headlights */}
        <Circle cx="12" cy="4" r="1.5" fill="#fef08a" />
        <Circle cx="28" cy="4" r="1.5" fill="#fef08a" />

        {/* Tail lights */}
        <Circle cx="12" cy="36" r="1.5" fill="#ef4444" />
        <Circle cx="28" cy="36" r="1.5" fill="#ef4444" />
      </Svg>
    </View>
  )
}

/**
 * Top-down train icon for GO Mode map marker.
 * Streamlined shape with rail-blue color scheme.
 */
export function TrainTopDown({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {/* Shadow */}
        <Rect x="11" y="2" width="18" height="38" rx="5" fill="rgba(0,0,0,0.15)" />

        {/* Body — rail blue */}
        <Rect x="10" y="1" width="20" height="38" rx="6" fill="#0ea5e9" />
        <Rect x="10" y="1" width="20" height="38" rx="6" fill="none" stroke="#0284c7" strokeWidth="1" />

        {/* Nose / front taper */}
        <Path d="M14 3 Q20 -1 26 3 L26 8 L14 8 Z" fill="#38bdf8" />

        {/* Front windshield */}
        <Rect x="13" y="5" width="14" height="5" rx="2" fill="#bfdbfe" opacity="0.85" />

        {/* Roof stripe */}
        <Rect x="12" y="14" width="16" height="14" rx="1" fill="#0284c7" opacity="0.3" />

        {/* Side windows */}
        <G opacity="0.6">
          <Rect x="11" y="15" width="3" height="3" rx="1" fill="#bfdbfe" />
          <Rect x="11" y="20" width="3" height="3" rx="1" fill="#bfdbfe" />
          <Rect x="11" y="25" width="3" height="3" rx="1" fill="#bfdbfe" />
          <Rect x="26" y="15" width="3" height="3" rx="1" fill="#bfdbfe" />
          <Rect x="26" y="20" width="3" height="3" rx="1" fill="#bfdbfe" />
          <Rect x="26" y="25" width="3" height="3" rx="1" fill="#bfdbfe" />
        </G>

        {/* Rear section */}
        <Rect x="12" y="33" width="16" height="4" rx="2" fill="#0284c7" opacity="0.5" />

        {/* Headlight */}
        <Circle cx="20" cy="3" r="2" fill="#fef08a" />

        {/* Tail lights */}
        <Circle cx="14" cy="38" r="1.5" fill="#ef4444" />
        <Circle cx="26" cy="38" r="1.5" fill="#ef4444" />
      </Svg>
    </View>
  )
}

/**
 * Top-down motorcycle/okada icon for GO Mode map marker.
 * Slim profile, green accent — future-ready for delivery & logistics.
 */
export function MotoTopDown({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {/* Shadow */}
        <Ellipse cx="20" cy="21" rx="8" ry="17" fill="rgba(0,0,0,0.12)" />

        {/* Rear wheel */}
        <Ellipse cx="20" cy="33" rx="6" ry="4" fill="#374151" />
        <Ellipse cx="20" cy="33" rx="4" ry="2.5" fill="#6b7280" />

        {/* Front wheel */}
        <Ellipse cx="20" cy="6" rx="5.5" ry="3.5" fill="#374151" />
        <Ellipse cx="20" cy="6" rx="3.5" ry="2" fill="#6b7280" />

        {/* Frame / body */}
        <Rect x="17" y="8" width="6" height="22" rx="3" fill="#22c55e" />
        <Rect x="17" y="8" width="6" height="22" rx="3" fill="none" stroke="#16a34a" strokeWidth="0.8" />

        {/* Seat */}
        <Rect x="16" y="16" width="8" height="8" rx="3" fill="#1f2937" />

        {/* Handlebars */}
        <Rect x="12" y="9" width="16" height="2.5" rx="1.2" fill="#78716c" />

        {/* Headlight */}
        <Circle cx="20" cy="4" r="1.8" fill="#fef08a" />

        {/* Tail light */}
        <Circle cx="20" cy="35" r="1.3" fill="#ef4444" />

        {/* Side mirrors */}
        <Circle cx="12" cy="9" r="1.5" fill="#9ca3af" />
        <Circle cx="28" cy="9" r="1.5" fill="#9ca3af" />
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
