import React from 'react'
import { Tabs } from 'expo-router'
import { useColorScheme, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { font, glass } from '@/lib/theme'
import GlassCard from '@/components/GlassCard'
import { HapticTab } from '@/components/HapticTab'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const activeColor = isDark ? '#fbbf24' : '#78350f' // amber-400 / amber-900
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
        },
        tabBarBackground: () => (
          <GlassCard
            intensity={glass.blur.nav}
            style={StyleSheet.absoluteFillObject}
            fallbackBg={isDark ? '#1c1917' : '#ffffff'}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: font.semibold,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'home-filled' : 'home'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Routes',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="directions-bus" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tales"
        options={{
          title: 'Tales',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="auto-stories" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="military-tech" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Updates',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'notifications' : 'notifications-none'} size={24} color={color} />
          ),
        }}
      />
      {/* Hidden tabs — still navigable but not shown in tab bar */}
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}
