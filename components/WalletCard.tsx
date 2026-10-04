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

const THEMES: Record<WalletCardTheme, { from: string; to: string; tier: string; scene: LandmarkScene; ink: string; line: string }> = {
  orange: { from: '#FF5A24', to: '#D9400F', tier: 'Wallet', scene: 'gate', ink: '#FFFFFF', line: 'rgba(255,255,255,0.30)' },
  black: { from: '#2A2522', to: '#141110', tier: 'Wallet', scene: 'lighthouse', ink: '#FFFFFF', line: 'rgba(255,255,255,0.30)' },
  green: { from: '#1E8A4C', to: '#0F6634', tier: 'Wallet', scene: 'trotro', ink: '#FFFFFF', line: 'rgba(255,255,255,0.30)' },
  gold: { from: '#E0B04A', to: '#B8862A', tier: 'Wallet', scene: 'star', ink: '#1C1917', line: 'rgba(28,25,23,0.30)' },
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
}: {
  balanceText: string
  label?: string
  balanceVisible: boolean
  onToggleBalance: () => void
  /** Small line under the balance, e.g. a stale-balance notice. */
  footnote?: string
  theme?: WalletCardTheme
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
      {art && (
        <>
          <LinearGradient
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            colors={[t.from, t.to]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ width: lw, height: h }}>
            <SvgXml xml={art.scene} width={lw} height={h} style={StyleSheet.absoluteFill} />
            <View style={[s.brandRow, { left: 14 * fs, top: 12 * fs, gap: 5 * fs }]}>
              <View style={[s.dotOuter, { width: 16 * fs, height: 16 * fs, borderRadius: 8 * fs, backgroundColor: t.ink }]}>
                <View style={{ width: 7 * fs, height: 7 * fs, borderRadius: 3.5 * fs, backgroundColor: t.from }} />
              </View>
              <Text style={[s.wordmark, { fontSize: 19 * fs, color: t.ink }]}>troski</Text>
            </View>
            <Text style={[s.tagline, { left: 14 * fs, bottom: 9 * fs, fontSize: 11 * fs, color: t.ink }]}>Ride Ghana&apos;s trotros</Text>
          </LinearGradient>

          <View style={{ width: rw, height: h }}>
            <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={art.pattern} width={rw} height={h} style={StyleSheet.absoluteFill} />
              <SvgXml xml={art.guilloche} width={rw} height={h} style={StyleSheet.absoluteFill} />
            </View>
            <Text accessibilityElementsHidden importantForAccessibility="no" style={[s.tier, { right: 14 * fs, top: 12 * fs, fontSize: 14 * fs }]}>{t.tier}</Text>
            <View style={{ position: 'absolute', left: 16 * fs, right: 10 * fs, bottom: (footnote ? 10 : 18) * fs }}>
              <Text style={[s.label, { fontSize: 12 * fs }]} accessibilityElementsHidden importantForAccessibility="no">{label}</Text>
              <View style={[s.balanceRow, { gap: 8 * fs }]}>
                <Text
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
                <Text style={[s.footnote, { fontSize: 11 * fs }]} numberOfLines={2} accessibilityElementsHidden importantForAccessibility="no">
                  {footnote}
                </Text>
              ) : null}
            </View>
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
  dotOuter: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: font.extrabold, letterSpacing: -0.3 },
  tagline: { position: 'absolute', fontFamily: font.bold, opacity: 0.95 },
  tier: { position: 'absolute', fontFamily: font.bold, color: '#1C1917' },
  label: { fontFamily: font.semibold, color: '#57534E' },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balance: { flexShrink: 1, fontFamily: font.extrabold, color: '#1C1917', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  footnote: { fontFamily: font.semibold, color: '#B45309', marginTop: 2 },
})
