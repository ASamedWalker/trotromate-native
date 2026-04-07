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

export function SkeletonRewards({ isDark }: { isDark: boolean }) {
  return (
    <View>
      {/* Podium skeleton */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 30 }}>
        <Skeleton width={120} height={16} borderRadius={8} style={{ marginBottom: 6 }} />
        <Skeleton width={160} height={10} borderRadius={6} style={{ marginBottom: 24 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width={40} height={10} borderRadius={5} style={{ marginTop: 4 }} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={112} height={112} borderRadius={56} />
            <Skeleton width={80} height={14} borderRadius={7} style={{ marginTop: 10 }} />
            <Skeleton width={50} height={10} borderRadius={5} style={{ marginTop: 4 }} />
          </View>
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width={60} height={12} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width={40} height={10} borderRadius={5} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>

      {/* Ranked list skeleton */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 18,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f6efed',
            marginBottom: 8,
          }}>
            <Skeleton width={22} height={14} borderRadius={4} />
            <Skeleton width={40} height={40} borderRadius={20} style={{ marginLeft: 12 }} />
            <Skeleton width="40%" height={13} borderRadius={6} style={{ marginLeft: 12 }} />
            <View style={{ flex: 1 }} />
            <Skeleton width={50} height={14} borderRadius={6} />
          </View>
        ))}
      </View>
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
