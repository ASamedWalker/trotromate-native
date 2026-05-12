import React from 'react'
import { Tabs } from 'expo-router'
import { useColorScheme, StyleSheet, View, Text, Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { font, glass } from '@/lib/theme'
import GlassCard from '@/components/GlassCard'
import { HapticTab } from '@/components/HapticTab'
import { LinearGradient } from 'expo-linear-gradient'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const activeColor = isDark ? '#fbbf24' : '#78350f'
  const inactiveColor = isDark ? '#a8a29e' : '#78716c'

  return (
    <Tabs
      screenOptions={{
        tabBarButton: HapticTab,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarBackground: () => (
          <GlassCard
            intensity={glass.blur.nav}
            style={StyleSheet.absoluteFillObject}
            fallbackBg={isDark ? '#1c1917' : '#ffffff'}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: font.semibold,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Routes',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="directions-bus" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tales"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="account-balance-wallet" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="train" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="military-tech" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="activity" options={{ href: null }} />
      {/* Hidden tabs */}
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  walletBtn: {
    marginTop: -14,
    ...Platform.select({
      ios: { shadowColor: '#FFAD3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  walletGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 9,
    fontFamily: font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
})
