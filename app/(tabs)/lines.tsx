import { useMemo } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { font, ui, space } from '@/lib/theme'
import { RELEASE_MODE } from '@/lib/config/release'
import { dur } from '@/lib/motion'
import Animated, { FadeInDown } from 'react-native-reanimated'

// Trotro routes only — Train is now its own top-level tab.
import RoutesScreen from '@/app/(tabs)/routes'

export default function LinesScreen() {
  const s = useMemo(() => getStyles(), [])
  const { width } = useWindowDimensions()

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: RELEASE_MODE ? '#FFF3EA' : ui.bg, overflow: 'hidden' }}>
        {/* Store release: Adinkra wallpaper behind the tab header (redesign) */}
        {RELEASE_MODE ? <AdinkraWallpaper width={width} height={180} size={26} color="rgba(232,70,26,0.10)" /> : null}
        <Animated.View entering={FadeInDown.duration(dur.base)} style={[s.header, RELEASE_MODE && { paddingBottom: 12 }]}>
          <Text style={s.title}>Lines</Text>
          {RELEASE_MODE && <Text style={s.sub}>GPRTU fares + what riders paid</Text>}
        </Animated.View>
      </SafeAreaView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <RoutesScreen />
      </View>
    </View>
  )
}

const getStyles = () => {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: ui.bg },
    header: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 4 },
    title: {
      fontSize: 28,
      fontFamily: font.displayHeavy,
      color: ui.text,
      letterSpacing: 0,
    },
    sub: { fontSize: 14, fontFamily: font.regular, color: ui.textSecondary },
  })
}
