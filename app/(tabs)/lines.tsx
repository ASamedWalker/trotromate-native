import { useMemo } from 'react'
import { View, Text, useColorScheme, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { font, themed } from '@/lib/theme'
import { dur } from '@/lib/motion'
import Animated, { FadeInDown } from 'react-native-reanimated'

// Trotro routes only — Train is now its own top-level tab.
import RoutesScreen from '@/app/(tabs)/routes'

export default function LinesScreen() {
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: themed(isDark).bg }}>
        <Animated.View entering={FadeInDown.duration(dur.base)} style={s.header}>
          <Text style={s.title}>Lines</Text>
        </Animated.View>
      </SafeAreaView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <RoutesScreen />
      </View>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
    title: {
      fontSize: 28,
      fontFamily: font.displayHeavy,
      color: t.text,
      letterSpacing: 0,
    },
  })
}
