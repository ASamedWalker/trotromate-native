import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { HomeIcon, LinesIcon, TrainIcon, WalletIcon, PulseIcon, StationsIcon, type TabIconProps } from '@/components/TabIcons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n'
import { useApp } from '@/lib/contexts/AppContext'
import { usePulseSeen, markPulseSeen } from '@/lib/hooks/usePulseSeen'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { RELEASE_MODE } from '@/lib/config/release'

const BRAND = '#FF4D1C'
const BRAND_SOFT = '#FFE9E1' // pill behind the selected tab's icon
const INACTIVE = '#6B7280' // 4.8:1 on white — the old 45% black was 3.3:1

// Floating pill tab bar's total footprint (bar paddingVertical 20 + tab
// paddingVertical 12 + icon 22 + gap 4 + label ~14 ≈ 72px) plus breathing
// room above the pill. Screens should add this (+ insets.bottom, which the
// bar's own `bottom` offset already accounts for separately) as bottom
// clearance so content never sits under the floating bar.
export const TAB_BAR_CLEARANCE = 96

// Store release (RELEASE_MODE, redesign 2026-10-09): Home · Lines · Stations · Train · Pulse.
// Rewards left the bar (coins chip on Home + Profile). Otherwise: Home · Lines · Train · Wallet · Pulse.
const TAB_ICONS: Record<string, (p: TabIconProps) => React.JSX.Element> = RELEASE_MODE
  ? { index: HomeIcon, lines: LinesIcon, stationlist: StationsIcon, train: TrainIcon, tales: PulseIcon }
  : { index: HomeIcon, lines: LinesIcon, train: TrainIcon, wallet: WalletIcon, tales: PulseIcon }

// route name → i18n key (also used to decide which tabs are visible)
const TAB_KEYS: Record<string, string> = RELEASE_MODE
  ? { index: 'nav.home', lines: 'nav.lines', stationlist: 'nav.stations', train: 'nav.train', tales: 'nav.pulse' }
  : { index: 'nav.home', lines: 'nav.lines', train: 'nav.train', wallet: 'nav.wallet', tales: 'nav.pulse' }

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  const { t } = useLanguage()
  const { deviceId } = useApp()
  // Shares the ['notifications', …] cache (5-min stale) with the notifications
  // screens. The dot = post activity newer than the last Pulse visit.
  const { notifications } = useNotifications(deviceId)
  const pulseSeen = usePulseSeen()
  const pulseFocused = state.routes[state.index]?.name === 'tales'
  useEffect(() => {
    if (pulseFocused) markPulseSeen()
  }, [pulseFocused])
  const pulseUnread = !pulseFocused && notifications.some(
    (n) => n.type === 'post_activity' && Date.parse(n.timestamp) > pulseSeen,
  )
  // Only render visible tabs (filter out hidden ones)
  const visibleRoutes = state.routes.filter(r => TAB_KEYS[r.name])

  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 16) }]}>
      {visibleRoutes.map((route) => {
        const realIndex = state.routes.indexOf(route)
        const isFocused = state.index === realIndex
        const Icon = TAB_ICONS[route.name] || HomeIcon
        const label = t(TAB_KEYS[route.name] || 'nav.home')
        const showDot = route.name === 'tales' && pulseUnread

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
            accessibilityLabel={showDot ? `${label}, new activity` : label}
            accessibilityState={{ selected: isFocused }}
          >
            <View style={[styles.pill, isFocused && styles.pillActive]}>
              <Icon color={isFocused ? BRAND : INACTIVE} active={isFocused} />
              {showDot ? <View style={styles.dot} /> : null}
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
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
      <Tabs.Screen name="stationlist" options={RELEASE_MODE ? undefined : { href: null }} />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="wallet" options={RELEASE_MODE ? { href: null } : undefined} />
      <Tabs.Screen name="tales" />
      {/* Hidden tabs — still accessible via navigation */}
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="routes" options={{ href: null }} />
      <Tabs.Screen name="rewards" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  // Solid white: the old 92% white let list rows bleed through the bar.
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  pill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 3,
    right: 13,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: BRAND,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: BRAND_SOFT },
  label: {
    fontSize: 12,
    fontFamily: font.semibold,
    letterSpacing: 0.1,
    color: INACTIVE,
  },
  labelActive: { fontFamily: font.bold, color: '#111111' },
})
