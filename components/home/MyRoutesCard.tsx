import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { ChevronRight, Heart } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { timeAgo } from '@/lib/utils/time'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { CARD, ORANGE, ORANGE_SOFT, TEXT, TEXT2 } from './tokens'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
const MAX_ROUTES = 3

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

// Same shape as the web's describeCommute (trotromate lib/services/commute-card.ts),
// which also writes the 06:15 / 16:00 push, so the card and the push always agree.
interface CommuteInfo {
  routeId: string
  from: string
  to: string
  fare: { amount: number; source: 'gprtu' | 'reported' } | null
  queue: { station: string; status: QueueStatus; label: string; reportedAt: string } | null
}

interface CommuteResponse {
  variant: 'morning' | 'afternoon'
  items: CommuteInfo[]
}

const QUEUE_DOT: Record<QueueStatus, string> = {
  empty: '#16A34A',
  short: '#16A34A',
  moderate: '#EAB308',
  long: '#F97316',
  very_long: '#DC2626',
}

// Ghana is UTC+0: before noon riders head out, after noon they head home (same rule as the push)
function currentVariant(): 'morning' | 'afternoon' {
  return new Date().getUTCHours() < 12 ? 'morning' : 'afternoon'
}

async function fetchCommute(ids: string[], variant: 'morning' | 'afternoon'): Promise<CommuteResponse> {
  // ids sorted so the CDN cache is shared regardless of saved order (the card keeps its own order)
  const res = await fetch(`${API_URL}/api/commute?variant=${variant}&ids=${ids.map(encodeURIComponent).join(',')}`)
  if (!res.ok) throw new Error(`commute ${res.status}`)
  return res.json()
}

/**
 * Home "My routes": fare + queue at the boarding stop for the rider's saved (♥) routes.
 * Morning shows the trip out, afternoon the trip home. No saved routes → a one-line
 * nudge to save one (that also turns on the personal morning push).
 */
export default function MyRoutesCard({ style }: { style?: object }) {
  const router = useRouter()
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

  const heading = q.data?.variant === 'afternoon' ? 'heading home' : 'heading out'
  // Keep the saved order and names even before the server answers (or if it fails).
  const infoById = new Map((q.data?.items ?? []).map((i) => [i.routeId, i]))

  return (
    <View style={[{ marginHorizontal: 20, marginTop: 18, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 16 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 17, color: TEXT }}>My routes</Text>
        {q.data ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }}>· {heading}</Text> : null}
      </View>

      {saved.map((f, i) => {
        const info = infoById.get(f.id)
        const from = info?.from ?? f.from
        const to = info?.to ?? f.to
        return (
          <TouchableOpacity
            key={f.id}
            activeOpacity={0.7}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/[id]', params: { id: f.id } } as any) }}
            accessibilityRole="button"
            accessibilityLabel={`${from} to ${to}${info?.fare ? `, ${formatGHS(info.fare.amount)}` : ''}${info?.queue ? `, queue ${info.queue.label}, ${timeAgo(info.queue.reportedAt)}` : ''}`}
            style={{
              paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }} numberOfLines={1}>
                {from} → {to}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {q.isLoading ? (
                  <View style={{ height: 12, width: 140, borderRadius: 6, backgroundColor: '#F3F1EF' }} />
                ) : q.isError ? null : info?.queue ? (
                  <>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: QUEUE_DOT[info.queue.status] }} />
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, flexShrink: 1 }} numberOfLines={1}>
                      Queue at {info.queue.station}: {info.queue.label} · {timeAgo(info.queue.reportedAt)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, flexShrink: 1 }} numberOfLines={1}>
                    No queue report at {from} yet
                  </Text>
                )}
              </View>
            </View>
            {info?.fare ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 17, color: TEXT }}>
                  {info.fare.source === 'reported' ? '~' : ''}{formatGHS(info.fare.amount)}
                </Text>
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: info.fare.source === 'gprtu' ? '#15803D' : TEXT2, letterSpacing: 0.2 }}>
                  {info.fare.source === 'gprtu' ? 'GPRTU' : 'REPORTED'}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/queue/status' as any) }}
        accessibilityRole="button"
        accessibilityLabel="Report the queue at your stop"
        style={{ marginTop: 6, height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>At the station? Report the queue</Text>
      </TouchableOpacity>
    </View>
  )
}
