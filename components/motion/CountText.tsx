import React, { useEffect, useRef, useState } from 'react'
import { Text, Animated, type TextProps } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { dur, ease } from '@/lib/motion'

/** A number that counts from its previous value to the new one (coins, confirmations). */
export function CountText({ value, format = (n: number) => String(n), ...rest }: TextProps & { value: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(value)).current
  const [shown, setShown] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)))
    return () => anim.removeListener(id)
  }, [anim])

  useEffect(() => {
    if (prev.current === value) return
    const from = prev.current
    prev.current = value
    if (reduced || Math.abs(value - from) > 2000) { anim.setValue(value); setShown(value); return }
    anim.setValue(from)
    Animated.timing(anim, { toValue: value, duration: dur.emphasized + 300, easing: ease.decelerate, useNativeDriver: false }).start()
  }, [value, reduced, anim])

  return <Text {...rest}>{format(shown)}</Text>
}
