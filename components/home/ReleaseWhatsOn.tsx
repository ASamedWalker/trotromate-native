import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { adinkraXml } from '@/lib/brand/adinkra'
import { useApp } from '@/lib/contexts/AppContext'
import { API_URL, toEvent, formatEventDate, trackImpressions, useWhatsOnNav, type ApiRow } from '@/lib/whatson-shared'
import type { CityEvent } from '@/lib/constants/accra-events'
import { CARD, ORANGE, ORANGE_DEEP, TEXT, TEXT2 } from './tokens'

const MIN_EVENTS = 3
const LABEL: Record<CityEvent['category'], string> = { concert: 'CONCERT', bar: 'NIGHTLIFE', festival: 'FESTIVAL', comedy: 'COMEDY' }

type Item = { event: CityEvent; posterUrl?: string }

// Same backend feed the existing What's On uses (/api/events -> city_events).
// Only renders with >= 3 upcoming events; no bundled seed, nothing invented.
async function fetchUpcoming(): Promise<Item[]> {
  const res = await fetch(`${API_URL}/api/events`)
  const data = await res.json()
  const today = new Date().toISOString().slice(0, 10)
  const rows: ApiRow[] = Array.isArray(data?.events) ? data.events : []
  return rows
    .filter((r) => r.event_date && r.event_date >= today)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .map((r) => ({ event: toEvent(r), posterUrl: r.poster_url || undefined }))
}

const symbolXml = adinkraXml('sankofa', 90, 'rgba(255,255,255,0.18)')

export default function ReleaseWhatsOn() {
  const router = useRouter()
  const { deviceId } = useApp()
  const { openEvent } = useWhatsOnNav(deviceId || undefined)
  const q = useQuery({ queryKey: ['release-home-events'], queryFn: fetchUpcoming, staleTime: 10 * 60 * 1000 })
  const items = React.useMemo(() => q.data ?? [], [q.data])

  React.useEffect(() => {
    if (items.length >= MIN_EVENTS) trackImpressions(items.map((i) => i.event.placementId), deviceId || undefined)
  }, [items, deviceId])

  if (items.length < MIN_EVENTS) return null

  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 17, color: TEXT }}>What&apos;s On</Text>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/whatson' as any) }}
          accessibilityRole="button"
          accessibilityLabel="See all events"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>See all</Text>
          <ChevronRight size={16} color={ORANGE} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {items.map(({ event, posterUrl }) => {
          const { day, month } = formatEventDate(event.date)
          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.85}
              onPress={() => openEvent(event)}
              accessibilityRole="button"
              accessibilityLabel={event.title}
              style={{ width: 250, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, overflow: 'hidden' }}
            >
              <View style={{ height: 110, backgroundColor: ORANGE_DEEP }}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={{ width: 250, height: 110 }} contentFit="cover" recyclingKey={event.id} transition={0} />
                ) : (
                  <LinearGradient colors={['#FF5A28', ORANGE_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
                    <View style={{ position: 'absolute', right: -10, bottom: -14 }}>
                      <SvgXml xml={symbolXml} width={90} height={90} />
                    </View>
                  </LinearGradient>
                )}
                <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 }}>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.4 }}>{LABEL[event.category]}</Text>
                  </View>
                  {event.sponsored ? (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 10, color: TEXT2, letterSpacing: 0.4 }}>SPONSORED</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ padding: 12 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }} numberOfLines={2}>{event.title}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, marginTop: 4 }} numberOfLines={1}>
                  {day} {month}{event.time ? ` ${event.time}` : ''}{event.venue ? ` · ${event.venue}` : ''}
                </Text>
                {event.venueStop ? (
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: ORANGE, marginTop: 6 }} numberOfLines={1}>
                    Getting there: {event.venueStop} stop
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}
