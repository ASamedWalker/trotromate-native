import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font } from '@/lib/theme'

/**
 * Brand-accurate wordmark badges for Ghana's mobile-money networks.
 * Built from each provider's official colours + mark (not bundled logo art),
 * so they always render crisply and stay trademark-safe. Swap for official
 * vector/PNG logos here if brand-approved assets become available.
 *   mtn → MTN MoMo (black on yellow)
 *   atl → AirtelTigo / AT Money (white on Airtel-red→Tigo-blue gradient)
 *   tgo → Telecel Cash (white on Telecel red)
 */
export type NetworkId = 'mtn' | 'atl' | 'tgo'

export default function NetworkLogo({ id, width = 50, height = 36, style }: {
  id: NetworkId
  width?: number
  height?: number
  style?: ViewStyle
}) {
  const radius = 9
  const base: ViewStyle = { width, height, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }

  if (id === 'mtn') {
    return (
      <View style={[base, { backgroundColor: '#FFCC00' }, style]}>
        <Text style={[s.mark, { color: '#000' }]} numberOfLines={1} adjustsFontSizeToFit>MTN</Text>
      </View>
    )
  }
  if (id === 'atl') {
    return (
      <LinearGradient colors={['#ED1C24', '#1B47B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[base, style]}>
        <Text style={[s.mark, { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>AT</Text>
      </LinearGradient>
    )
  }
  // tgo — Telecel
  return (
    <View style={[base, { backgroundColor: '#E2231A' }, style]}>
      <Text style={[s.wordmark, { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>telecel</Text>
    </View>
  )
}

const s = StyleSheet.create({
  mark: { fontFamily: font.extrabold, fontSize: 15, letterSpacing: 0.3 },
  wordmark: { fontFamily: font.extrabold, fontSize: 12, letterSpacing: -0.2, paddingHorizontal: 5 },
})
