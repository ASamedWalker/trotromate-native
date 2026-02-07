import { useCallback } from 'react'
import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

export function useHaptics() {
  const light = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const medium = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [])

  const heavy = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }, [])

  const success = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])

  const warning = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }, [])

  const error = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }, [])

  const selection = useCallback(() => {
    if (Platform.OS === 'web') return
    Haptics.selectionAsync()
  }, [])

  return { light, medium, heavy, success, warning, error, selection }
}
