import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { Eye, EyeOff } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { adinkraPatternXml, guillocheXml, landmarkSceneXml, type LandmarkScene } from '@/lib/brand/adinkra'

/**
 * Troski wallet card — split like a Ghana transit card: a colour panel with
 * the wordmark and landmark line art, and a light panel printed with adinkra
 * symbols that carries the live balance.
 */
export type WalletCardTheme = 'orange' | 'black' | 'green' | 'gold'

// One card per Rewards tier (see lib/hooks/useWalletCardTheme.ts).
export const CARD_THEMES: Record<WalletCardTheme, { from: string; to: string; tier: string; scene: LandmarkScene; ink: string; pin: string; line: string }> = {
  orange: { from: '#FF5A24', to: '#D9400F', tier: 'Passenger', scene: 'gateOnly', ink: '#FFFFFF', pin: '#FFFFFF', line: 'rgba(255,255,255,0.30)' },
  green: { from: '#1E8A4C', to: '#0F6634', tier: 'Regular', scene: 'trotro', ink: '#FFFFFF', pin: '#F5A300', line: 'rgba(255,255,255,0.30)' },
  black: { from: '#2A2522', to: '#141110', tier: 'Local Expert', scene: 'lighthouse', ink: '#FFFFFF', pin: '#F5A300', line: 'rgba(255,255,255,0.30)' },
  gold: { from: '#E0B04A', to: '#B8862A', tier: 'Troski Legend', scene: 'star', ink: '#1C1917', pin: '#1C1917', line: 'rgba(28,25,23,0.30)' },
}
const THEMES = CARD_THEMES

// troski.me wordmark: "tr" + map pin as the "o" + "ski"
// Pin's head sits on the lowercase letters, point at the baseline (Baloo 2 metrics).
const PIN_DROP = -0.08
const PIN_PATH = 'M12 0C5.4 0 0 5.3 0 11.9 0 20.4 12 32 12 32s12-11.6 12-20.1C24 5.3 18.6 0 12 0zm0 6.6a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6z'
export function Wordmark({ size, ink, pin }: { size: number; ink: string; pin: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Troski">
      <Text style={[s.wordmark, { fontSize: size, color: ink }]}>tr</Text>
      <SvgXml
        xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32"><path fill-rule="evenodd" fill="${pin}" d="${PIN_PATH}"/></svg>`}
        width={size * 0.56}
        height={size * 0.75}
        style={{ marginHorizontal: 1, transform: [{ translateY: size * PIN_DROP }] }}
      />
      <Text style={[s.wordmark, { fontSize: size, color: ink }]}>ski</Text>
    </View>
  )
}

const ASPECT = 1.586 // ID-1 card ratio

// Pattern xml is large (~100 KB); build it once per size and share it between
// the Home and Wallet cards instead of re-generating per mount.
const artCache = new Map<string, { scene: string; pattern: string; guilloche: string }>()
function cardArt(theme: WalletCardTheme, lw: number, rw: number, h: number, fs: number) {
  const key = `${theme}:${lw}:${rw}:${h}`
  let art = artCache.get(key)
  if (!art) {
    const t = THEMES[theme]
    art = {
      scene: landmarkSceneXml(t.scene, lw, h, t.line),
      pattern: adinkraPatternXml(rw, h, 20 * fs, '#E6E0DA'),
      guilloche: guillocheXml(rw, h, '#DAD3CC'),
    }
    artCache.set(key, art)
  }
  return art
}

export function WalletCard({
  balanceText,
  label = 'Wallet balance',
  balanceVisible,
  onToggleBalance,
  footnote,
  theme = 'orange',
  onPressCard,
  compact = false,
}: {
  balanceText: string
  label?: string
  balanceVisible: boolean
  onToggleBalance: () => void
  /** Small line under the balance, e.g. a stale-balance notice. */
  footnote?: string
  theme?: WalletCardTheme
  /** Tap on the card body (not the eye) — opens "Your card". */
  onPressCard?: () => void
  /** Picker thumbnails: no balance row, no eye. */
  compact?: boolean
}) {
  const t = THEMES[theme]
  const [w, setW] = useState(0)
  const h = Math.round(w / ASPECT)
  const lw = Math.round(w * 0.4)
  const rw = w - lw
  const fs = w / 350

  // The art only depends on size + theme; build the xml once per layout.
  const art = useMemo(() => (w ? cardArt(theme, lw, rw, h, fs) : null), [theme, w, lw, rw, h, fs])

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width)
    if (next !== w) setW(next)
  }

  return (
    <View
      onLayout={onLayout}
      style={[s.card, { height: h || undefined, aspectRatio: w ? undefined : ASPECT, borderRadius: 16 * (fs || 1) }]}
    >
      {art && onPressCard && (
        <Pressable
          onPress={onPressCard}
          style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
          accessibilityRole="button"
          accessibilityLabel={`${t.tier} card. Change card`}
        />
      )}
      {art && (
        <>
          <LinearGradient
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            colors={[t.from, t.to]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ width: lw, height: h }}>
            <SvgXml xml={art.scene} width={lw} height={h} style={StyleSheet.absoluteFill} />
            <View style={[s.brandRow, { left: 14 * fs, top: 10 * fs }]}>
              <Wordmark size={20 * fs} ink={t.ink} pin={t.pin} />
            </View>
            <Text style={[s.tagline, { left: 14 * fs, bottom: 9 * fs, fontSize: 11 * fs, color: t.ink }]}>Ride Ghana&apos;s trotros</Text>
          </LinearGradient>

          <View style={{ width: rw, height: h }} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={art.pattern} width={rw} height={h} style={StyleSheet.absoluteFill} />
              <SvgXml xml={art.guilloche} width={rw} height={h} style={StyleSheet.absoluteFill} />
            </View>
            <Text pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no" style={[s.tier, { right: 14 * fs, top: 12 * fs, fontSize: 14 * fs }]}>{t.tier}</Text>
            {!compact && (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 16 * fs, right: 10 * fs, bottom: (footnote ? 10 : 18) * fs }}>
              <Text pointerEvents="none" style={[s.label, { fontSize: 12 * fs }]} accessibilityElementsHidden importantForAccessibility="no">{label}</Text>
              <View style={[s.balanceRow, { gap: 8 * fs }]}>
                <Text
                  pointerEvents="none"
                  style={[s.balance, { fontSize: 27 * fs }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  accessibilityLabel={`${label}: ${balanceVisible ? balanceText : 'hidden'}${footnote ? `. ${footnote}` : ''}`}
                >
                  {balanceText}
                </Text>
                <Pressable
                  onPress={onToggleBalance}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}
                >
                  {balanceVisible ? <Eye size={18 * fs} color="#57534E" /> : <EyeOff size={18 * fs} color="#57534E" />}
                </Pressable>
              </View>
              {footnote ? (
                <Text pointerEvents="none" style={[s.footnote, { fontSize: 11 * fs }]} numberOfLines={2} accessibilityElementsHidden importantForAccessibility="no">
                  {footnote}
                </Text>
              ) : null}
            </View>
            )}
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#F6F3F0',
    shadowColor: '#1C1917',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  brandRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontFamily: font.extrabold, letterSpacing: -0.3 },
  tagline: { position: 'absolute', fontFamily: font.bold, opacity: 0.95 },
  tier: { position: 'absolute', fontFamily: font.bold, color: '#1C1917' },
  label: { fontFamily: font.semibold, color: '#57534E' },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balance: { flexShrink: 1, fontFamily: font.extrabold, color: '#1C1917', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  footnote: { fontFamily: font.semibold, color: '#B45309', marginTop: 2 },
})
