import { memo, useCallback, useState, type ReactNode } from 'react'
import { View, Text, Platform, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { font } from '@/lib/theme'
import { adinkraPatternXml } from '@/lib/brand/adinkra'

/**
 * Paper Ticket card — the troski.me ticket (trotromate components/site/Ticket.tsx +
 * app/landing.css `.lp .stub / .tear / .tix`) on native: a coloured STUB carrying the
 * Adinkra wallpaper (repeating tile, never one symbol), a dashed TEAR under it, and two
 * half-circle NOTCHES punched out at both ends of the tear.
 *
 * Technique: the whole card background is ONE react-native-svg drawing sized from
 * onLayout — a path with real notch arcs (white paper + hairline), the stub band clipped
 * to that path, the wallpaper inside the stub, and the tear. The notches are true
 * cut-outs, so they read right on any background, and the shadow follows the shape:
 * iOS draws the native layer shadow from the content alpha (the wrapper has no
 * backgroundColor), Android gets two faint offset copies of the path inside the SVG
 * (elevation only follows a rect outline and needs a solid background, so it can't).
 * No animation, no reanimated: safe inside ScrollView on Android.
 */

export type TicketTone = 'fare' | 'train' | 'ink'

export const TICKET_TONES: Record<TicketTone, { stub: string; wallpaper: string; wallpaperOpacity: number }> = {
  fare: { stub: '#C2410C', wallpaper: '#000000', wallpaperOpacity: 0.16 },
  train: { stub: '#14873F', wallpaper: '#000000', wallpaperOpacity: 0.16 },
  ink: { stub: '#1C1917', wallpaper: '#FFFFFF', wallpaperOpacity: 0.1 },
}

export const TICKET_INK = '#1C1917'
export const TICKET_STUB_H = 48
const RADIUS = 18
const NOTCH = 9
const HAIR = 'rgba(28,25,23,0.10)'
const TEAR = 'rgba(28,25,23,0.20)'

function outline(w: number, h: number, y: number, r = RADIUS, n = NOTCH): string {
  return [
    `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r}`,
    `V${y - n} A${n},${n} 0 0 0 ${w},${y + n}`,
    `V${h - r} A${r},${r} 0 0 1 ${w - r},${h}`,
    `H${r} A${r},${r} 0 0 1 0,${h - r}`,
    `V${y + n} A${n},${n} 0 0 0 0,${y - n}`,
    `V${r} A${r},${r} 0 0 1 ${r},0 Z`,
  ].join(' ')
}

const cache = new Map<string, string>()

function ticketXml(w: number, h: number, tone: TicketTone): string {
  const key = `${w}x${h}:${tone}`
  const hit = cache.get(key)
  if (hit) return hit
  const t = TICKET_TONES[tone]
  const y = TICKET_STUB_H
  const d = outline(w, h, y)
  // Wallpaper tile drawn only inside the stub; strip the inner <svg> wrapper so it can be clipped.
  const wp = adinkraPatternXml(w, y, 16, t.wallpaper).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const androidShadow = Platform.OS === 'android'
    ? `<path d="${d}" transform="translate(0,2.5)" fill="rgba(28,25,23,0.05)"/><path d="${d}" transform="translate(0,1)" fill="rgba(28,25,23,0.06)"/>`
    : ''
  // Android needs room under the card for the drawn shadow: the SVG is 3px taller than the card.
  const svgH = h + (Platform.OS === 'android' ? 3 : 0)
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}">` +
    `<defs><clipPath id="tk"><path d="${d}"/></clipPath></defs>` +
    androidShadow +
    `<path d="${d}" fill="#FFFFFF"/>` +
    `<g clip-path="url(#tk)"><rect x="0" y="0" width="${w}" height="${y}" fill="${t.stub}"/><g opacity="${t.wallpaperOpacity}">${wp}</g></g>` +
    `<line x1="${NOTCH + 6}" y1="${y + 1.5}" x2="${w - NOTCH - 6}" y2="${y + 1.5}" stroke="${TEAR}" stroke-width="1.5" stroke-dasharray="5 4"/>` +
    `<path d="${d}" fill="none" stroke="${HAIR}" stroke-width="1"/>` +
    `</svg>`
  if (cache.size > 64) cache.clear()
  cache.set(key, xml)
  return xml
}

const TicketBackground = memo(function TicketBackground({ w, h, tone }: { w: number; h: number; tone: TicketTone }) {
  const svgH = h + (Platform.OS === 'android' ? 3 : 0)
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgXml xml={ticketXml(w, h, tone)} width={w} height={svgH} />
    </View>
  )
})

export function TicketCard({
  tone = 'fare',
  label,
  value,
  stub,
  children,
  style,
  bodyStyle,
  accessibilityLabel,
}: {
  tone?: TicketTone
  /** Stub title (white, 17/700, one line). */
  label?: string
  /** Optional right-hand stub value (white, 15/700, one line). */
  value?: string
  /** Custom stub content instead of label/value (keep it on one 48pt line, white text). */
  stub?: ReactNode
  children: ReactNode
  style?: StyleProp<ViewStyle>
  bodyStyle?: StyleProp<ViewStyle>
  /** Read the stub as a header, e.g. "STC, source stcgh.com". */
  accessibilityLabel?: string
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width)
    const h = Math.round(e.nativeEvent.layout.height)
    setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
  }, [])
  const t = TICKET_TONES[tone]
  return (
    <View
      onLayout={onLayout}
      style={[
        // No backgroundColor on purpose: iOS then casts the shadow from the SVG's alpha (notches included).
        Platform.OS === 'ios' ? { shadowColor: TICKET_INK, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } } : null,
        style,
      ]}
    >
      {/* White underlay below the notches: if the card grows (e.g. "Show all trains"),
          the frame before onLayout redraws the shape shows white here, never a gap. */}
      {size ? <View pointerEvents="none" style={{ position: 'absolute', top: TICKET_STUB_H + 12, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS }} /> : null}
      {size ? (
        <TicketBackground w={size.w} h={size.h} tone={tone} />
      ) : (
        // First frame, before onLayout: plain card so content never sits on nothing.
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS, backgroundColor: '#FFFFFF', overflow: 'hidden' }} pointerEvents="none">
          <View style={{ height: TICKET_STUB_H, backgroundColor: t.stub }} />
        </View>
      )}
      <View
        style={{ height: TICKET_STUB_H, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        accessible={!!(label || accessibilityLabel)}
        accessibilityRole="header"
        accessibilityLabel={accessibilityLabel ?? (label ? `${label}${value ? `, ${value}` : ''}` : undefined)}
      >
        {stub ?? (
          <>
            <Text style={{ flex: 1, minWidth: 0, fontFamily: font.bold, fontSize: 17, color: '#FFFFFF' }} numberOfLines={1}>{label}</Text>
            {value ? (
              <Text style={{ flexShrink: 0, maxWidth: '55%', fontFamily: font.bold, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                {value}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }, bodyStyle]}>{children}</View>
    </View>
  )
}
