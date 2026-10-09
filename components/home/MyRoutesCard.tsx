import React, { useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { ChevronRight, Heart, Users, TriangleAlert } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { HeroText } from '@/components/HeroText'
import { QueueStatusLine, queueA11y } from '@/components/QueueStatusLine'
import { corridorFor } from '@/lib/constants/corridors'
import { PressableScale } from '@/components/motion/PressableScale'
import { EnterIn } from '@/components/motion/EnterIn'
import { FlashOnChange } from '@/components/motion/FlashOnChange'
import type { QueueStatus } from '@/lib/services/stations'
import { ORANGE, ORANGE_SOFT, TEXT, TEXT2 } from './tokens'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
const MAX_ROUTES = 3

export type CommuteVariant = 'morning' | 'afternoon'

// Same shape as the web's describeCommute (trotromate lib/services/commute-card.ts),
// which also writes the 05:45 / 16:30 push, so the card and the push always agree.
export interface CommuteInfo {
  routeId: string
  from: string
  to: string
  fare: { amount: number; source: 'gprtu' | 'reported' } | null
  queue: { station: string; status: QueueStatus; label: string; reportedAt: string; reportId?: string; confirmations?: number } | null
  alert?: { id: string; title: string; severity: string; source: string } | null
}

interface CommuteResponse {
  variant: CommuteVariant
  items: CommuteInfo[]
}

// Ghana is UTC+0: before noon riders head out, after noon they head home (same rule as the push)
export function currentVariant(): CommuteVariant {
  return new Date().getUTCHours() < 12 ? 'morning' : 'afternoon'
}

async function fetchCommute(ids: string[], variant: CommuteVariant): Promise<CommuteResponse> {
  // ids sorted so the CDN cache is shared regardless of saved order (the card keeps its own order)
  const res = await fetch(`${API_URL}/api/commute?variant=${variant}&ids=${ids.map(encodeURIComponent).join(',')}`)
  if (!res.ok) throw new Error(`commute ${res.status}`)
  return res.json()
}

/** Saved routes + their live card data. Shared by the card and Home's Work/Home shortcut. */
export function useCommute() {
  const { favorites, isLoaded, reload } = useFavorites()
  // Home stays mounted; pick up hearts tapped on a route page
  useFocusEffect(useCallback(() => { reload() }, [reload]))
  const saved = favorites.slice(0, MAX_ROUTES)
  const ids = saved.map((f) => f.id).sort()
  const variant = currentVariant()
  const q = useQuery({
    queryKey: ['home-commute', variant, ids.join(',')],
    queryFn: () => fetchCommute(ids, variant),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    retry: 1,
  })
  const infoById = new Map((q.data?.items ?? []).map((i) => [i.routeId, i]))
  return { saved, isLoaded, variant, q, infoById }
}

/**
 * Home "My lines": each saved route as a block in its corridor colour (Transit's
 * line cards) — code, destination, boarding stop, fare as the hero number and the
 * queue status with its age. Morning = the trip out, afternoon = the trip home.
 * No saved routes → a nudge to save one (that also turns on the personal push).
 */
export default function MyRoutesCard({ style }: { style?: object }) {
  const router = useRouter()
  const { saved, isLoaded, variant, q, infoById } = useCommute()
  // Lines present when Home first loads stay put; a line saved later slides in.
  const seen = useRef<Set<string> | null>(null)
  if (isLoaded && seen.current === null) seen.current = new Set(saved.map((f) => f.id))

  if (!isLoaded) return null

  if (saved.length === 0) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/lines' as any) }}
        accessibilityRole="button"
        accessibilityLabel="Save your route: tap the heart on any route to see its fare and queue here every morning"
        style={[{
          marginHorizontal: 20, marginTop: 18, backgroundColor: ORANGE_SOFT, borderRadius: 18,
          padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
        }, style]}
      >
        <Heart size={20} color={ORANGE} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }}>Save your route</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2, marginTop: 2 }}>
            Tap ♥ on a route to see its fare and queue here, plus a morning update.
          </Text>
        </View>
        <ChevronRight size={18} color={ORANGE} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={[{ marginHorizontal: 20, marginTop: 18 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT }}>My lines</Text>
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/lines' as any)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="All lines"
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>All</Text>
          <ChevronRight size={16} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <View style={{ borderRadius: 18, overflow: 'hidden' }}>
        {saved.map((f) => {
          const info = infoById.get(f.id)
          // Keep the saved names even before the server answers (or if it fails).
          const out = variant === 'morning'
          const from = info?.from ?? (out ? f.from : f.to)
          const to = info?.to ?? (out ? f.to : f.from)
          const { code, color } = corridorFor(from, to)
          const fare = info?.fare
          const isNew = !!seen.current && !seen.current.has(f.id)
          if (isNew) seen.current!.add(f.id)
          return (
            <EnterIn key={f.id} animate={isNew}>
            <PressableScale
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/[id]', params: { id: f.id } } as any) }}
              accessibilityRole="button"
              accessibilityLabel={`${from} to ${to}${fare ? `, ${formatGHS(fare.amount)}${fare.source === 'reported' ? ' reported by riders' : ' GPRTU fare'}` : ''}${q.data ? `, ${queueA11y(info?.queue?.status, info?.queue?.reportedAt)}` : ''}`}
              style={{ backgroundColor: color, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <HeroText size={22} style={{ color: '#FFFFFF', letterSpacing: 0.3 }}>{code}</HeroText>
                <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' }} numberOfLines={1}>→ {to}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>from {from}</Text>
                <View style={{ marginTop: 6, minHeight: 20 }}>
                  {q.isLoading ? (
                    <View style={{ height: 12, width: 140, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                  ) : q.isError ? null : (
                    <FlashOnChange token={`${info?.queue?.status}:${info?.queue?.reportedAt}:${info?.queue?.confirmations ?? 0}`} color="rgba(255,255,255,0.18)">
                    <QueueStatusLine
                      status={info?.queue?.status}
                      reportedAt={info?.queue?.reportedAt}
                      onColor
                      suffix={info?.queue?.confirmations ? `${info.queue.confirmations} confirmed` : undefined}
                    />
                    </FlashOnChange>
                  )}
                </View>
                {info?.alert ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <TriangleAlert size={14} color="#FDE68A" />
                    <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#FFFFFF', flexShrink: 1 }} numberOfLines={1}>{info.alert.title}</Text>
                  </View>
                ) : null}
              </View>
              {fare ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <HeroText size={26} style={{ color: '#FFFFFF' }}>
                    {fare.source === 'reported' ? '~' : ''}{formatGHS(fare.amount)}
                  </HeroText>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 10, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.6 }}>
                    {fare.source === 'gprtu' ? 'GPRTU FARE' : 'REPORTED FARE'}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
            </EnterIn>
          )
        })}
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/queue/status' as any) }}
        accessibilityRole="button"
        accessibilityLabel="Report the queue at your stop"
        style={{ marginTop: 10, height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
      >
        <Users size={18} color={ORANGE} />
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>At the station? Report the queue</Text>
      </TouchableOpacity>
    </View>
  )
}
