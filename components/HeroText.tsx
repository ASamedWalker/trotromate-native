import { Text, type TextProps, type TextStyle } from 'react-native'
import { font } from '@/lib/theme'

/**
 * Display-size Baloo 2 text with safe line metrics baked in.
 *
 * Baloo 2's line box is 1.6em and RN bottom-anchors clamped lines, so any
 * hand-set lineHeight under ~1.3x fontSize slices the glyph tops (the June
 * 2026 "GH₵ cut off" bug, fixed in 6 places by 53e986d). This component is
 * the ONE place that rule lives — use it for every hero fare, big title,
 * stat and countdown instead of raw <Text fontSize≥20>.
 *
 * Color/letterSpacing stay in the caller's style; metrics live here.
 */
const SAFE_LINE_RATIO = 1.32

interface HeroTextProps extends TextProps {
  /** fontSize — lineHeight is derived automatically */
  size: number
  /** font token name, defaults to extrabold */
  weight?: keyof typeof font
}

export function HeroText({ size, weight = 'extrabold', style, ...rest }: HeroTextProps) {
  const metrics: TextStyle = {
    fontSize: size,
    lineHeight: Math.round(size * SAFE_LINE_RATIO),
    fontFamily: font[weight],
  }
  return <Text {...rest} style={[metrics, style]} />
}
