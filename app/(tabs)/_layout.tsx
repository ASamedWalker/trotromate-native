import React from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native'
import {
  Home, Route, Wallet, Radio, Trophy,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n'

const BRAND = '#FF4D1C'

// Floating pill tab bar's total footprint (bar paddingVertical 20 + tab
// paddingVertical 12 + icon 22 + gap 4 + label ~14 ≈ 72px) plus breathing
// room above the pill. Screens should add this (+ insets.bottom, which the
// bar's own `bottom` offset already accounts for separately) as bottom
// clearance so content never sits under the floating bar.
export const TAB_BAR_CLEARANCE = 96

const TAB_ICONS: Record<string, typeof Home> = {
  index: Home,
  lines: Route,
  wallet: Wallet,
  tales: Radio,
  rewards: Trophy,
}

// route name → i18n key (also used to decide which tabs are visible)
const TAB_KEYS: Record<string, string> = {
  index: 'nav.home',
  lines: 'nav.lines',
  wallet: 'nav.wallet',
  tales: 'nav.pulse',
  rewards: 'nav.rewards',
}

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'

  const { t } = useLanguage()
  // Only render visible tabs (filter out hidden ones)
  const visibleRoutes = state.routes.filter(r => TAB_KEYS[r.name])

  return (
    <View style={[
      styles.bar,
      { bottom: Math.max(insets.bottom, 16) },
      isDark ? styles.barDark : styles.barLight,
    ]}>
      {visibleRoutes.map((route) => {
        const realIndex = state.routes.indexOf(route)
        const isFocused = state.index === realIndex
        const Icon = TAB_ICONS[route.name] || Home
        const label = t(TAB_KEYS[route.name] || 'nav.home')

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
          >
            <Icon
              size={22}
              strokeWidth={isFocused ? 2.2 : 1.6}
              color={isFocused ? BRAND : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isFocused
                    ? (isDark ? '#fff' : '#1c1917')
                    : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'),
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="lines" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="tales" />
      <Tabs.Screen name="rewards" />
      {/* Hidden tabs — still accessible via navigation */}
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="routes" options={{ href: null }} />
      <Tabs.Screen name="train" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 12,
    borderWidth: 1,
  },
  barDark: {
    backgroundColor: 'rgba(12,10,9,0.92)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  barLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 0.1,
  },
})
