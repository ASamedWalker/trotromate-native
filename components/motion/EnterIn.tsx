import React, { useEffect, useRef } from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { dur, ease } from '@/lib/motion'

/** Slides + fades its child in on mount when `animate` is true (e.g. a line you just saved). */
export function EnterIn({ animate, children, style }: { animate: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const run = animate && !reduced
  const y = useRef(new Animated.Value(run ? 16 : 0)).current
  const o = useRef(new Animated.Value(run ? 0 : 1)).current
  useEffect(() => {
    if (!run) return
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: dur.entrance, easing: ease.decelerate, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: dur.entrance, easing: ease.decelerate, useNativeDriver: true }),
    ]).start()
  }, [run, y, o])
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: y }] }]}>{children}</Animated.View>
}
