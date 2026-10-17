import React, { memo } from 'react'
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { adinkraXml, type AdinkraName } from '@/lib/brand/adinkra'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'

/**
 * Shared Adinkra styling for the redesign (owner rule: every header and hero card
 * carries Adinkra). Two pieces, both decoration only — hidden from screen readers,
 * taps pass through, the SVG string is built once per (symbol, size, colour):
 *
 *  - <AdinkraBand>: the warm #FFF3EA (day) / #16110D (evening) header band with the
 *    pattern wallpaper behind the header content.
 *  - <AdinkraAccent>: one faint symbol tucked into a card's corner or right side.
 *    Render it as the card's FIRST child and give the card `overflow: 'hidden'`.
 *    Keep it away from numbers and statuses; opacity 0.06–0.16.
 */

export const ADINKRA_BAND_DAY = '#FFF3EA'
export const ADINKRA_BAND_NIGHT = '#16110D'
/** Wallpaper ink: orange ~10% on the warm band, white ~7% on the evening band. */
export const ADINKRA_INK_DAY = 'rgba(232,70,26,0.10)'
export const ADINKRA_INK_NIGHT = 'rgba(255,255,255,0.07)'

const xmlCache = new Map<string, string>()
function symbolXml(name: AdinkraName, size: number, color: string): string {
  const key = `${name}|${size}|${color}`
  let xml = xmlCache.get(key)
  if (!xml) { xml = adinkraXml(name, size, color); xmlCache.set(key, xml) }
  return xml
}

/** 'inline' = in normal layout flow (e.g. a small mark beside a section title). */
export type AdinkraPosition = 'right' | 'topRight' | 'bottomRight' | 'topLeft' | 'bottomLeft' | 'inline'

type AccentProps = {
  symbol?: AdinkraName
  /** Symbol box in pt. */
  size?: number
  color?: string
  opacity?: number
  position?: AdinkraPosition
  /** Distance from the card edge; negative lets the symbol bleed off (clipped by the card). */
  inset?: number
  /** Optional rotation in degrees for a hand-stamped feel. */
  rotate?: number
}

export const AdinkraAccent = memo(function AdinkraAccent({
  symbol = 'gye_nyame', size = 72, color = '#FFFFFF', opacity = 0.12, position = 'right', inset = -10, rotate = 0,
}: AccentProps) {
  const pos: ViewStyle =
    position === 'inline' ? {}
      : position === 'right' ? { right: inset, top: '50%', marginTop: -size / 2 }
      : position === 'topRight' ? { right: inset, top: inset }
        : position === 'bottomRight' ? { right: inset, bottom: inset }
          : position === 'topLeft' ? { left: inset, top: inset }
            : { left: inset, bottom: inset }
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: position === 'inline' ? 'relative' : 'absolute', width: size, height: size, opacity }, pos, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null]}
    >
      <SvgXml xml={symbolXml(symbol, size, color)} width={size} height={size} />
    </View>
  )
})

type BandProps = {
  children: React.ReactNode
  /** Evening variant: dark band, faint white pattern. */
  night?: boolean
  /** Background (defaults to the day / evening band colour). */
  bg?: string
  /** Pattern ink (defaults to the day / evening ink). */
  ink?: string
  /** Height of the pattern canvas; the band clips it, so err on the tall side. */
  patternHeight?: number
  patternSize?: number
  style?: StyleProp<ViewStyle>
}

/** Header band: warm background + the Adinkra wallpaper behind its children. */
export function AdinkraBand({ children, night = false, bg, ink, patternHeight = 240, patternSize = 26, style }: BandProps) {
  const { width } = useWindowDimensions()
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: bg ?? (night ? ADINKRA_BAND_NIGHT : ADINKRA_BAND_DAY) }, style]}>
      <AdinkraWallpaper width={width} height={patternHeight} size={patternSize} color={ink ?? (night ? ADINKRA_INK_NIGHT : ADINKRA_INK_DAY)} />
      {children}
    </View>
  )
}

/**
 * The repeating Adinkra wallpaper behind a HERO card (owner 2026-10-16: pattern,
 * not a single corner symbol). Render as the card's FIRST child; the card needs
 * `overflow: 'hidden'`. The canvas is screen-wide and `height` tall and the card
 * clips it, so it never needs a layout pass; the XML is cached per size+ink inside
 * AdinkraWallpaper, so every card of one kind shares one string.
 * Ink: white 0.08–0.12 on colour cards; brand/tint ~0.06–0.08 on light cards.
 */
export const AdinkraCardPattern = memo(function AdinkraCardPattern({
  height = 240, ink, size = 26,
}: { height?: number; ink: string; size?: number }) {
  const { width } = useWindowDimensions()
  return <AdinkraWallpaper width={width} height={height} size={size} color={ink} />
})
