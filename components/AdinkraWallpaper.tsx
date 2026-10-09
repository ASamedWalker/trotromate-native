import { View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { adinkraPatternXml } from '@/lib/brand/adinkra'

const cache = new Map<string, string>()

/**
 * The Adinkra pattern as a background layer (decoration only: hidden from
 * screen readers, never under numbers or statuses). Daylight = orange at
 * ~12% on the warm band; evening / colour headers = white at 6–8%.
 */
export function AdinkraWallpaper({ width, height, color, size = 28 }: { width: number; height: number; color: string; size?: number }) {
  const w = Math.round(width)
  const key = `${w}x${height}x${size}x${color}`
  let xml = cache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, height, size, color); cache.set(key, xml) }
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgXml xml={xml} width={w} height={height} />
    </View>
  )
}
