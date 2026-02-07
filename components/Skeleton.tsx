import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, useColorScheme } from 'react-native'
import { themed } from '@/lib/theme'

interface SkeletonProps {
  width: number | `${number}%`
  height: number
  borderRadius?: number
  style?: object
}

export default function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#292524' : '#e7e5e3',
          opacity,
        },
        style,
      ]}
    />
  )
}

// Pre-built skeleton layouts for common patterns

export function SkeletonRouteCard({ isDark }: { isDark: boolean }) {
  const t = themed(isDark)
  return (
    <View style={[skeletons.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={skeletons.row}>
        <Skeleton width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <View style={[skeletons.row, { marginTop: 14 }]}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
        <Skeleton width={50} height={24} borderRadius={10} />
      </View>
    </View>
  )
}

export function SkeletonTaleCard({ isDark }: { isDark: boolean }) {
  const t = themed(isDark)
  return (
    <View style={[skeletons.taleCard, { backgroundColor: t.card }]}>
      <View style={[skeletons.row, { padding: 14 }]}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={260} borderRadius={0} />
      <View style={[skeletons.row, { padding: 14, gap: 16 }]}>
        <Skeleton width={50} height={20} />
        <Skeleton width={50} height={20} />
      </View>
    </View>
  )
}

export function SkeletonActivityItem({ isDark }: { isDark: boolean }) {
  const t = themed(isDark)
  return (
    <View style={[skeletons.activityItem, { backgroundColor: t.card }]}>
      <Skeleton width={42} height={42} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={40} height={12} />
    </View>
  )
}

const skeletons = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  taleCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
})
