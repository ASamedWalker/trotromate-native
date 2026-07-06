import React, { useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Clapperboard, Music, Beer, PartyPopper, Mic2, Navigation, ChevronRight,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import {
  ACCRA_MOVIES, ACCRA_EVENTS, type CityEvent, type MovieListing,
} from '@/lib/constants/accra-events'

const CATEGORY_META: Record<CityEvent['category'], { icon: any; color: string; bg: string }> = {
  concert: { icon: Music, color: '#C026D3', bg: '#FDF4FF' },
  bar: { icon: Beer, color: '#D97706', bg: '#FFFBEB' },
  festival: { icon: PartyPopper, color: '#059669', bg: '#ECFDF5' },
  comedy: { icon: Mic2, color: '#0284C7', bg: '#F0F9FF' },
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
} as const

function formatEventDate(iso: string): { day: string; month: string } {
  const d = new Date(`${iso}T12:00:00`)
  return {
    day: String(d.getDate()),
    month: d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

/** Ad-slot click logging — replaced by a real impressions/clicks API later */
function trackPlacement(placementId: string) {
  if (__DEV__) console.log('[troski] ad_placement_click', placementId)
}

function SponsoredBadge({ light = false }: { light?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: light ? 'rgba(255,255,255,0.22)' : '#F3F4F6',
        borderRadius: 100,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 9, color: light ? '#fff' : '#6B7280', letterSpacing: 0.3 }}>
        SPONSORED
      </Text>
    </View>
  )
}

export default function WhatsOnAccra() {
  const router = useRouter()

  const goToVenue = useCallback((venueStop: string, placementId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackPlacement(placementId)
    router.push(`/routes/search?to=${encodeURIComponent(venueStop)}` as any)
  }, [router])

  return (
    <View style={{ marginBottom: 28 }}>
      {/* ── Section header ── */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24, marginBottom: 16,
        }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 24, color: '#000', letterSpacing: -0.5 }}>
          What&apos;s On in Accra
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>This week</Text>
      </View>

      {/* ── Movie carousel ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
      >
        {ACCRA_MOVIES.map((movie: MovieListing) => (
          <TouchableOpacity
            key={movie.id}
            activeOpacity={0.8}
            onPress={() => goToVenue(movie.venueStop, movie.placementId)}
            style={{ width: 128 }}
          >
            <LinearGradient
              colors={movie.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 128, height: 192, borderRadius: 16, padding: 12,
                justifyContent: 'space-between', overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                {movie.sponsored && <SponsoredBadge light />}
              </View>
              <View>
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#fff' }} numberOfLines={2}>
                  {movie.title}
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  {movie.genre} · {movie.rating}
                </Text>
              </View>
            </LinearGradient>
            <Text
              style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', marginTop: 6 }}
              numberOfLines={1}
            >
              {movie.cinema}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Events list ── */}
      <View style={{ paddingHorizontal: 24, marginTop: 16, gap: 12 }}>
        {ACCRA_EVENTS.map((event) => {
          const meta = CATEGORY_META[event.category]
          const Icon = meta.icon
          const { day, month } = formatEventDate(event.date)
          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.8}
              onPress={() => goToVenue(event.venueStop, event.placementId)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
                ...CARD_SHADOW,
              }}
            >
              {/* Date block */}
              <View
                style={{
                  width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: '#000' }}>{day}</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 9, color: '#6B7280', letterSpacing: 0.3, marginTop: -3 }}>
                  {month}
                </Text>
              </View>

              {/* Title + venue */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#000', flexShrink: 1 }} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {event.sponsored && <SponsoredBadge />}
                </View>
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>
                  {event.venue} · {event.time}
                  {event.priceFrom != null ? ` · from GH₵${event.priceFrom}` : ''}
                </Text>
              </View>

              {/* Category + route-there hint */}
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: meta.bg, borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 6,
                }}
              >
                <Icon size={13} color={meta.color} />
                <Navigation size={12} color={meta.color} />
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── Advertiser CTA ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          Alert.alert(
            'Advertise on Troski',
            'Reach thousands of Accra commuters. Email ads@troski.me to promote your event, movie or business.',
          )
        }}
        style={{
          marginHorizontal: 24, marginTop: 12,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
          paddingHorizontal: 14, paddingVertical: 12,
        }}
      >
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', flex: 1 }}>
          Promote your event or business to Accra commuters
        </Text>
        <ChevronRight size={16} color="#6B7280" />
      </TouchableOpacity>
    </View>
  )
}
