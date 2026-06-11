import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg'

/**
 * The Troski Coin — gold coin with an embossed "T" and a shine.
 * Pure SVG so it stays crisp at any size (pts pills → hero gauge).
 */
export default function TroskiCoin({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="tcRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD966" />
          <Stop offset="1" stopColor="#C77D00" />
        </LinearGradient>
        <LinearGradient id="tcFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE89B" />
          <Stop offset="0.5" stopColor="#FFC93C" />
          <Stop offset="1" stopColor="#F0A500" />
        </LinearGradient>
      </Defs>
      {/* Rim + face */}
      <Circle cx="50" cy="50" r="48" fill="url(#tcRim)" />
      <Circle cx="50" cy="50" r="40" fill="url(#tcFace)" />
      <Circle cx="50" cy="50" r="40" fill="none" stroke="#D98E04" strokeWidth="2" opacity="0.55" />
      {/* Embossed T */}
      <Rect x="29" y="29" width="42" height="13" rx="5" fill="#B45309" />
      <Rect x="43.5" y="34" width="13" height="40" rx="5" fill="#B45309" />
      {/* Shine arc + sparkle */}
      <Path d="M 20 32 A 38 38 0 0 1 48 11" stroke="#FFF6D9" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M 79 14 l 2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" fill="#FFFDF5" />
    </Svg>
  )
}
