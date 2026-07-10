import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ImageBackground } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Clapperboard, Navigation, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import {
  ACCRA_MOVIES, ACCRA_EVENTS, SEED_VALID_UNTIL, type CityEvent, type MovieListing,
} from '@/lib/constants/accra-events'
import {
  API_URL, CATEGORY_META, CARD_SHADOW, formatEventDate,
  toMovie, toEvent, trackImpressions, useWhatsOnNav,
} from '@/lib/whatson-shared'

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
      <Text style={{ fontFamily: font.bold, fontSize: 10, color: light ? '#fff' : '#6B7280', letterSpacing: 0.3 }}>
        SPONSORED
      </Text>
    </View>
  )
}

export default function WhatsOnAccra() {
  const router = useRouter()
  const { deviceId } = useApp()
  // Bundled seed is a fallback of REAL verified listings — but it decays.
  // Events hide after their date (UX-34); movies hide after the verified
  // programming week (SEED_VALID_UNTIL). Stale seed renders as nothing, never
  // as fake-fresh content. Live /api/events data replaces it when available.
  const today = new Date().toISOString().slice(0, 10)
  const seedMoviesValid = today <= SEED_VALID_UNTIL
  const freshSeedEvents = ACCRA_EVENTS.filter((e) => !e.date || e.date >= today)
  const [movies, setMovies] = useState<(MovieListing & { posterUrl?: string })[]>(seedMoviesValid ? ACCRA_MOVIES : [])
  const [events, setEvents] = useState<CityEvent[]>(freshSeedEvents)

  // Live listings from the backend; bundled seed stays as the offline fallback
  useEffect(() => {
    fetch(`${API_URL}/api/events`)
      .then((r) => r.json())
      .then((data) => {
        if (data.movies?.length > 0) setMovies(data.movies.map(toMovie))
        if (data.events?.length > 0) setEvents(data.events.map(toEvent))
      })
      .catch(() => {})
  }, [])

  // Record impressions once the rendered set settles (advertiser reporting)
  useEffect(() => {
    const ids = [...movies, ...events].map((x) => x.placementId)
    if (ids.length > 0) trackImpressions(ids, deviceId || undefined)
  }, [movies, events, deviceId])

  // Card tap opens the detail screen (the pitch); the consumer decides there.
  // Tap = the tracked ad click. Shared with the see-all screen.
  const { openMovie, openEvent } = useWhatsOnNav(deviceId || undefined)

  const isEmpty = movies.length === 0 && events.length === 0

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
          What&apos;s On
        </Text>
        {!isEmpty && (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/whatson' as any) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>See all</Text>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Empty state (visible so the section never silently vanishes) ── */}
      {isEmpty && (
        <View
          style={{
            marginHorizontal: 24, borderRadius: 16, backgroundColor: '#FFFFFF',
            paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', ...CARD_SHADOW,
          }}
        >
          <Clapperboard size={28} color="#D1D5DB" />
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#000', marginTop: 10, textAlign: 'center' }}>
            Nothing on right now
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 3, textAlign: 'center' }}>
            New movies and events land here every week.
          </Text>
        </View>
      )}

      {/* ── Movie carousel + events (only when there's content) ── */}
      {!isEmpty && (
      <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
      >
        {movies.map((movie) => {
          const overlay = (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                {movie.sponsored && <SponsoredBadge light />}
              </View>
              <View>
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#fff' }} numberOfLines={2}>
                  {movie.title}
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  {movie.genre}{movie.rating ? ` · ${movie.rating}` : ''}
                </Text>
              </View>
            </>
          )
          const posterStyle = {
            width: 128, height: 192, borderRadius: 16, padding: 12,
            justifyContent: 'space-between' as const, overflow: 'hidden' as const,
          }
          return (
          <TouchableOpacity
            key={movie.id}
            activeOpacity={0.8}
            onPress={() => openMovie(movie)}
            style={{ width: 128 }}
          >
            {movie.posterUrl ? (
              <ImageBackground source={{ uri: movie.posterUrl }} style={posterStyle} imageStyle={{ borderRadius: 16 }}>
                {overlay}
              </ImageBackground>
            ) : (
              <LinearGradient
                colors={movie.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={posterStyle}
              >
                {overlay}
              </LinearGradient>
            )}
            <Text
              style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', marginTop: 6 }}
              numberOfLines={1}
            >
              {movie.cinema}
            </Text>
          </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Events list ── */}
      <View style={{ paddingHorizontal: 24, marginTop: 16, gap: 12 }}>
        {events.map((event) => {
          const meta = CATEGORY_META[event.category]
          const Icon = meta.icon
          const { day, month } = formatEventDate(event.date)
          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.8}
              onPress={() => openEvent(event)}
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
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#6B7280', letterSpacing: 0.3, marginTop: -3 }}>
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
      </>
      )}

      {/* ── Advertiser CTA (only alongside real listings) ── */}
      {!isEmpty && (
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
      )}
    </View>
  )
}
