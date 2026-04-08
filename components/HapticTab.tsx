import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { PlatformPressable } from '@react-navigation/elements'
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * Custom tab bar button that fires a light haptic on press-in.
 *
 * Matches Moovit / Uber / Apple Music pattern — haptic on finger-down
 * (onPressIn), not on release. Feels snappier than waiting for navigation
 * to commit. Based on Expo's create-expo-app starter template.
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
        props.onPressIn?.(ev)
      }}
    />
  )
}
