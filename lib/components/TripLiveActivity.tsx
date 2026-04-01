import React from 'react'
import { Voltra } from 'voltra'
import type { LiveActivityVariants } from 'voltra'

export interface TripActivityData {
  routeLabel: string
  currentStation: string
  nextStation: string
  progressPercent: number
  eta: string
  transportType: 'trotro' | 'train'
  tripState: 'active' | 'approaching' | 'arrived'
}

const AMBER = '#f59e0b'
const GREEN = '#10b981'
const BG_DARK = '#111827'
const TEXT_WHITE = '#ffffff'
const TEXT_MUTED = '#9CA3AF'

function getAccentColor(tripState: string): string {
  if (tripState === 'approaching') return GREEN
  if (tripState === 'arrived') return GREEN
  return AMBER
}

function getTransportEmoji(type: 'trotro' | 'train'): string {
  return type === 'train' ? '🚂' : '🚐'
}

function getStatusText(tripState: string, eta: string): string {
  if (tripState === 'arrived') return 'You have arrived!'
  if (tripState === 'approaching') return 'Almost there!'
  return `ETA ${eta}`
}

/**
 * Build Voltra Live Activity variants for the trip tracker.
 * Returns JSX for lock screen, Dynamic Island compact, and Dynamic Island expanded.
 */
export function buildTripActivityVariants(data: TripActivityData): LiveActivityVariants {
  const accent = getAccentColor(data.tripState)
  const emoji = getTransportEmoji(data.transportType)
  const statusText = getStatusText(data.tripState, data.eta)
  const progress = Math.min(100, Math.max(0, data.progressPercent)) / 100

  // Lock screen — full-width bar at bottom of lock screen
  const lockScreen = (
    <Voltra.VStack style={{ padding: 16, gap: 10 }}>
      {/* Top row: emoji + route label + ETA badge */}
      <Voltra.HStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Voltra.HStack style={{ gap: 6, alignItems: 'center' }}>
          <Voltra.Text style={{ fontSize: 16 }}>{emoji}</Voltra.Text>
          <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 15, fontWeight: '700' }}>
            {data.routeLabel}
          </Voltra.Text>
        </Voltra.HStack>
        <Voltra.Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>
          {statusText}
        </Voltra.Text>
      </Voltra.HStack>

      {/* Progress bar */}
      <Voltra.LinearProgressView
        value={progress}
        maximumValue={1}
        progressColor={accent}
        trackColor="rgba(255,255,255,0.15)"
        cornerRadius={4}
        height={6}
        thumb={
          <Voltra.Text style={{ fontSize: 10 }}>{emoji}</Voltra.Text>
        }
      />

      {/* Bottom row: current station → next station */}
      <Voltra.HStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Voltra.VStack style={{ gap: 2 }}>
          <Voltra.Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: '500' }}>
            NOW
          </Voltra.Text>
          <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 13, fontWeight: '600' }}>
            {data.currentStation}
          </Voltra.Text>
        </Voltra.VStack>
        <Voltra.Text style={{ color: TEXT_MUTED, fontSize: 14 }}>→</Voltra.Text>
        <Voltra.VStack style={{ gap: 2, alignItems: 'flex-end' }}>
          <Voltra.Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: '500' }}>
            NEXT
          </Voltra.Text>
          <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 13, fontWeight: '600' }}>
            {data.nextStation}
          </Voltra.Text>
        </Voltra.VStack>
      </Voltra.HStack>
    </Voltra.VStack>
  )

  // Dynamic Island — compact (small pill)
  const compactLeading = (
    <Voltra.Text style={{ fontSize: 14 }}>{emoji}</Voltra.Text>
  )
  const compactTrailing = (
    <Voltra.Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>
      {data.tripState === 'arrived' ? '✓' : data.eta}
    </Voltra.Text>
  )

  // Dynamic Island — expanded (long-press)
  const expandedCenter = (
    <Voltra.VStack style={{ padding: 12, gap: 8 }}>
      <Voltra.HStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 15, fontWeight: '700' }}>
          {data.routeLabel}
        </Voltra.Text>
        <Voltra.Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>
          {statusText}
        </Voltra.Text>
      </Voltra.HStack>

      <Voltra.LinearProgressView
        value={progress}
        maximumValue={1}
        progressColor={accent}
        trackColor="rgba(255,255,255,0.15)"
        cornerRadius={3}
        height={5}
      />

      <Voltra.HStack style={{ justifyContent: 'space-between' }}>
        <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 12, fontWeight: '600' }}>
          {data.currentStation}
        </Voltra.Text>
        <Voltra.Text style={{ color: TEXT_MUTED, fontSize: 12 }}>→</Voltra.Text>
        <Voltra.Text style={{ color: TEXT_WHITE, fontSize: 12, fontWeight: '600' }}>
          {data.nextStation}
        </Voltra.Text>
      </Voltra.HStack>
    </Voltra.VStack>
  )

  // Dynamic Island — minimal (just the emoji when another activity is on the other side)
  const minimal = (
    <Voltra.Text style={{ fontSize: 14 }}>{emoji}</Voltra.Text>
  )

  return {
    lockScreen: {
      content: lockScreen,
      activityBackgroundTint: BG_DARK,
    },
    island: {
      keylineTint: accent,
      compact: {
        leading: compactLeading,
        trailing: compactTrailing,
      },
      expanded: {
        center: expandedCenter,
      },
      minimal,
    },
  }
}
