import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useState, useEffect, useCallback } from 'react'
import { useColorScheme, Appearance } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'
import { AppProvider, useApp } from '@/lib/contexts/AppContext'
import { AuthProvider } from '@/lib/contexts/AuthContext'
import { queryClient, persistOptions } from '@/lib/query-client'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { loadLanguage } from '@/lib/i18n'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePreferences } from '@/lib/hooks/usePreferences'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { useCommuteAlerts } from '@/lib/hooks/useCommuteAlerts'
import { useCheckin } from '@/lib/hooks/useCheckin'
import { useWatchSync } from '@/lib/hooks/useWatchSync'
import OnboardingFlow from '@/components/OnboardingFlow'
import ConfettiCelebration from '@/components/ConfettiCelebration'
import TroskiSplash from '@/components/TroskiSplash'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import { useAppUpdate } from '@/lib/hooks/useAppUpdate'
import StoreUpdateModal from '@/components/StoreUpdateModal'
import OtaUpdateBanner from '@/components/OtaUpdateBanner'
import OfflineBanner from '@/components/OfflineBanner'

import Mapbox from '@rnmapbox/maps'
import '../global.css'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'

// Centralized Mapbox init — must happen ONCE, early, before any MapView renders
Mapbox.setAccessToken(MAPBOX_TOKEN)

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

function OnboardingRedirect({ action, onDone }: { action: 'register' | 'login' | null; onDone: () => void }) {
  const router = useRouter()
  useEffect(() => {
    if (!action) return
    const route = action === 'register' ? '/register/phone' : '/auth/phone'
    // Defer one tick so the root navigator is mounted before navigating
    // (replacing too early leaves a blank screen). replace, not push, so home
    // isn't left underneath. The full-screen (non-modal) auth screen covers
    // home, so this no longer flashes the way the old modal did.
    const t = setTimeout(() => {
      router.replace(route as any)
      onDone()
    }, 0)
    return () => clearTimeout(t)
  }, [action])
  return null
}

function AppInner() {
  const colorScheme = useColorScheme()
  const { deviceId, lastReward, clearLastReward } = useApp()
  const { showOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding()
  const [onboardingAction, setOnboardingAction] = useState<'register' | 'login' | null>(null)
  const { prefs, isLoaded: prefsLoaded } = usePreferences()
  const [showSplash, setShowSplash] = useState(true)
  const [signedOut, setSignedOut] = useState(false)

  // Check if user explicitly signed out — redirect to login
  useEffect(() => {
    AsyncStorage.getItem('troski_signed_out').then(val => {
      if (val === 'true') {
        setSignedOut(true)
        setOnboardingAction('login')
        setShowSplash(false)
      }
    })
  }, [])

  // Register for push notifications
  usePushNotifications(deviceId, prefs.pushNotifications)

  // Watch for incidents/queues on saved commute routes
  useCommuteAlerts()

  // Record daily check-in for view-based streaks
  useCheckin(deviceId)

  // Sync commute data to Apple Watch
  useWatchSync(deviceId)

  // OTA update hook moved to RootLayout for earlier execution

  // Force light mode — dark mode disabled until properly tested
  useEffect(() => {
    Appearance.setColorScheme('light')
    loadLanguage() // restore saved language (i18n scaffold)
  }, [])

  // Safety net: hide the native splash once the app shell is mounted.
  // TroskiSplash also calls this, but the onboarding and signed-out paths
  // skip TroskiSplash — without this the native splash would never hide and
  // would cover the UI forever on a fresh install / after sign-out.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  if (onboardingLoading) return null

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={(action?: string) => {
          if (action === 'register' || action === 'login') {
            setOnboardingAction(action)
            setShowSplash(false) // skip splash — go straight to registration
          }
          completeOnboarding()
        }}
        deviceId={deviceId}
      />
    )
  }

  // Skip splash if coming from onboarding with an action
  if (showSplash && !onboardingAction && !signedOut) {
    return <TroskiSplash onFinish={() => setShowSplash(false)} />
  }

  const isDark = colorScheme === 'dark'

  return (
    <ThemeProvider value={isDark ? TrotroDarkTheme : TrotroLightTheme}>
      <OnboardingRedirect action={onboardingAction} onDone={() => setOnboardingAction(null)} />
      <OfflineBanner />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="routes/search" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="routes/detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="routes/pick-location" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="routes/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[routeId]" options={{ headerShown: false }} />
        <Stack.Screen name="event/[placementId]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="whatson" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="ev/index" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ev/report" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report/fare" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="report/queue" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="report/incident" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="report/photo" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="report/train" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="train/index" options={{ headerShown: false }} />
        <Stack.Screen name="train/[lineId]" options={{ headerShown: false }} />
        <Stack.Screen name="stations/index" options={{ headerShown: false }} />
        <Stack.Screen name="queue/status" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="terminals/index" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="traffic/status" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/[deviceId]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/followers" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/edit-name" options={{ headerShown: false }} />
        <Stack.Screen name="settings/edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings/notifications" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="bulletin/index" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        {/* Full-screen card (NOT modal) so it fully covers home — a modal
            slides up and reveals home behind it (the "home flashes before
            login" bug). slide_from_bottom keeps the upward feel. */}
        <Stack.Screen name="auth/phone" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/verify" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="booking/checkout" options={{ headerShown: false }} />
        <Stack.Screen name="booking/processing" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="booking/receipt" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="booking/arrived" options={{ headerShown: false }} />
        <Stack.Screen name="booking/track" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="scan/index" options={{ headerShown: false }} />
        <Stack.Screen name="scan/confirm" options={{ headerShown: false }} />
        <Stack.Screen name="scan/pin" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="ticket/paid" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="wallet/fund" options={{ headerShown: false }} />
        <Stack.Screen name="wallet/momo" options={{ headerShown: false }} />
        <Stack.Screen name="wallet/bank-transfer" options={{ headerShown: false }} />
        <Stack.Screen name="wallet/transactions" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="wallet/transaction-detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="wallet/ticket" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="wallet/tickets" options={{ headerShown: false, animation: 'slide_from_right' }} />
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
      <OtaUpdateBanner />
      <ConfettiCelebration reward={lastReward} onDismiss={clearLastReward} />
    </ThemeProvider>
  )
}

export default function RootLayout() {
  // OTA updates — runs immediately on cold start, before splash/onboarding
  useAppUpdate()

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
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
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AppProvider>
            <AuthProvider>
              <AppInner />
            </AuthProvider>
          </AppProvider>
        </PersistQueryClientProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  )
}
