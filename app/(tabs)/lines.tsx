import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ui } from '@/lib/theme'
import { ADINKRA_BAND_DAY } from '@/components/AdinkraAccent'

// Trotro + okada lines — Train is its own top-level tab. The header (Lines + region
// chip + stamp, UX v2 L3) lives in RoutesScreen because it owns the region state.
import RoutesScreen from '@/app/(tabs)/routes'

export default function LinesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
      {/* Status-bar strip matches the Adinkra header band below it. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: ADINKRA_BAND_DAY }} />
      <View style={{ flex: 1 }}>
        <RoutesScreen />
      </View>
    </View>
  )
}
