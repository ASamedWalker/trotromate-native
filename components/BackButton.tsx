import { useState } from 'react'
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useHaptics } from '@/lib/hooks/useHaptics'

interface BackButtonProps {
  /** plain = header row (no background). floating = white circle over maps/photos/heroes. */
  variant?: 'plain' | 'floating'
  /** floating only: light = white circle (maps), dark = see-through dark glass (dark heroes). */
  tone?: 'light' | 'dark'
  color?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function BackButton({ variant = 'plain', tone = 'light', color, onPress, style }: BackButtonProps) {
  const router = useRouter()
  const haptics = useHaptics()
  // NativeWind drops Pressable function/array styles in this app: track pressed
  // state manually and pass flattened plain objects.
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    if (onPress) {
      onPress()
      return
    }
    haptics.light()
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  const a11y = { accessibilityRole: 'button' as const, accessibilityLabel: 'Go back' }

  if (variant === 'floating' && tone === 'dark') {
    return (
      <Pressable
        {...a11y}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([styles.darkCircle, pressed && styles.darkPressed, style])}
      >
        <ChevronLeft size={22} strokeWidth={2.2} color={color ?? '#FFFFFF'} />
      </Pressable>
    )
  }

  if (variant === 'floating') {
    return (
      <View style={StyleSheet.flatten([styles.floatingShadow, style])}>
        <Pressable
          {...a11y}
          onPress={handlePress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={StyleSheet.flatten([styles.floatingCircle, pressed && styles.floatingPressed])}
        >
          <ChevronLeft size={22} color={color ?? '#111111'} />
        </Pressable>
      </View>
    )
  }

  return (
    <Pressable
      {...a11y}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={StyleSheet.flatten([styles.plain, pressed && styles.plainPressed, style])}
    >
      <ChevronLeft size={24} strokeWidth={2.2} color={color ?? '#111111'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  plain: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    marginRight: 4,
  },
  plainPressed: { backgroundColor: 'rgba(17,17,17,0.08)' },
  floatingShadow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  floatingCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingPressed: { backgroundColor: '#F5F5F4' },
  // Matches the dark glass action buttons on heroes (e.g. the route page's save heart).
  darkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,25,23,0.45)',
  },
  darkPressed: { backgroundColor: 'rgba(28,25,23,0.65)' },
})
