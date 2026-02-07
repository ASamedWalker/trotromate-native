import { useState, useEffect, useRef, useCallback } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase/client'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export interface PushNotificationState {
  expoPushToken: string | null
  notification: Notifications.Notification | null
  isRegistered: boolean
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted')
    return null
  }

  // Set notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Troski Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
    })
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch (e: any) {
    console.warn('Could not get push token (EAS project ID may not be configured):', e.message)
    return null
  }
}

async function savePushToken(deviceId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('contributor_profiles')
    .update({ push_token: token })
    .eq('device_id', deviceId)

  if (error) {
    console.warn('Failed to save push token:', error.message)
  }
}

export function usePushNotifications(deviceId: string | null, enabled: boolean = true) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notification, setNotification] = useState<Notifications.Notification | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    if (!enabled || !deviceId) return

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token)
        setIsRegistered(true)
        savePushToken(deviceId, token)
      }
    })

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notif) => setNotification(notif)
    )

    // Listen for user tapping on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data
        // Handle navigation based on notification data
        console.log('Notification tapped:', data)
      }
    )

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [deviceId, enabled])

  const clearNotification = useCallback(() => setNotification(null), [])

  return { expoPushToken, notification, isRegistered, clearNotification }
}
