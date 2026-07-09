import React, { useCallback, useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ImageBackground } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Clapperboard, Music, Beer, PartyPopper, Mic2, Navigation, ChevronRight,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import {
  ACCRA_MOVIES, ACCRA_EVENTS, type CityEvent, type MovieListing,
} from '@/lib/constants/accra-events'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

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
  if (!iso) return { day: '•', month: '' }
  const d = new Date(`${iso}T12:00:00`)
  return {
    day: String(d.getDate()),
    month: d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

/** API row → client shape; tolerant of missing fields */
interface ApiRow {
  kind: 'movie' | 'event'
  id: string
  placement_id: string
  title: string
  category: string
  description?: string | null
  venue: string
  venue_stop: string
  rating?: string | null
  event_date?: string | null
  event_time?: string | null
  price_from?: number | null
  poster_url?: string | null
  gradient_from?: string | null
  gradient_to?: string | null
  sponsored?: boolean
}

const DEFAULT_GRADIENT: [string, string] = ['#475569', '#020617']
const EVENT_CATEGORIES: CityEvent['category'][] = ['concert', 'bar', 'festival', 'comedy']

function toMovie(r: ApiRow): MovieListing & { posterUrl?: string } {
  return {
    id: r.id,
    placementId: r.placement_id,
    title: r.title,
    genre: r.category,
    rating: r.rating || '',
    description: r.description || undefined,
    cinema: r.venue,
    venueStop: r.venue_stop,
    gradient: r.gradient_from && r.gradient_to ? [r.gradient_from, r.gradient_to] : DEFAULT_GRADIENT,
    sponsored: Boolean(r.sponsored),
    posterUrl: r.poster_url || undefined,
  }
}

function toEvent(r: ApiRow): CityEvent {
  return {
    id: r.id,
    placementId: r.placement_id,
    title: r.title,
    category: EVENT_CATEGORIES.includes(r.category as CityEvent['category'])
      ? (r.category as CityEvent['category'])
      : 'concert',
    venue: r.venue,
    venueStop: r.venue_stop,
    description: r.description || undefined,
    date: r.event_date || '',
    time: r.event_time || '',
    priceFrom: r.price_from ?? undefined,
    sponsored: Boolean(r.sponsored),
  }
}

/** Fire-and-forget ad click tracking */
function trackPlacement(placementId: string, deviceId?: string) {
  fetch(`${API_URL}/api/events/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placement_id: placementId, metric: 'click', device_id: deviceId }),
  }).catch(() => {})
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
      <Text style={{ fontFamily: font.bold, fontSize: 10, color: light ? '#fff' : '#6B7280', letterSpacing: 0.3 }}>
        SPONSORED
      </Text>
    </View>
  )
}

export default function WhatsOnAccra() {
  const router = useRouter()
  const { deviceId } = useApp()
  // Bundled seed is a fallback — never show events whose date has passed (UX-34)
  const freshSeedEvents = ACCRA_EVENTS.filter((e) => !e.date || e.date >= new Date().toISOString().slice(0, 10))
  const [movies, setMovies] = useState<(MovieListing & { posterUrl?: string })[]>(ACCRA_MOVIES)
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

  // Card tap opens the detail screen (the pitch); the consumer decides there.
  // Tap = the tracked ad click.
  const openMovie = useCallback((movie: MovieListing & { posterUrl?: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackPlacement(movie.placementId, deviceId || undefined)
    const item = {
      kind: 'movie', placementId: movie.placementId, title: movie.title,
      category: movie.genre, description: movie.description, venue: movie.cinema,
      venueStop: movie.venueStop, rating: movie.rating, posterUrl: movie.posterUrl,
      gradient: movie.gradient, sponsored: movie.sponsored,
    }
    router.push(`/event/${movie.placementId}?item=${encodeURIComponent(JSON.stringify(item))}` as any)
  }, [router, deviceId])

  const openEvent = useCallback((event: CityEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    trackPlacement(event.placementId, deviceId || undefined)
    const item = {
      kind: 'event', placementId: event.placementId, title: event.title,
      category: event.category, description: event.description, venue: event.venue,
      venueStop: event.venueStop, date: event.date, time: event.time,
      priceFrom: event.priceFrom, sponsored: event.sponsored,
    }
    router.push(`/event/${event.placementId}?item=${encodeURIComponent(JSON.stringify(item))}` as any)
  }, [router, deviceId])

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
