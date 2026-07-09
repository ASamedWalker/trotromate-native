/**
 * Bundled fallback for the "What's On in Accra" home section (events + ad slots).
 *
 * HONESTY RULES (this seed once shipped invented movies/concerts — never again):
 *  - Every listing below is REAL, verified against live sources on 2026-07-09
 *    (Silverbird Accra Mall week of Jul 3–9 via viewGhana; events via allevents.in).
 *  - Nothing is marked `sponsored` — nobody has paid for placement yet.
 *  - The seed SELF-EXPIRES: movies hide after SEED_VALID_UNTIL, events hide
 *    after their date. Live data from /api/events (admin-managed) replaces
 *    this whenever available; the section renders nothing rather than stale.
 */

/** Movie seed is trustworthy for roughly one cinema programming week. */
export const SEED_VALID_UNTIL = '2026-07-16'

export type MovieListing = {
  id: string
  placementId: string
  title: string
  genre: string
  rating: string
  description?: string
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
  description?: string
  /** ISO date (Ghana time) */
  date: string
  time: string
  priceFrom?: number
  sponsored: boolean
}

// Verified: Silverbird Accra Mall "now showing" week of Jul 3–9 2026
// (viewghana.com/movies-showing-at-silverbird-cinema-accra-mall, updated Jul 3).
export const ACCRA_MOVIES: MovieListing[] = [
  {
    id: 'mv-supergirl',
    placementId: 'home_movies_supergirl',
    title: 'SuperGirl',
    genre: 'Action · Sci-Fi',
    rating: '12A',
    description: 'Now showing at Silverbird, Accra Mall (2D/3D/4DX screens). Confirm showtimes at silverbirdcinemas.com — they change weekly.',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Tetteh Quarshie',
    gradient: ['#1D4ED8', '#312E81'],
    sponsored: false,
  },
  {
    id: 'mv-toystory5',
    placementId: 'home_movies_toystory5',
    title: 'Toy Story 5',
    genre: 'Animation',
    rating: 'PG',
    description: 'Pixar\'s latest — family screening at Silverbird, Accra Mall. Confirm showtimes at silverbirdcinemas.com.',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Tetteh Quarshie',
    gradient: ['#0891B2', '#164E63'],
    sponsored: false,
  },
  {
    id: 'mv-remi-nneoma',
    placementId: 'home_movies_remi_nneoma',
    title: 'Remi & Nneoma',
    genre: 'Nollywood · Drama',
    rating: '15',
    description: 'Nollywood drama now showing at Silverbird, Accra Mall. Confirm showtimes at silverbirdcinemas.com.',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Tetteh Quarshie',
    gradient: ['#B45309', '#7C2D12'],
    sponsored: false,
  },
  {
    id: 'mv-prada2',
    placementId: 'home_movies_prada2',
    title: 'The Devil Wears Prada 2',
    genre: 'Comedy · Drama',
    rating: '12A',
    description: 'Now showing at Silverbird, Accra Mall. Confirm showtimes at silverbirdcinemas.com.',
    cinema: 'Silverbird, Accra Mall',
    venueStop: 'Tetteh Quarshie',
    gradient: ['#BE185D', '#500724'],
    sponsored: false,
  },
]

// Verified: allevents.in/accra listings retrieved 2026-07-09.
export const ACCRA_EVENTS: CityEvent[] = [
  {
    id: 'ev-tech-mixer',
    placementId: 'home_events_tech_mixer',
    title: 'Accra Tech Mixer & Social',
    category: 'bar',
    venue: 'The Honeysuckle Pub, Osu',
    venueStop: 'Osu',
    description: 'Tech, AI and data meetup — casual networking over drinks at The Honeysuckle Pub & Restaurant, Osu.',
    date: '2026-07-10',
    time: '7:00 PM',
    sponsored: false,
  },
  {
    id: 'ev-night-of-hymns',
    placementId: 'home_events_night_of_hymns',
    title: 'Night of Hymns',
    category: 'concert',
    venue: 'Queen of Peace Catholic Church, Madina',
    venueStop: 'Madina',
    description: 'An evening of choral hymns at Madina Queen of Peace Catholic Church.',
    date: '2026-07-11',
    time: '4:00 PM',
    sponsored: false,
  },
  {
    id: 'ev-prayer-summit',
    placementId: 'home_events_prayer_summit',
    title: 'Global Prayer Works Summit',
    category: 'festival',
    venue: 'Action Chapel International, Spintex',
    venueStop: 'Spintex',
    description: '2026 Global Prayer Works Summit hosted at Action Chapel International.',
    date: '2026-07-15',
    time: '9:00 AM',
    sponsored: false,
  },
]
