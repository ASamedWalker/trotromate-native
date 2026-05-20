import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useColorScheme,
  DeviceEventEmitter,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { RefreshCw, X } from 'lucide-react-native'
import * as Updates from 'expo-updates'
import { c, themed, font } from '@/lib/theme'

const appIcon = require('@/assets/images/logo.png')

/**
 * Modern, non-blocking OTA "Updates ready" banner.
 *
 * Replaces the old Alert.alert() in useAppUpdate. Listens for the
 * 'ota-update-ready' DeviceEventEmitter event and slides up a
 * glassmorphic toast above the tab bar. App remains fully usable.
 *
 * Pattern inspired by Discord/Linear/Slack — non-blocking bottom
 * toast, 1-tap restart, dismissible. Mounted globally in _layout.tsx.
 */
export default function OtaUpdateBanner() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const translateY = useRef(new Animated.Value(220)).current
  const pulseScale = useRef(new Animated.Value(1)).current

  // Listen for OTA-ready signal from useAppUpdate
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ota-update-ready', () => {
      setVisible(true)
    })
    return () => sub.remove()
  }, [])

  // Slide-up entry
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }).start()

      // Subtle pulse on the "ready" dot
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.4,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    }
  }, [visible, translateY, pulseScale])

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 220,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false))
  }

  const restart = async () => {
    try {
      await Updates.reloadAsync()
    } catch {
      // If reload fails, hide the banner instead of leaving it stuck
      dismiss()
    }
  }

  if (!visible) return null

  // Position above the tab bar (tab bar is ~60px + safe area on both platforms)
  const bottomOffset = 70 + Math.max(insets.bottom, 8)

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[s.wrap, { bottom: bottomOffset, transform: [{ translateY }] }]}
    >
      <View style={s.shadow}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 100}
          tint={isDark ? 'dark' : 'light'}
          style={s.card}
          experimentalBlurMethod="dimezisBlurView"
        >
          <View style={s.cardInner}>
            {/* Icon tile with pulsing "ready" dot */}
            <View style={s.iconTile}>
              <Image source={appIcon} style={s.icon} contentFit="contain" />
              <Animated.View
                style={[s.pulseDot, { transform: [{ scale: pulseScale }] }]}
              />
              <View style={s.dotCore} />
            </View>

            {/* Copy */}
            <View style={s.textWrap}>
              <Text style={s.title}>Updates ready</Text>
              <Text style={s.subtitle} numberOfLines={2}>
                Restart Troski to apply the latest improvements
              </Text>
            </View>

            {/* Restart pill */}
            <TouchableOpacity
              onPress={restart}
              activeOpacity={0.85}
              style={s.restartBtn}
            >
              <RefreshCw size={14} color={c.white} strokeWidth={2.75} />
              <Text style={s.restartText}>Restart</Text>
            </TouchableOpacity>

            {/* Dismiss × */}
            <TouchableOpacity
              onPress={dismiss}
              activeOpacity={0.6}
              hitSlop={10}
              style={s.dismissBtn}
            >
              <X size={16} color={t.textSecondary} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Animated.View>
  )
}

function getStyles(isDark: boolean) {
  const t = themed(isDark)
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      zIndex: 999,
    },
    shadow: {
      borderRadius: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.18,
      shadowRadius: 22,
      elevation: 14,
    },
    card: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      backgroundColor: isDark ? 'rgba(28,25,23,0.86)' : 'rgba(255,255,255,0.92)',
    },
    cardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    iconTile: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      shadowColor: c.amber500,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    icon: {
      width: 30,
      height: 30,
    },
    pulseDot: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: 'rgba(34,197,94,0.45)',
    },
    dotCore: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: isDark ? '#1c1917' : '#fff',
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      fontFamily: font.bold,
      color: t.text,
      letterSpacing: -0.1,
    },
    subtitle: {
      fontSize: 11.5,
      fontFamily: font.regular,
      color: t.textSecondary,
      lineHeight: 15,
    },
    restartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.amber500,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      shadowColor: c.amber500,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
    restartText: {
      color: c.white,
      fontSize: 13,
      fontFamily: font.bold,
      letterSpacing: 0.1,
    },
    dismissBtn: {
      padding: 4,
      marginLeft: -4,
    },
  })
}
