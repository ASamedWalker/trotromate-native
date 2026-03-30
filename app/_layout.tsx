import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useState, useEffect } from 'react'
import { useColorScheme, Appearance } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { AppProvider, useApp } from '@/lib/contexts/AppContext'
import { queryClient } from '@/lib/query-client'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { usePreferences } from '@/lib/hooks/usePreferences'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { useCommuteAlerts } from '@/lib/hooks/useCommuteAlerts'
import OnboardingFlow from '@/components/OnboardingFlow'
import ConfettiCelebration from '@/components/ConfettiCelebration'
import TroskiSplash from '@/components/TroskiSplash'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import { useAppUpdate } from '@/lib/hooks/useAppUpdate'
import StoreUpdateModal from '@/components/StoreUpdateModal'

import '../global.css'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

const TrotroLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#f59e0b',
    background: '#fafaf9',
    card: '#ffffff',
    text: '#1c1917',
    border: '#e7e5e3',
    notification: '#f59e0b',
  },
}

const TrotroDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#f59e0b',
    background: '#0c0a09',
    card: '#1c1917',
    text: '#fafaf9',
    border: '#292524',
    notification: '#f59e0b',
  },
}

function AppInner() {
  const colorScheme = useColorScheme()
  const { deviceId, lastReward, clearLastReward } = useApp()
  const { showOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding()
  const { prefs, isLoaded: prefsLoaded } = usePreferences()
  const [showSplash, setShowSplash] = useState(true)

  // Register for push notifications
  usePushNotifications(deviceId, prefs.pushNotifications)

  // Watch for incidents/queues on saved commute routes
  useCommuteAlerts()

  // Silent OTA updates — download in background, apply on next launch
  useAppUpdate()

  // Apply stored theme preference
  useEffect(() => {
    if (!prefsLoaded) return
    Appearance.setColorScheme(prefs.theme === 'system' ? null : prefs.theme)
  }, [prefsLoaded, prefs.theme])

  if (showSplash) {
    return <TroskiSplash onFinish={() => setShowSplash(false)} />
  }

  if (onboardingLoading) return null

  if (showOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />
  }

  const isDark = colorScheme === 'dark'

  return (
    <ThemeProvider value={isDark ? TrotroDarkTheme : TrotroLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="routes/plan" options={{ headerShown: false }} />
        <Stack.Screen name="routes/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[routeId]" options={{ headerShown: false }} />
        <Stack.Screen name="report/fare" options={{ headerShown: false, presentation: 'formSheet', gestureEnabled: true }} />
        <Stack.Screen name="report/queue" options={{ headerShown: false, presentation: 'formSheet', gestureEnabled: true }} />
        <Stack.Screen name="report/incident" options={{ headerShown: false, presentation: 'formSheet', gestureEnabled: true }} />
        <Stack.Screen name="report/photo" options={{ headerShown: false, presentation: 'formSheet', gestureEnabled: true }} />
        <Stack.Screen name="report/train" options={{ headerShown: false, presentation: 'formSheet', gestureEnabled: true }} />
        <Stack.Screen name="train/index" options={{ headerShown: false }} />
        <Stack.Screen name="train/[lineId]" options={{ headerShown: false }} />
        <Stack.Screen name="stations/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/edit-name" options={{ headerShown: false }} />
        <Stack.Screen name="settings/edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen
          name="reel"
          options={{
            headerShown: false,
            presentation: 'modal',
            gestureEnabled: true,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style="auto" />
      <StoreUpdateModal />
      <ConfettiCelebration reward={lastReward} onDismiss={clearLastReward} />
    </ThemeProvider>
  )
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  // Don't hide native splash here — TroskiSplash will hide it
  // once mounted, preventing the flash between the two splashes
  if (!loaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <AppInner />
          </AppProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  )
}
