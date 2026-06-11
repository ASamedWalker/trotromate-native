import { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { c, font, themed } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

// Import existing screen components
import RoutesScreen from '@/app/(tabs)/routes'
import TrainScreen from '@/app/train/index'

type LinesTab = 'trotro' | 'train'

export default function LinesScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])
  const [activeTab, setActiveTab] = useState<LinesTab>('trotro')

  const handleTabChange = (tab: LinesTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveTab(tab)
  }

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.bg }}>
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={s.title}>Lines</Text>
        </Animated.View>

        {/* Segment control */}
        <View style={s.segmentWrap}>
          {(['trotro', 'train'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.segmentBtn, activeTab === tab && s.segmentBtnActive]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.segmentText, activeTab === tab && s.segmentTextActive]}>
                {tab === 'trotro' ? 'Trotro Routes' : 'Train'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'trotro' ? <RoutesScreen /> : <TrainScreen />}
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
    segmentWrap: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 6,
      marginBottom: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 12,
      padding: 3,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    segmentBtnActive: {
      backgroundColor: isDark ? '#292524' : '#ffffff',
      ...(!isDark ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      } : {}),
    },
    segmentText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: isDark ? '#78716c' : '#a8a29e',
    },
    segmentTextActive: {
      color: isDark ? '#fafaf9' : '#1c1917',
      fontFamily: font.bold,
    },
  })
}
