import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ui } from '@/lib/theme'

// Trotro + okada lines — Train is its own top-level tab. The header (Lines + region
// chip + stamp, UX v2 L3) lives in RoutesScreen because it owns the region state.
import RoutesScreen from '@/app/(tabs)/routes'

export default function LinesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: ui.bg }} />
      <View style={{ flex: 1 }}>
        <RoutesScreen />
      </View>
    </View>
  )
}
