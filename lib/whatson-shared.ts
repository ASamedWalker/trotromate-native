/**
 * Shared plumbing for the "What's On in Accra" surfaces — the home section
 * (components/WhatsOnAccra.tsx) and the full see-all screen (app/whatson.tsx).
 * Extracted so both render identical cards, hit the same tracking, and share
 * ONE session-level impression-dedup set (viewing a listing on home then on
 * see-all counts once, not twice).
 */
import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Music, Beer, PartyPopper, Mic2 } from 'lucide-react-native'
import { type CityEvent, type MovieListing } from '@/lib/constants/accra-events'

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export const CATEGORY_META: Record<CityEvent['category'], { icon: any; color: string; bg: string }> = {
  concert: { icon: Music, color: '#C026D3', bg: '#FDF4FF' },
  bar: { icon: Beer, color: '#D97706', bg: '#FFFBEB' },
  festival: { icon: PartyPopper, color: '#059669', bg: '#ECFDF5' },
  comedy: { icon: Mic2, color: '#0284C7', bg: '#F0F9FF' },
}

export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
} as const

export const DEFAULT_GRADIENT: [string, string] = ['#475569', '#020617']
export const EVENT_CATEGORIES: CityEvent['category'][] = ['concert', 'bar', 'festival', 'comedy']

export function formatEventDate(iso: string): { day: string; month: string } {
  if (!iso) return { day: '•', month: '' }
  const d = new Date(`${iso}T12:00:00`)
  return {
    day: String(d.getDate()),
    month: d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

/** API row → client shape; tolerant of missing fields */
export interface ApiRow {
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

export type ClientMovie = MovieListing & { posterUrl?: string }

export function toMovie(r: ApiRow): ClientMovie {
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

export function toEvent(r: ApiRow): CityEvent {
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
export function trackPlacement(placementId: string, deviceId?: string) {
  fetch(`${API_URL}/api/events/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placement_id: placementId, metric: 'click', device_id: deviceId }),
  }).catch(() => {})
}

// Impressions: one batched event per placement per app session, sent when a
// surface renders with listings. Session-level dedupe (shared across home +
// see-all) keeps counts honest — advertisers see "sessions that saw the ad".
const impressedThisSession = new Set<string>()
export function trackImpressions(placementIds: string[], deviceId?: string) {
  const fresh = placementIds.filter((p) => !impressedThisSession.has(p))
  if (fresh.length === 0) return
  fresh.forEach((p) => impressedThisSession.add(p))
  fetch(`${API_URL}/api/events/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placement_ids: fresh, metric: 'impression', device_id: deviceId }),
  }).catch(() => {})
}

/**
 * Shared nav to the event detail (the pitch). Tap = the tracked ad click; the
 * listing is passed as a JSON `item` param so the detail renders without a
 * refetch. Same contract used by home + see-all.
 */
export function useWhatsOnNav(deviceId?: string) {
  const router = useRouter()

  const openMovie = useCallback((movie: ClientMovie) => {
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

  return { openMovie, openEvent }
}
