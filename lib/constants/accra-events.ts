/**
 * Seed data for the "What's On in Accra" home section (events + ad slots).
 *
 * First iteration of the advertising surface that will fund day-to-day ops.
 * Static/curated for now; the shape maps 1:1 to a future Supabase table +
 * admin CRUD so the UI won't change when it goes live:
 *  - `sponsored` marks paid placements (rendered with a "Sponsored" badge)
 *  - `placementId` is the ad-slot identifier for impression/click logging
 *  - `venueStop` maps the venue to a trotro destination so every ad
 *    deep-links into trip planning ("route me there")
 */

export type MovieListing = {
  id: string
  placementId: string
  title: string
  genre: string
  rating: string
  cinema: string
  venueStop: string
  /** Poster gradient placeholder until real poster assets/URLs land */
  gradient: [string, string]
  sponsored: boolean
}

export type CityEvent = {
  id: string
  placementId: string
  title: string
  category: 'concert' | 'bar' | 'festival' | 'comedy'
  venue: string
  venueStop: string
  /** ISO date (Ghana time) */
  date: string
  time: string
  priceFrom?: number
  sponsored: boolean
}

export const ACCRA_MOVIES: MovieListing[] = [
  {
    id: 'mv-1',
    placementId: 'home_movies_1',
    title: 'The Burial of Kojo II',
    genre: 'Drama',
    rating: 'PG-13',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Accra Mall',
    gradient: ['#7C3AED', '#312E81'],
    sponsored: true,
  },
  {
    id: 'mv-2',
    placementId: 'home_movies_2',
    title: 'Azonto Nights',
    genre: 'Comedy',
    rating: '15',
    cinema: 'Silverbird, West Hills Mall',
    venueStop: 'West Hills Mall',
    gradient: ['#F59E0B', '#B91C1C'],
    sponsored: false,
  },
  {
    id: 'mv-3',
    placementId: 'home_movies_3',
    title: 'Osu at Midnight',
    genre: 'Thriller',
    rating: '18',
    cinema: 'Global Cinemas, Weija',
    venueStop: 'Weija',
    gradient: ['#475569', '#020617'],
    sponsored: false,
  },
  {
    id: 'mv-4',
    placementId: 'home_movies_4',
    title: 'Kotoka Express',
    genre: 'Action',
    rating: 'PG-13',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Accra Mall',
    gradient: ['#059669', '#134E4A'],
    sponsored: false,
  },
]

export const ACCRA_EVENTS: CityEvent[] = [
  {
    id: 'ev-1',
    placementId: 'home_events_1',
    title: 'Afrobeats Live: Sarkodie & Friends',
    category: 'concert',
    venue: 'Grand Arena, AICC',
    venueStop: 'Accra Central',
    date: '2026-07-11',
    time: '8:00 PM',
    priceFrom: 150,
    sponsored: true,
  },
  {
    id: 'ev-2',
    placementId: 'home_events_2',
    title: 'Jazz & Palm Wine Fridays',
    category: 'bar',
    venue: '+233 Jazz Bar, Ring Road',
    venueStop: 'Circle',
    date: '2026-07-10',
    time: '7:30 PM',
    sponsored: false,
  },
  {
    id: 'ev-3',
    placementId: 'home_events_3',
    title: 'Osu Night Market Festival',
    category: 'festival',
    venue: 'Oxford Street, Osu',
    venueStop: 'Osu',
    date: '2026-07-18',
    time: '5:00 PM',
    sponsored: false,
  },
  {
    id: 'ev-4',
    placementId: 'home_events_4',
    title: 'Comedy Bar: Laugh Chest',
    category: 'comedy',
    venue: 'Alliance Française, Airport',
    venueStop: 'Airport',
    date: '2026-07-12',
    time: '7:00 PM',
    priceFrom: 80,
    sponsored: false,
  },
]
