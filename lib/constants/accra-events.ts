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

// Seed arrays intentionally EMPTY (owner decision 2026-07-09): all listings
// are managed live in /admin/events. The section hides when the API has no
// rows; nothing bundled can ever go stale. Types + SEED_VALID_UNTIL kept for
// the fallback plumbing should a curated offline seed ever return.

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
export const ACCRA_MOVIES: MovieListing[] = []

// Verified: allevents.in/accra listings retrieved 2026-07-09.
export const ACCRA_EVENTS: CityEvent[] = []
