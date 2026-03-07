import React from 'react'
import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Home, MapPin, Camera, Trophy, ReceiptText } from 'lucide-react-native'
import { font } from '@/lib/theme'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const activeColor = '#f59e0b'
  const inactiveColor = isDark ? '#a8a29e' : '#78716c'

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: isDark ? '#1c1917' : '#ffffff',
          borderTopColor: isDark ? '#292524' : '#e7e5e3',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: font.semibold,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Routes',
          tabBarIcon: ({ color, focused }) => (
            <MapPin size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="tales"
        options={{
          title: 'Tales',
          tabBarIcon: ({ color, focused }) => (
            <Camera size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, focused }) => (
            <Trophy size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <ReceiptText size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      {/* Hidden tabs — still navigable but not shown in tab bar */}
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}
