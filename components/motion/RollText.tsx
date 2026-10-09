import React, { useEffect, useRef } from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { dur, ease } from '@/lib/motion'

/** Rolls its children in from below whenever `value` changes (train minutes ticking over). */
export function RollText({ value, children, style }: { value: string | number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const y = useRef(new Animated.Value(0)).current
  const o = useRef(new Animated.Value(1)).current
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    if (reduced) return
    y.setValue(10)
    o.setValue(0)
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: dur.base, easing: ease.decelerate, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: dur.base, easing: ease.decelerate, useNativeDriver: true }),
    ]).start()
  }, [value, reduced, y, o])
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: y }] }]}>{children}</Animated.View>
}
