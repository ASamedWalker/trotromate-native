import { useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native'
import { X, ArrowRight, Bus, Car } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import type { TransportRoute } from '@/lib/types/transport'

const ROUTE_TYPE_LABELS: Record<string, string> = {
  bus: 'Trotro',
  share_taxi: 'Shared Taxi',
  minibus: 'Minibus',
}

const ROUTE_TYPE_COLORS: Record<string, string> = {
  bus: '#d97706',
  share_taxi: '#eab308',
  minibus: '#0891b2',
}

interface RouteInfoCardProps {
  route: TransportRoute
  isDark: boolean
  onClose: () => void
}

export function RouteInfoCard({ route, isDark, onClose }: RouteInfoCardProps) {
  const t = themed(isDark)
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const typeLabel = ROUTE_TYPE_LABELS[route.type] || route.type
  const typeColor = ROUTE_TYPE_COLORS[route.type] || c.amber500
  const TypeIcon = route.type === 'share_taxi' ? Car : Bus

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          opacity,
          transform: [{ translateY }],
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
          },
          android: { elevation: 8 },
        }),
      ]}
    >
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <X size={16} color={t.textSecondary} />
      </TouchableOpacity>

      {/* Route type badge */}
      <View style={[styles.typeBadge, { backgroundColor: typeColor + '18' }]}>
        <TypeIcon size={12} color={typeColor} />
        <Text style={[styles.typeText, { color: typeColor }]}>{typeLabel}</Text>
        {route.ref ? (
          <Text style={[styles.refText, { color: typeColor }]}>#{route.ref}</Text>
        ) : null}
      </View>

      {/* From -> To or route name */}
      {route.from && route.to ? (
        <View style={styles.routeRow}>
          <Text style={[styles.endpoint, { color: t.text }]} numberOfLines={1}>
            {route.from}
          </Text>
          <ArrowRight size={14} color={t.textTertiary} />
          <Text style={[styles.endpoint, { color: t.text }]} numberOfLines={1}>
            {route.to}
          </Text>
        </View>
      ) : (
        <Text style={[styles.routeName, { color: t.text }]} numberOfLines={2}>
          {route.name || `Route ${route.ref || route.osm_id}`}
        </Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 190,
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    paddingRight: 36,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontFamily: font.semibold,
    letterSpacing: 0.3,
  },
  refText: {
    fontSize: 11,
    fontFamily: font.bold,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endpoint: {
    fontSize: 15,
    fontFamily: font.bold,
    flexShrink: 1,
  },
  routeName: {
    fontSize: 14,
    fontFamily: font.semibold,
  },
})
