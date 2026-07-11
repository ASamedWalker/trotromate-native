import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ImageBackground, Dimensions, ActivityIndicator, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft, Clapperboard, Navigation, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import {
  ACCRA_MOVIES, ACCRA_EVENTS, SEED_VALID_UNTIL, type CityEvent,
} from '@/lib/constants/accra-events'
import {
  API_URL, CATEGORY_META, CARD_SHADOW, formatEventDate,
  toMovie, toEvent, trackImpressions, useWhatsOnNav, ADVERTISE_MAILTO, type ClientMovie,
} from '@/lib/whatson-shared'

const SCREEN_W = Dimensions.get('window').width
const GRID_GAP = 12
const GRID_PADDING = 24
// 2-column poster grid
const POSTER_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2
const POSTER_H = POSTER_W * 1.5

function SponsoredBadge({ light = false }: { light?: boolean }) {
  return (
    <View style={{ backgroundColor: light ? 'rgba(255,255,255,0.22)' : '#F3F4F6', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 10, color: light ? '#fff' : '#6B7280', letterSpacing: 0.3 }}>
        SPONSORED
      </Text>
    </View>
  )
}

export default function WhatsOnScreen() {
  const router = useRouter()
  const { deviceId } = useApp()
  const { openMovie, openEvent } = useWhatsOnNav(deviceId || undefined)

  const today = new Date().toISOString().slice(0, 10)
  const seedMoviesValid = today <= SEED_VALID_UNTIL
  const freshSeedEvents = ACCRA_EVENTS.filter((e) => !e.date || e.date >= today)
  const [movies, setMovies] = useState<ClientMovie[]>(seedMoviesValid ? ACCRA_MOVIES : [])
  const [events, setEvents] = useState<CityEvent[]>(freshSeedEvents)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Bound the fetch — Ghana mobile networks stall; never hang the spinner.
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    fetch(`${API_URL}/api/events`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        // On this screen the backend is the source of truth — replace the seed
        // outright (even with empty arrays) so nothing stale lingers.
        if (Array.isArray(data.movies)) setMovies(data.movies.map(toMovie))
        if (Array.isArray(data.events)) setEvents(data.events.map(toEvent))
      })
      .catch(() => {})
      .finally(() => { clearTimeout(t); setLoading(false) })
    return () => { clearTimeout(t); ctrl.abort() }
  }, [])

  // Impressions (shared session dedupe with the home section). Only fire once
  // loading is done — otherwise we'd record impressions for cards still hidden
  // behind the spinner, permanently deduping them in the shared Set and
  // suppressing the real impression when they finally render.
  useEffect(() => {
    if (loading) return
    const ids = [...movies, ...events].map((x) => x.placementId)
    if (ids.length > 0) trackImpressions(ids, deviceId || undefined)
  }, [loading, movies, events, deviceId])

  const isEmpty = !loading && movies.length === 0 && events.length === 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9' }} edges={['top']}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back() }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...CARD_SHADOW }}
        >
          <ChevronLeft size={22} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: '#000', letterSpacing: -0.5 }}>What&apos;s On</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: -2 }}>Movies &amp; events across the city</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF4D1C" />
        </View>
      ) : isEmpty ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Clapperboard size={40} color="#D1D5DB" />
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginTop: 12, textAlign: 'center' }}>Nothing on right now</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
            Check back soon — new movies and events land here every week.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* ── Movies grid ── */}
          {movies.length > 0 && (
            <View style={{ paddingHorizontal: GRID_PADDING, marginTop: 8 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginBottom: 12 }}>Now Showing</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                {movies.map((movie) => {
                  const overlay = (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                        {movie.sponsored && <SponsoredBadge light />}
                      </View>
                      <View>
                        <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }} numberOfLines={2}>{movie.title}</Text>
                        <Text style={{ fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                          {movie.genre}{movie.rating ? ` · ${movie.rating}` : ''}
                        </Text>
                      </View>
                    </>
                  )
                  const posterStyle = {
                    width: POSTER_W, height: POSTER_H, borderRadius: 16, padding: 12,
                    justifyContent: 'space-between' as const, overflow: 'hidden' as const,
                  }
                  return (
                    <TouchableOpacity key={movie.id} activeOpacity={0.8} onPress={() => openMovie(movie)} style={{ width: POSTER_W }}>
                      {movie.posterUrl ? (
                        <ImageBackground source={{ uri: movie.posterUrl }} style={posterStyle} imageStyle={{ borderRadius: 16 }}>
                          {overlay}
                        </ImageBackground>
                      ) : (
                        <LinearGradient colors={movie.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={posterStyle}>
                          {overlay}
                        </LinearGradient>
                      )}
                      <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', marginTop: 6 }} numberOfLines={1}>{movie.cinema}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          {/* ── Events list ── */}
          {events.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: movies.length > 0 ? 24 : 8, gap: 12 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000' }}>Events</Text>
              {events.map((event) => {
                const meta = CATEGORY_META[event.category]
                const Icon = meta.icon
                const { day, month } = formatEventDate(event.date)
                return (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.8}
                    onPress={() => openEvent(event)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, ...CARD_SHADOW }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: '#000' }}>{day}</Text>
                      <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#6B7280', letterSpacing: 0.3, marginTop: -3 }}>{month}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#000', flexShrink: 1 }} numberOfLines={1}>{event.title}</Text>
                        {event.sponsored && <SponsoredBadge />}
                      </View>
                      <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>
                        {event.venue} · {event.time}{event.priceFrom != null ? ` · from GH₵${event.priceFrom}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: meta.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Icon size={13} color={meta.color} />
                      <Navigation size={12} color={meta.color} />
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* ── Advertiser CTA ── */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              Linking.openURL(ADVERTISE_MAILTO).catch(() => {})
            }}
            style={{ marginHorizontal: 24, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', paddingHorizontal: 14, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', flex: 1 }}>Promote your event or business to Accra commuters</Text>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
