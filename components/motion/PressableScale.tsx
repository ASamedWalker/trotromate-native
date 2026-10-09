import React, { useRef } from 'react'
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { dur, ease } from '@/lib/motion'

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number }

/**
 * Press feedback for cards: shrinks a touch while held (no opacity fade, so text never
 * looks grey/blurry). Core Animated on purpose — safe inside ScrollView/FlatList on Android.
 */
export function PressableScale({ style, scaleTo = 0.98, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const reduced = useReducedMotion()
  const to = (v: number) => {
    if (reduced) return
    Animated.timing(scale, { toValue: v, duration: dur.tap, easing: ease.standard, useNativeDriver: true }).start()
  }
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { to(scaleTo); onPressIn?.(e) }}
      onPressOut={(e) => { to(1); onPressOut?.(e) }}
    >
      {(state) => (
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  )
}
