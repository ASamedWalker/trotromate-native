import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import 'react-native-reanimated'

import '../global.css'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

// Custom theme matching TrotroMate brand
const TrotroLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#f59e0b', // amber-500
    background: '#fafaf9', // stone-50
    card: '#ffffff',
    text: '#1c1917', // stone-900
    border: '#e7e5e3', // stone-200
    notification: '#f59e0b',
  },
}

const TrotroDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#f59e0b', // amber-500
    background: '#0c0a09', // stone-950
    card: '#1c1917', // stone-900
    text: '#fafaf9', // stone-50
    border: '#292524', // stone-800
    notification: '#f59e0b',
  },
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? TrotroDarkTheme : TrotroLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="routes/[id]"
          options={{
            title: 'Route Details',
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1c1917' : '#ffffff' },
            headerTintColor: '#f59e0b',
          }}
        />
        <Stack.Screen
          name="report/fare"
          options={{
            title: 'Report Fare',
            presentation: 'modal',
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1c1917' : '#ffffff' },
            headerTintColor: '#f59e0b',
          }}
        />
        <Stack.Screen
          name="report/queue"
          options={{
            title: 'Queue Status',
            presentation: 'modal',
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1c1917' : '#ffffff' },
            headerTintColor: '#f59e0b',
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
