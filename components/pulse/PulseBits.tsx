import React from 'react'
import { View, Text } from 'react-native'
import { font, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { QueueGlyph } from '@/components/QueueGlyph'
import { ageLabel } from '@/lib/utils/freshness'
import { ageState, LIVE_GREEN, type AgeState } from '@/components/pulse/PulseTrust'
import type { QueueStatus } from '@/lib/services/stations'

// Shared building blocks for the Pulse "Station Board" (UX v2 Direction A).

export const PAD = 20
export const META = '#5F6670'
export const CARD_BORDER = '#EEEEEE'

export const cardBase = {
  backgroundColor: ui.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: CARD_BORDER,
} as const

/** Display copy only: hashtags are dropped from captions (UX v2 P10). The stored caption is untouched. */
export function stripHashtags(text: string): string {
  return text
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** First line of a caption, for one-line rows. */
export function firstLine(text: string): string {
  return stripHashtags(text).split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
}

/** "4 min ago" → mockup short form for chips: "4 min ago", "3 h ago", "4 d ago". */
export function shortAge(iso: string | null | undefined): string {
  const l = ageLabel(iso)
  return l.replace(/^(\d+)h ago$/, '$1 h ago').replace(/^(\d+) days ago$/, '$1 d ago')
}

/** The age dot for each age state (P2): filled green, filled grey, hollow ring, pale. */
export function AgeDot({ state }: { state: AgeState }) {
  const base = { width: 8, height: 8, borderRadius: 4 }
  const style =
    state === 'live' ? { ...base, backgroundColor: LIVE_GREEN }
      : state === 'recent' ? { ...base, backgroundColor: '#78716C' }
        : state === 'ageing' ? { ...base, borderWidth: 1.5, borderColor: '#78716C' }
          : { ...base, backgroundColor: '#D6D3D1' }
  return <View style={style} accessibilityElementsHidden importantForAccessibility="no" />
}

/** Dot + "8 min ago" (+ "· may have changed" once ageing), then optional extra meta. */
export function AgeMeta({
  iso,
  extra,
  timeBound = true,
}: {
  iso: string | null | undefined
  extra?: string | null
  /** Queue/fare facts go out of date; chat does not get the "may have changed" tail. */
  timeBound?: boolean
}) {
  const state = ageState(iso)
  const tail = timeBound && state === 'ageing' ? ' · may have changed' : ''
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
      <AgeDot state={state} />
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: META, flexShrink: 1 }} numberOfLines={1}>
        {shortAge(iso)}{tail}{extra ? ` · ${extra}` : ''}
      </Text>
    </View>
  )
}

/** 36pt tinted circle with a kind icon (fare green, question violet, problem red, queue orange). */
export function KindCircle({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <HeroText size={20} style={{ color: ui.text }}>{children}</HeroText>
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.7, color: META }}>
      {children.toUpperCase()}
    </Text>
  )
}

// ── Queue status pill (P5): QueueGlyph + one short word, never colour alone ──

export const QUEUE_SHORT: Record<QueueStatus, string> = {
  empty: 'Cars waiting',
  short: 'Short',
  moderate: 'Moderate',
  long: 'Long',
  very_long: 'Very long',
}

const QUEUE_TONE: Record<QueueStatus, { bg: string; fg: string }> = {
  empty: { bg: '#DCFCE7', fg: '#15803D' },
  short: { bg: '#FEF3C7', fg: '#B45309' },
  moderate: { bg: '#FEF3C7', fg: '#B45309' },
  long: { bg: '#FFEDD5', fg: '#C2410C' },
  very_long: { bg: '#FEE2E2', fg: '#B91C1C' },
}

export function QueuePill({ status }: { status: QueueStatus | null }) {
  if (!status) {
    return (
      <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F5F5F4' }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: '#57534E' }}>No recent report</Text>
      </View>
    )
  }
  const tone = QUEUE_TONE[status]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: tone.bg }}>
      <QueueGlyph status={status} color={tone.fg} size={13} />
      <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: tone.fg }}>{QUEUE_SHORT[status]}</Text>
    </View>
  )
}
