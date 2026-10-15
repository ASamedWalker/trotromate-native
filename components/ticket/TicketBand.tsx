import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Animated, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { adinkraBandXml, BAND_TILE } from '@/lib/brand/adinkra'

/**
 * The ticket's day colour (UX v2 TK1). Seven brand-safe colours, one per
 * weekday (Date.getDay order), none of them the frozen grey or the expired red,
 * so a mate learns one rule: "today's band is <colour> and it moves".
 */
export const DAY_BANDS: { day: string; name: string; hex: string }[] = [
  { day: 'Sunday', name: 'purple', hex: '#6D28D9' },
  { day: 'Monday', name: 'blue', hex: '#1D4ED8' },
  { day: 'Tuesday', name: 'teal', hex: '#0F766E' },
  { day: 'Wednesday', name: 'orange', hex: '#FF4D1C' },
  { day: 'Thursday', name: 'green', hex: '#15803D' },
  { day: 'Friday', name: 'gold', hex: '#A16207' },
  { day: 'Saturday', name: 'pink', hex: '#BE185D' },
]
export const todayBand = (d = new Date()) => DAY_BANDS[d.getDay()]

/** Used / expired tickets: the band stops and turns grey (TK4). */
export const FROZEN_BAND = '#A8A29E'

export const BAND_HEIGHT = 72

/**
 * 72 pt Adinkra band (Gye Nyame, Nkyinkyim, Adinkrahene) that slides on an
 * ~8 s loop while the ticket is live. Core RN Animated + native driver only;
 * stops (and stays where it is) when `live` turns false or Reduce Motion is on.
 */
export function TicketBand({ live, color }: { live: boolean; color: string }) {
  const { width } = useWindowDimensions()
  // Slide by a whole number of tiles so the loop restarts seamlessly.
  const shift = Math.max(1, Math.ceil(width / BAND_TILE)) * BAND_TILE
  const stripW = shift * 2
  const xml = useMemo(() => adinkraBandXml(stripW, color), [stripW, color])

  const x = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(v) }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => { alive = false; sub.remove() }
  }, [])

  useEffect(() => {
    if (!live || reduceMotion) { x.stopAnimation(); return }
    x.setValue(0)
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: -shift,
        // Speed = one screen width per 8 s, as on the mockup.
        duration: Math.round((8000 * shift) / Math.max(1, width)),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [live, reduceMotion, shift, width, x])

  return (
    <View
      style={{ height: BAND_HEIGHT, overflow: 'hidden', alignSelf: 'stretch', backgroundColor: color }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ width: stripW, height: BAND_HEIGHT, transform: [{ translateX: x }] }}>
        <SvgXml xml={xml} width={stripW} height={BAND_HEIGHT} />
      </Animated.View>
    </View>
  )
}
