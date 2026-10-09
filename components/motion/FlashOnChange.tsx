import React, { useEffect, useRef } from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { dur, ease } from '@/lib/motion'

/**
 * When `token` changes after mount (a new queue report arrived, a count went up), the
 * content fades in and a warm highlight washes over it, so the rider notices the
 * change. Nothing loops or pulses — it only marks a real change.
 */
export function FlashOnChange({ token, children, style, color = 'rgba(255,77,28,0.12)', radius = 12 }: {
  token: string | number | null | undefined
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  color?: string
  radius?: number
}) {
  const reduced = useReducedMotion()
  const flash = useRef(new Animated.Value(0)).current
  const fade = useRef(new Animated.Value(1)).current
  const prev = useRef(token)

  useEffect(() => {
    if (prev.current === token) return
    prev.current = token
    if (reduced) return
    flash.setValue(1)
    fade.setValue(0.25)
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: dur.base, easing: ease.decelerate, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 1400, delay: 200, easing: ease.standard, useNativeDriver: true }),
    ]).start()
  }, [token, reduced, flash, fade])

  return (
    <Animated.View style={[style, { opacity: fade }]}>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -4, bottom: -4, left: -6, right: -6, borderRadius: radius, backgroundColor: color, opacity: flash }}
      />
      {children}
    </Animated.View>
  )
}
