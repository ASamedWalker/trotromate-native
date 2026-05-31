import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated'

const BRAND = '#FF4D1C'
const SIZE = 42
const STROKE = 3
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface StepIndicatorProps {
  current: number
  total: number
}

export default function StepIndicator({ current, total }: StepIndicatorProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(current / total, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    })
  }, [current, total])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  return (
    <View style={s.container}>
      <Svg width={SIZE} height={SIZE} style={s.svg}>
        {/* Background track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#F0F0F0"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Animated progress */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={BRAND}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={s.labelWrap}>
        <Text style={s.current}>{current}</Text>
        <Text style={s.slash}>/{total}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '0deg' }],
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  slash: {
    fontSize: 11,
    fontWeight: '500',
    color: '#CCC',
  },
})
