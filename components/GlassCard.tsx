import { useState, useEffect, type ReactNode } from 'react'
import {
  View,
  Platform,
  AccessibilityInfo,
  StyleSheet,
  useColorScheme,
  type ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { glass } from '@/lib/theme'

interface GlassCardProps {
  children?: ReactNode
  intensity?: number
  tint?: 'light' | 'dark' | 'default'
  borderRadius?: number
  style?: ViewStyle
  fallbackBg?: string
}

export default function GlassCard({
  children,
  intensity,
  tint,
  borderRadius = 0,
  style,
  fallbackBg,
}: GlassCardProps) {
  const isDark = useColorScheme() === 'dark'
  const [reduceTransparency, setReduceTransparency] = useState(false)

  useEffect(() => {
    // iOS-only: check if user enabled Reduce Transparency
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency)
      const sub = AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        setReduceTransparency,
      )
      return () => sub.remove()
    }
  }, [])

  const theme = isDark ? glass.dark : glass.light
  const blurIntensity = intensity ?? glass.blur.card
  const blurTint = tint ?? (isDark ? 'dark' : 'light')
  const solidBg = fallbackBg ?? theme.fallback

  // Accessibility fallback: solid opaque background
  if (reduceTransparency) {
    return (
      <View style={[{ backgroundColor: solidBg, borderRadius }, style]}>
        {children}
      </View>
    )
  }

  return (
    <View style={[{ overflow: 'hidden', borderRadius }, style]}>
      <BlurView
        intensity={blurIntensity}
        tint={blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {/* Tint overlay for depth */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.tint }]} />
      {children}
    </View>
  )
}
