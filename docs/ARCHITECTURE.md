# Troski — Architecture Documentation

## Overview

Troski is a community-powered transit app for Ghana's trotro (minibus) system. It enables commuters to search routes, check fares, report real-time conditions, earn rewards, and explore the transport network on an interactive map.

**Tech Stack:**
- **Frontend:** React Native 0.81 + Expo SDK 54 (New Architecture)
- **Navigation:** Expo Router v6 (file-based)
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime)
- **State Management:** React Query v5 + React Context
- **Maps:** Mapbox GL (@rnmapbox/maps v10.2)
- **Icons:** Lucide React Native
- **OTA Updates:** EAS Update (3 channels: Android preview, Android production, iOS production)

---

## Project Structure

```
trotromate-native/
├── app/                          # Screens (Expo Router file-based routing)
│   ├── (tabs)/                   # Bottom tab navigation
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Home — route search
│   │   ├── routes.tsx            # Browse & search all routes
│   │   ├── report.tsx            # Report hub (fare, queue, incident)
│   │   ├── rewards.tsx           # Points, level, leaderboard
│   │   ├── activity.tsx          # Community activity feed
│   │   └── tales.tsx             # Trotro Tales (photo sharing)
│   ├── report/                   # Report form modals
│   │   ├── fare.tsx              # Fare report form
│   │   ├── queue.tsx             # Queue status form
│   │   ├── incident.tsx          # Road incident form
│   │   ├── photo.tsx             # Photo capture for tales
│   │   └── train.tsx             # Train status report
│   ├── routes/                   # Route detail screens
│   │   ├── [id].tsx              # Single route view
│   │   └── plan.tsx              # Route planner results
│   ├── stations/
│   │   └── index.tsx             # Station map (Mapbox GL)
│   ├── train/
│   │   ├── index.tsx             # Train lines listing
│   │   └── [lineId].tsx          # Single train line detail
│   ├── profile/
│   │   ├── [deviceId].tsx        # Public profile view
│   │   └── followers.tsx         # Followers/following list
│   ├── settings/
│   │   ├── index.tsx             # Settings page
│   │   ├── edit-profile.tsx      # Edit profile
│   │   ├── edit-name.tsx         # Edit display name
│   │   └── notifications.tsx     # Notification preferences
│   ├── driver/
│   │   └── index.tsx             # Driver profile (coming soon)
│   ├── notifications/
│   │   └── index.tsx             # Notifications center
│   ├── _layout.tsx               # Root layout (providers)
│   ├── leaderboard.tsx           # Global leaderboard
│   ├── privacy.tsx               # Privacy policy
│   └── terms.tsx                 # Terms of service
│
├── components/                   # Reusable UI components
│   ├── stations/                 # Station-related components
│   │   ├── StationCard.tsx       # Station card with nearby stops
│   │   ├── StationBottomSheet.tsx # Bottom sheet for station list
│   │   └── StationListItem.tsx   # Station list row
│   ├── AppErrorBoundary.tsx      # Global error boundary
│   ├── BusynessMeter.tsx         # Visual queue indicator
│   ├── CommentSheet.tsx          # Comments bottom sheet
│   ├── ConfettiCelebration.tsx   # Reward celebration animation
│   ├── HappeningNow.tsx          # Live activity widget
│   ├── MyCommuteWidget.tsx       # Personal commute card
│   ├── OfflineBanner.tsx         # Offline status banner
│   ├── OnboardingFlow.tsx        # First-time user tutorial
│   ├── PopularRoutesScroller.tsx # Horizontal route carousel
│   ├── PromoBanner.tsx           # Promotional banners
│   ├── ReferralCard.tsx          # Referral system card
│   ├── ReportFAB.tsx             # Floating action button for reports
│   ├── RoutePlanMap.tsx          # Mapbox route visualization
│   ├── RoutePlannerResults.tsx   # Multi-leg route results
│   ├── SOSButton.tsx             # Emergency SOS feature
│   ├── SpendingSummary.tsx       # Fare spending analytics
│   ├── TrafficBadge.tsx          # Traffic condition indicator
│   ├── TrafficNow.tsx            # Live traffic widget
│   ├── TripShareButton.tsx       # Share trip details
│   └── WeatherBadge.tsx          # Weather conditions
│
├── lib/                          # Shared logic & utilities
│   ├── services/                 # Business logic & API calls
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # TypeScript type definitions
│   ├── constants/                # App constants
│   ├── contexts/                 # React Context providers
│   ├── supabase/                 # Supabase client & migrations
│   ├── utils/                    # Utility functions
│   ├── theme.ts                  # Theme colors & dark mode
│   └── query-client.ts           # React Query configuration
│
├── assets/
│   ├── data/                     # Bundled fallback data
│   │   ├── transport-stops.json  # 2,386 OSM transport stops
│   │   └── transport-routes.json # 566 OSM route corridors
│   ├── fonts/                    # Custom fonts
│   └── images/                   # App images & logo
│
├── scripts/                      # Data pipeline & utility scripts
│   ├── fetch-osm-transport.mjs   # Overpass API data fetcher
│   ├── seed-transport-data.mjs   # Supabase data seeder
│   ├── osm-station-lookup.mjs    # Station name matching
│   └── geocode-stations.js       # Station geocoding
│
└── docs/                         # Project documentation
    ├── ARCHITECTURE.md           # This file
    ├── VISION.md                 # Business roadmap
    └── CONTRIBUTING.md           # Contributor guide
```

---

## Architecture Layers

### 1. Presentation Layer (app/ + components/)

**Routing:** Expo Router v6 maps the filesystem to navigation routes. The `(tabs)/` group defines the bottom tab bar. Modal screens live in `report/`. Dynamic routes use `[param]` syntax.

**Styling:** NativeWind v4 provides Tailwind CSS classes in React Native. Theme colors are defined in `lib/theme.ts` with automatic dark mode support.

**Animations:** React Native Reanimated v4 powers smooth transitions. Gesture Handler v2 provides swipe/drag interactions. Bottom sheets use `@gorhom/bottom-sheet`.

### 2. State Management Layer

```
┌─────────────────────────────────────────────┐
│             AppContext (global)              │
│  deviceId, profile, badges, isOnline,       │
│  pendingReports, lastReward                 │
└───────────────┬─────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │    React Query v5     │
    │  (server state cache) │
    │                       │
    │  staleTime: 2 min     │
    │  gcTime: 10 min       │
    │  retry: 2             │
    └───────────┬───────────┘
                │
    ┌───────────┴───────────┐
    │   Supabase Client     │
    │  (API + Realtime)     │
    └───────────────────────┘
```

**AppContext** (`lib/contexts/AppContext.tsx`): Global state provider wrapping the entire app. Provides:
- `deviceId` — anonymous device identifier (UUID stored in SecureStore/AsyncStorage)
- `profile` — contributor profile with points, level, streak
- `badges` — earned badges
- `isOnline` — network connectivity status
- `pendingReports` — count of queued offline reports
- `lastReward` — most recent reward feedback for celebration animations

**React Query** (`lib/query-client.ts`): Server state management. Each data domain has a custom hook (e.g., `useRoutes`, `useStations`, `useTales`) that wraps `useQuery`/`useMutation`. Default stale time is 2 minutes; transport data uses 24-hour stale time since OSM data rarely changes.

### 3. Service Layer (lib/services/)

Services handle all business logic and API communication. Each service is a pure module exporting async functions.

| Service | Responsibility |
|---------|---------------|
| `routes.ts` | Route CRUD, popular routes, fare statistics |
| `reports.ts` | Submit fare, queue, and incident reports |
| `rewards.ts` | Points engine, badge checking, profile management, leaderboard |
| `route-planner.ts` | Multi-leg route planning through transfer hubs |
| `stations.ts` | Station data with queue stats aggregation |
| `tales.ts` | Photo sharing (Trotro Tales) with Supabase Storage |
| `train.ts` | Train lines, stations, and crowdsourced reports |
| `transport-stops.ts` | OSM transport stops + routes with bundled JSON fallback |
| `notifications.ts` | In-app notification generation (fare drops, queue alerts) |
| `traffic-api.ts` | PWA traffic API integration |
| `offline-queue.ts` | AsyncStorage-based report queue for offline use |
| `comments.ts` | Tale comments |
| `safety.ts` | Safety reporting features |
| `driver.ts` | Driver-specific features (planned) |

### 4. Data Layer (Supabase)

#### Authentication

Troski uses **anonymous device-based authentication** — no user accounts required. Each device generates a UUID on first launch, stored securely. This UUID serves as the contributor identity across all features.

```
Device Launch → Generate UUID → Store in SecureStore → Use as reporter_id
```

#### Database Schema

**Core Tables:**

```sql
routes (id, from_location, to_location, via, official_fare,
        estimated_duration_mins, distance_km, is_popular, transport_type)

stations (id, name, location, latitude, longitude, is_major)

fare_reports (id, route_id, reported_fare, reporter_id, reported_at, is_verified)

queue_reports (id, station_id, station_name, queue_status, wait_time_estimate_mins,
              reporter_id, reported_at, route_id)

incident_reports (id, location_name, incident_type, latitude, longitude,
                 reporter_id, reported_at, confirmations, expires_at)
```

**Rewards Tables:**

```sql
contributor_profiles (id, device_id, display_name, bio, avatar_url,
                     total_points, current_level, current_streak,
                     longest_streak, total_reports, fare_reports,
                     queue_reports, incident_reports, push_token)

badges (id, slug, name, description, icon, color,
        criteria_type, criteria_value, points_bonus)

contributor_badges (contributor_id, badge_id, earned_at, metadata)

points_history (id, contributor_id, report_id, report_type,
               points, reason, metadata)
```

**Social Tables:**

```sql
tale_posts (id, device_id, display_name, is_anonymous, image_url,
           image_urls, caption, post_type, location_name,
           like_count, comment_count, is_hidden)

tale_likes (id, post_id, device_id)  -- unique constraint on (post_id, device_id)

tale_comments (id, post_id, device_id, display_name, content)
```

**Train System Tables:**

```sql
train_lines (id, name, slug, description, color, stations_count,
            avg_duration_mins, fare_range_min, fare_range_max, is_active)

train_stations (id, line_id, name, slug, latitude, longitude,
               station_order, zone)

train_reports (id, line_id, station_id, device_id, report_type,
             crowd_level, direction, delay_mins, fare_amount, notes)
```

**Transport Data Tables (OSM):**

```sql
transport_stops (id, osm_id, name, latitude, longitude, stop_type,
                tags, linked_station_id)
-- stop_type: 'trotro_stop' | 'bus_stop' | 'lorry_park' | 'taxi_rank' | 'train_station'

transport_routes (id, osm_id, name, ref, route_from, route_to,
                 route_type, coordinates, color)
-- route_type: 'bus' | 'share_taxi' | 'minibus'
```

**Materialized Views:**

```sql
route_fare_stats     -- Aggregated fare data per route
station_queue_stats  -- Queue status aggregation by station
train_report_stats   -- Train report aggregation by line
weekly_leaderboard   -- Top contributors by weekly points
```

#### Row-Level Security (RLS)

- All tables have RLS enabled
- Public read access for crowdsourced data (routes, reports, tales, stations)
- Write access gated by device_id matching
- Delete access only for own content (tales)

### 5. Map Layer (Mapbox GL)

The station map (`app/stations/index.tsx`) renders multiple data layers:

```
Layer Stack (bottom to top):
─────────────────────────────
  3D Buildings (FillExtrusionLayer, zoom 14+)
  Route Corridors (LineLayer, zoom 11+)
  Transport Stop Icons (SymbolLayer per type, zoom 12-15+)
  Ambient Stop Dots (CircleLayer, zoom 13-14)
  POI Labels (SymbolLayer from Mapbox tileset)
  Station Markers (SymbolLayer, always visible)
  Selected Station Highlight
```

**Transport icons** are rendered using `<Mapbox.Image>` which converts React Native views (Lucide icons) into GPU-accelerated map textures. Each transport mode has a distinct icon:

| Mode | Icon | Color | Min Zoom |
|------|------|-------|----------|
| Trotro/Bus Stop | BusFront | Amber (#d97706) | 15 |
| Lorry Park | BusFront (larger) | Green (#16a34a) | 13 |
| Train Station | TrainFront | Blue (#2563eb) | 12 |
| Taxi Rank | Car | Yellow (#eab308) | 14 |

**Data source hierarchy:**
1. Supabase (primary) → React Query cache
2. Bundled JSON fallback (`assets/data/*.json`) → used when offline or API unavailable

### 6. Offline Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User submits │────▶│  NetInfo      │────▶│  Online?     │
│  a report     │     │  check        │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                          ┌───────┴───────┐
                                          │               │
                                       YES│            NO │
                                          │               │
                                   ┌──────▼──────┐ ┌──────▼──────┐
                                   │ Submit to   │ │ Queue in    │
                                   │ Supabase    │ │ AsyncStorage│
                                   │ immediately │ │ (@troski_   │
                                   │             │ │ offline_    │
                                   │             │ │ queue)      │
                                   └──────┬──────┘ └──────┬──────┘
                                          │               │
                                   ┌──────▼──────┐        │
                                   │ Award points│        │
                                   │ & check     │  On reconnect:
                                   │ badges      │  processQueue()
                                   └─────────────┘  drains queue
                                                     → submit each
                                                     → award points
```

The offline queue (`lib/services/offline-queue.ts`) stores reports in AsyncStorage as JSON. When connectivity returns, `processQueue()` replays each report, submits it to Supabase, and awards points. Failed items stay in the queue for retry.

---

## Data Flow Patterns

### Report Submission Flow

```
User fills form
  → Service function validates & submits to Supabase
    → On success: awardPointsForReport()
      → Check streak (7-day threshold, +5 bonus)
      → Check badge criteria
      → Return RewardResult
        → AppContext.setLastReward()
          → ConfettiCelebration renders
    → React Query invalidates relevant queries
```

### Route Planning Flow

```
User enters From → To
  → planRoute(from, to)
    → Query 1: Direct routes (both directions)
    → Query 2: Fetch active transfer hubs
    → For each hub: find from→hub AND hub→to legs
    → Sort: direct first, then cheapest, then fastest
    → Return top 5 TransferPlan results
      → RoutePlannerResults renders legs
      → RoutePlanMap visualizes on Mapbox
```

### Gamification Engine

```
Points awarded per report type:
  fare: 10pts | queue: 5pts | incident: 15pts | train: 10pts | tale: 8pts

Streak: 7 consecutive days of reporting → +5 bonus points per report

Levels:
  Passenger (0-49) → Regular (50-199) → Local Expert (200-499) → Troski Legend (500+)

Badges: Criteria-based (first_fare, streak_7, queue_master, etc.)
  → Checked after each report submission
  → Each badge awards bonus points
```

---

## Data Pipeline (Scripts)

### OSM Transport Data Pipeline

```
scripts/fetch-osm-transport.mjs
  → Queries Overpass API for Greater Accra (bbox 5.4,-0.5,5.9,0.1)
  → Fetches: bus stops, trotro stops, lorry parks, taxi ranks, train stations
  → Fetches: bus/share_taxi/minibus route relations with geometry
  → Deduplicates stops within 50m
  → Simplifies route geometry (Douglas-Peucker, 30m tolerance)
  → Outputs: assets/data/transport-stops.json (2,386 stops)
  → Outputs: assets/data/transport-routes.json (566 routes)

scripts/seed-transport-data.mjs
  → Reads bundled JSON files
  → Links stops to existing stations (haversine within 300m)
  → Modes:
    --preview: Shows what would be inserted
    --write:   Inserts via Supabase REST API (needs SUPABASE_SERVICE_KEY)
    --sql:     Generates SQL file for Supabase SQL Editor
```

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ^54.0.33 | Expo SDK framework |
| react-native | 0.81.5 | Core mobile framework |
| expo-router | ^6.0.23 | File-based navigation |
| nativewind | ^4.2.1 | Tailwind for React Native |
| @supabase/supabase-js | ^2.95.3 | Backend client |
| @tanstack/react-query | ^5.90.20 | Server state management |
| @rnmapbox/maps | ^10.2.10 | Mapbox GL maps |
| lucide-react-native | ^0.563.0 | Icon library |
| @gorhom/bottom-sheet | ^5.2.8 | Bottom sheet UI |
| react-native-reanimated | ^4.1.1 | Animations |
| expo-notifications | ^0.32.16 | Push notifications |
| expo-secure-store | ^15.0.8 | Secure storage |
| expo-image-picker | ^17.0.10 | Camera/gallery |
| @react-native-community/netinfo | 11.4.1 | Network status |
| @react-native-async-storage/async-storage | ^2.2.0 | Local persistence |

---

## Database Migrations

Migrations are stored in `lib/supabase/migrations/` and applied via Supabase SQL Editor.

| # | File | Description |
|---|------|-------------|
| 009 | `009_train_system.sql` | Train lines, stations, reports. Seeds Tema-Accra commuter line |
| 010 | `010_tales_and_storage.sql` | Tale posts, likes, comments. Storage bucket |
| 011 | `011_push_token.sql` | Push notification token column |
| 012 | `012_tale_posts_delete_policy.sql` | RLS policy for tale deletion |
| 013 | `013_station_coordinates.sql` | Station coordinates + queue stats view |
| 014 | `014_transport_stops.sql` | Transport stops & routes tables (OSM) |
| 015 | `015_seed_transport_data.sql` | Seed 2,386 stops + 566 routes |
| 016 | `016_expand_stations.sql` | Additional stations from OSM |
| 017 | `017_fix_queue_stats_view.sql` | Fix queue stats view aggregation |
| 018 | `018_add_train_station_type.sql` | Add train_station to stop_type check |

> Note: Migrations 001-008 exist in the shared PWA repo and cover core tables (routes, stations, fare_reports, queue_reports, contributor_profiles, badges, etc.)

---

## OTA Update Process

Troski uses EAS Update for over-the-air updates. Three channels must be updated:

```bash
# Android Preview (development/testing)
npx eas update --branch preview --platform android --message "Description"

# Android Production
npx eas update --branch production --platform android --message "Description"

# iOS Production
npx eas update --branch production --platform ios --message "Description"
```

**Important:** Run these sequentially (not parallel) to avoid `dist/` directory race conditions.

---

## Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_URL=https://your-pwa-domain.com
```

The Supabase anon key is safe to expose — RLS policies protect data access. The service role key (for seeding scripts) should never be committed.

---

## Shared Backend with PWA

Troski Native shares the same Supabase database as the [TrotroMate PWA](https://github.com/ASamedWalker/trotromate). Both apps read/write to the same tables.

| Concern | PWA | Native |
|---------|-----|--------|
| Framework | Next.js | React Native + Expo |
| Auth | Device UUID (cookie) | Device UUID (SecureStore) |
| Offline | Service Worker | AsyncStorage queue |
| Notifications | Web Push (limited) | FCM/APNs (full) |
| Maps | Mapbox GL JS | @rnmapbox/maps |
| Distribution | Web (vercel) | Play Store / App Store |
| OTA Updates | Deploy to Vercel | EAS Update |

---

## Performance Considerations

- **React Query caching:** 2-minute stale time reduces API calls. Transport data uses 24-hour stale time.
- **Map data:** Transport stops rendered as GeoJSON FeatureCollection, filtered by zoom level to avoid rendering thousands of icons at once.
- **Route geometry:** Douglas-Peucker simplification reduces route coordinates from thousands to hundreds of points.
- **Image uploads:** Tales use Supabase Storage with server-side resizing.
- **Bundle size:** Transport data JSON files are ~500KB total, loaded once and cached.

---

## Security

- **No user accounts:** Anonymous device-based identity eliminates password/credential risks
- **RLS everywhere:** Supabase Row-Level Security on all tables
- **Anon key only:** The app only uses the anon key; service role key is never bundled
- **Input validation:** Report forms validate on client and server (Supabase constraints)
- **Content moderation:** Tales can be hidden (`is_hidden` flag)
- **Rate limiting:** Supabase handles connection-level rate limiting
