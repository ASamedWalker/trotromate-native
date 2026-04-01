import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
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

const TYPE_CONFIG: Record<StationPinType, { color: string; size: number; emoji: string }> = {
  trotro: { color: '#f59e0b', size: 10, emoji: '' },
  train: { color: '#0ea5e9', size: 12, emoji: '🚆' },
  major: { color: '#f59e0b', size: 12, emoji: '' },
  queue: { color: '#f59e0b', size: 12, emoji: '' },
}

/**
 * Compact station pin — small colored dot with optional label.
 * Designed to not block nearby route stop dots.
 */
export const StationMapPin = React.memo(function StationMapPin({
  type,
  name,
  waitText,
  queueStatus,
}: StationMapPinProps) {
  const config = TYPE_CONFIG[type]
  const color = type === 'queue' && queueStatus ? QUEUE_COLORS[queueStatus] : config.color
  const sz = config.size

  return (
    <View style={s.container}>
      {/* Outer glow ring for train/queue */}
      {(type === 'train' || type === 'queue') && (
        <View
          style={[
            s.glowRing,
            {
              width: sz + 10,
              height: sz + 10,
              borderRadius: (sz + 10) / 2,
              backgroundColor: color,
            },
          ]}
        />
      )}

      {/* Main dot */}
      <View
        style={[
          s.dot,
          {
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            backgroundColor: color,
            borderWidth: type === 'train' ? 2 : 1.5,
          },
        ]}
      >
        {type === 'train' && <Text style={s.trainIcon}>🚆</Text>}
      </View>

      {/* Label — only for train and queue (high-value info) */}
      {(type === 'train' || type === 'queue' || type === 'major') && (
        <Text style={[s.label, { color }]} numberOfLines={1}>
          {name}
        </Text>
      )}

      {/* Wait time chip for queue stations */}
      {type === 'queue' && waitText ? (
        <View style={[s.waitChip, { backgroundColor: color }]}>
          <Text style={s.waitText}>{waitText}</Text>
        </View>
      ) : null}
    </View>
  )
})

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 70,
  },
  glowRing: {
    position: 'absolute',
    top: 0,
    opacity: 0.15,
  },
  dot: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainIcon: {
    fontSize: 6,
    lineHeight: 10,
  },
  label: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: font.semibold,
    textAlign: 'center',
    maxWidth: 68,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  waitChip: {
    marginTop: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  waitText: {
    fontSize: 8,
    fontFamily: font.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
})
