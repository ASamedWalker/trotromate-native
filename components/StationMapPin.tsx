import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { BusFront, TrainFront, Users } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { QueueStatus } from '@/lib/services/stations'

export type StationPinType = 'trotro' | 'train' | 'major' | 'queue'

interface StationMapPinProps {
  type: StationPinType
  name: string
  waitText?: string
  queueStatus?: QueueStatus
}

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

function getColor(type: StationPinType, queueStatus?: QueueStatus): string {
  if (type === 'queue' && queueStatus) return QUEUE_COLORS[queueStatus]
  if (type === 'train') return '#7c3aed' // Purple like Mapcarta
  return '#f59e0b' // Amber for trotro/major
}

const ICON_SIZE = 14

/**
 * Mapcarta-style station pin — colored circle with white icon inside.
 * Visually distinct from route stop dots (small gold circles).
 */
export const StationMapPin = React.memo(function StationMapPin({
  type,
  name,
  waitText,
  queueStatus,
}: StationMapPinProps) {
  const color = getColor(type, queueStatus)

  const Icon =
    type === 'train' ? TrainFront :
    type === 'queue' ? Users :
    BusFront

  return (
    <View style={s.container}>
      {/* Colored circle with white icon */}
      <View style={[s.badge, { backgroundColor: color }]}>
        <Icon size={ICON_SIZE} color="#fff" strokeWidth={2.5} />
      </View>

      {/* Pointer triangle */}
      <View style={[s.pointer, { borderTopColor: color }]} />

      {/* Station name */}
      <Text style={s.label} numberOfLines={1}>{name}</Text>

      {/* Wait time for queue */}
      {type === 'queue' && waitText ? (
        <View style={[s.waitChip, { backgroundColor: color }]}>
          <Text style={s.waitText}>{waitText}</Text>
        </View>
      ) : null}
    </View>
  )
})

const BADGE_SIZE = 28

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 76,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 6 },
    }),
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  label: {
    marginTop: 1,
    fontSize: 9,
    fontFamily: font.semibold,
    color: '#374151',
    textAlign: 'center',
    maxWidth: 74,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  waitChip: {
    marginTop: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  waitText: {
    fontSize: 8,
    fontFamily: font.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
})
