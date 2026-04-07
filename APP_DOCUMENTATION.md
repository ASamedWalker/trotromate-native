# Troski — Complete App Documentation

> **Version:** 1.1.0 | **Platform:** Expo SDK 54 (React Native 0.81) | **Package:** com.troski.app
> **Tagline:** Know your trotro fare, beat the queue. Community-powered transit updates for Ghana.

---

## Table of Contents

1. [App Architecture](#app-architecture)
2. [Tab Navigation](#tab-navigation)
3. [Home Page](#1-home-page)
4. [Routes Page](#2-routes-page)
5. [Tales Page](#3-tales-page)
6. [Rewards Page](#4-rewards-page)
7. [Activity Page](#5-activity-page)
8. [Report Hub (Hidden Tab)](#6-report-hub-hidden-tab)
9. [Profile (Hidden Tab)](#7-profile-hidden-tab)
10. [Report Screens](#report-screens)
11. [Route Detail](#route-detail)
12. [Train Pages](#train-pages)
13. [GO Mode (Trip Tracking)](#go-mode-trip-tracking)
14. [Stations Map](#stations-map)
15. [Leaderboard](#leaderboard)
16. [Notifications](#notifications)
17. [Settings & Legal](#settings--legal)
18. [Social Features](#social-features)
19. [Reel (Video Viewer)](#reel-video-viewer)
20. [Driver Dashboard (Stub)](#driver-dashboard)
21. [Onboarding Flow](#onboarding-flow)
22. [Components Library](#components-library)
23. [Hooks Library](#hooks-library)
24. [Services Layer](#services-layer)
25. [Theme & Design System](#theme--design-system)
26. [Data & Constants](#data--constants)
27. [Offline & Caching](#offline--caching)
28. [Notifications System](#notifications-system)
29. [Gamification & Rewards](#gamification--rewards)
30. [Permissions & Plugins](#permissions--plugins)
31. [Key Dependencies](#key-dependencies)

---

## App Architecture

### Root Layout (`app/_layout.tsx`)
- Initializes **Poppins** font family (400–900 weights)
- Dark/light theme auto-detection
- Global providers: `QueryClientProvider`, `AppProvider`, error boundary
- OTA update check on launch (silent download, apply on next cold start)
- Push notification registration
- Commute alert subscriptions
- Splash screen → Onboarding (if first time) → Main app
- Stack navigator with modal presentations for reports/overlays

### Global State (`lib/contexts/AppContext.tsx`)
| State | Description |
|-------|-------------|
| `deviceId` | Unique device identifier (SecureStore native, AsyncStorage web) |
| `profile` | ContributorProfile — points, level, streak, badges, report counts |
| `badges` | Earned badge array |
| `rank` | Weekly leaderboard rank |
| `lastReward` | Last reward result (triggers confetti celebration) |
| `isOnline` | Network connectivity status |
| `pendingReports` | Count of queued offline reports |

### Database
- **Supabase** (PostgreSQL) via `@supabase/supabase-js`
- AsyncStorage for session persistence
- Realtime subscriptions for live updates (fare/queue/incident reports, tales)

---

## Tab Navigation

**File:** `app/(tabs)/_layout.tsx`

5 visible tabs + 2 hidden (navigable) tabs. Glass morphism bottom nav with frosted blur background, amber (#f59e0b) active icon color.

| Tab | Icon | Visible | Route |
|-----|------|---------|-------|
| Home | Home | Yes | `/(tabs)/` |
| Routes | MapPin | Yes | `/(tabs)/routes` |
| Tales | Camera | Yes | `/(tabs)/tales` |
| Rewards | Trophy | Yes | `/(tabs)/rewards` |
| Activity | Bell | Yes | `/(tabs)/activity` |
| Report | Plus | Hidden | `/(tabs)/report` |
| Profile | User | Hidden | `/(tabs)/profile` |

---

## 1. Home Page

**File:** `app/(tabs)/index.tsx`

### Layout
Map-first interface with Mapbox centered on Accra (5.6037, -0.187). Three-layer UI:

1. **Map layer** — Full screen Mapbox with station dots, train polylines, queue heatmap
2. **Floating UI** — Search bar, service mode pills, live badges
3. **Bottom sheet** — Draggable (3 snap points: 18%, 50%, 88%) with content cards

### Top Section
- **Animated search bar** — Rotating placeholder hints ("Search Kasoa to Kaneshie...", "Find train schedules..."). Tapping opens UnifiedSearch modal
- **Service mode pills** — Horizontal scrollable: Trotro (amber) | Train (cyan) | GO (green, pulses when trip active) | Tales (purple)

### Map Features
- **Station markers** — GeoJSON dots colored by queue status:
  - Green (#22c55e) = empty/short queue
  - Amber (#f59e0b) = moderate
  - Red (#ef4444) = long/very long
- **Train route polylines** — Dashed blue lines for TMA and TMP
- **Wait time labels** — Floating text showing estimated wait at busy stations
- **Live queue badge counter** — Shows count of active queue reports

### Bottom Sheet Content
- **SmartCommuteCard** — Time-context suggestions with icons:
  - Morning (6-11am): Sunrise icon, "Morning Rush"
  - Afternoon (11am-4pm): Coffee icon
  - Evening (4-8pm): Sunset icon, "Evening Rush"
  - Night: Palmtree icon
- **NearbyLines** — Distance-sorted train lines + trotro routes. Urban Pulse-inspired cards with thick left accent border, large line IDs, type badges (TROTRO/GPRTU/LIVE/SCHEDULED), accent-tinted backgrounds
- **HappeningNow** — Live incidents and queue alerts from Supabase Realtime

### Overlays
- **Active trip banner** — Green bar: "Trip in progress" (when GO Mode active)
- **ReportFAB** — Floating action button (bottom-right) opening 3x2 report grid
- **UnifiedSearch modal** — Full-screen search with debounced trotro + train results

---

## 2. Routes Page

**File:** `app/(tabs)/routes.tsx`

### Design
Material Design 3 styling — surface container tones, pill-shaped elements, tonal elevation.

### Top Section
- **M3 search bar** — Pill shape (borderRadius: 28), surfaceContainerHigh background, Search icon, no border
- **Region dropdown** — Modal selector with all Ghana regions (Greater Accra, Ashanti, etc.)
- **M3 filter chips** — Horizontal row: All | Trotro | Okada | Popular | Saved
  - Inactive: outlined with surface container bg
  - Active: filled with checkmark icon

### Content
- **Region hero banner** — When region selected, shows hero image + tagline (e.g., "Accra — The Gateway City")
- **ExploreGhana** — Horizontal carousel of region cards (when no filters applied)
- **Route cards** — M3 surface container bg, no border:
  - Transport type pill (TROTRO/OKADA)
  - Bus icon + From → ArrowRight → To
  - Estimated duration
  - GPRTU verified badge (green shield) if verified
  - Fare in extrabold 18px (right-aligned)
  - Heart icon for favoriting

### Features
- Pull-to-refresh
- Infinite scroll with loader
- Empty state: "No routes found" + "Add this route" CTA
- Favorites toggle via heart icon

---

## 3. Tales Page

**File:** `app/(tabs)/tales.tsx`

Instagram-style photo/video feed of community transit stories.

### Header
- "Troski Tales" title
- Pink "New" FAB button → opens photo report screen

### TaleCard Component
Each post contains:
- **Profile row** — InitialsAvatar + display name + emoji badge (trip/queue/tale) + time ago
- **Video badge** — Blue "VIDEO" pill if contains video
- **Media carousel** — Swipeable images/videos
  - Single image = static display
  - Multiple = horizontal swipe with dot indicators
  - Video: plays only when visible, unmounts if >3 positions offscreen
- **Location tag** — Pin icon + station/location name
- **Reaction bar** — Emoji pills (👍❤️😂🚨💯👀) with counts + user toggle
- **Comment button** — Opens CommentSheet modal
- **Caption** — Post text + "View all comments" link
- **3-dot menu** — Report post / Delete (if own post)

### Features
- Pull-to-refresh
- Infinite scroll pagination
- Video auto-play on visibility
- Comment sheet with nested replies

---

## 4. Rewards Page

**File:** `app/(tabs)/rewards.tsx`

Transit app-inspired leaderboard with deep maroon (#6B1D1D) hero.

### Maroon Hero Section
- **Decorative circles** — Subtle white opacity circles for depth
- **User rank badge** — Large circle (64px) with rank number centered
- **"Top Contributors"** — White bold title
- **Period tabs** — "THIS WEEK" / "ALL TIME" with underline indicator
  - THIS WEEK: sorted by `weekly_points`
  - ALL TIME: sorted by `total_points`

### Podium (Top 3)
Arranged 2nd (left) | 1st (center, larger) | 3rd (right):
- **Crown/gem emoji** above each avatar (💚, 💎, 👑)
- **Avatar ring** — Colored border (green/purple/amber) around circle
- **Level emoji** inside avatar (🚶/🚌/📍/🏆)
- **Rank pill** — Colored badge ("1st"/"2nd"/"3rd") at avatar bottom
- **Name** — Uppercase bold white text
- **Points** — Below name, semi-transparent

### Ranked List (4-10)
Inside the same maroon background:
- Thin divider line separating from podium
- Each row: rank number | colored avatar ring | uppercase name | points
- Highlighted row if current user (amber tint)
- "See full leaderboard" link at bottom

### Below Hero
- **Invite Friends card** — M3 styled ReferralCard:
  - Gift icon + title + subtitle ("You both earn 50 bonus points")
  - Dashed code box with referral code
  - Copy button (pill shape) + circular Share button
  - Friend count if any joined
- **Earn Points card** — M3 collapsible:
  - TrendingUp icon + title + subtitle
  - Expandable list with emoji icons per action:
    - 🚐 Report a fare (+10)
    - 🕐 Report queue status (+5)
    - ⚠️ Report incident (+15)
    - 🚆 Report train (+10)
    - 📸 Share a tale (+8)
    - 🔥 7-day streak bonus (+5)
  - Each points value in amber pill badge

---

## 5. Activity Page

**File:** `app/(tabs)/activity.tsx`

### Layout
SectionList grouped by date: **Today** | **Yesterday** | **This Week** | **Older**

### Activity Items
Each item is a SwipeableRow (swipe right to delete with animation):
- **Icon** — Colored background circle by type:
  - Fare: amber
  - Queue: violet
  - Incident: red
  - Tale: pink
  - Train: sky blue
  - Trip: green
- **Content** — Title + subtitle text
- **Meta** — Time ago + unread dot (blue) if new

### Features
- Pull-to-refresh
- Infinite scroll
- Swipe-to-delete with layout animation (Android)
- Empty state: "No activity yet" with icon

---

## 6. Report Hub (Hidden Tab)

**File:** `app/(tabs)/report.tsx`

Contribution hub with 5 report type cards:

| Type | Icon | Color | Points |
|------|------|-------|--------|
| Fare | TrendingUp | Amber | +10 |
| Queue | Users | Violet | +5 |
| Incident | AlertTriangle | Red | +15 |
| Photo/Tales | Camera | Pink | +8 |
| Train | TrainFront | Sky | +10 |

Each card: icon | title | description | points badge

**Bottom section:** "Your Contribution Stats" banner showing total reports, total points, day streak.

---

## 7. Profile (Hidden Tab)

**File:** `app/(tabs)/profile.tsx`

### Layout
- **Header** — "Profile" title + settings cog icon
- **Avatar card** — Level-colored ring around avatar | display name | level pill with emoji | streak badge (fire icon)
- **Bio card** — Bio text + home route (pink MapPin)
- **Stats row** — Followers | Following | Points | Streak (divided by borders)
- **Menu card:**
  - Notifications (with unread count badge)
  - Settings
  - Privacy
  - Help & Support
- **Footer** — Troski v1.0.0 | Troski Technologies | Accra, Ghana

---

## Report Screens

All presented as modals from the stack navigator.

### Fare Report (`app/report/fare.tsx`)
- From/To location autocomplete
- Fare amount (numeric)
- Transport type toggle: Trotro / Okada
- Region auto-detect or manual
- Submit → award points → confetti → store review prompt (at 3/15/50 reports)

### Queue Report (`app/report/queue.tsx`)
- Station autocomplete search
- Queue level: Empty 😊 | Short 🙂 | Moderate 😐 | Long 😫
- Optional: vehicle count (0, 1-2, 3-5, 5-10, 10+)
- Optional: wait time estimate (< 5 min → 30+ min)

### Incident Report (`app/report/incident.tsx`)
- Location picker (autocomplete)
- Type: Traffic 🚗 | Accident ⚠️ | Police 👮 | Roadwork 🚧
- Optional description

### Photo/Tale Report (`app/report/photo.tsx`)
- Image carousel: camera + gallery (up to 10 images)
- OR single video (max 60 sec) with thumbnail
- Caption text
- Location autocomplete
- Upload progress bar

### Train Report (`app/report/train.tsx`)
- Train line selection
- Station and timing details
- Similar structure to fare report

**Post-submit flow (all reports):** Award points → refresh profile → confetti celebration → optional store review prompt

---

## Route Detail

**File:** `app/routes/[id].tsx` | **Route:** `/routes/[id]`

### Hero Section
- Region-specific background image + gradient overlay
- From → To title
- Large amber fare display
- Fare stats: "Last updated 2h ago" | report count
- Min–max fare range

### Badges & Warnings
- GPRTU verified badge (green shield + date)
- Overcharge warning (if avg fare > official fare × 1.2)

### Tabs
1. **Details** — Traffic condition (light/moderate/heavy/severe), busyness meter, SOS button, trip share button
2. **Fare Trend** — SVG line chart with 7/14/30-day toggles, min/max/avg bands
3. **Reports** — Recent fare reports list

### Features
- Pull-to-refresh
- "Start Trip" button → GO Mode

---

## Train Pages

### Train Index (`app/train/index.tsx`)
- Lists train lines (TMA: Tema–Accra, TMP: Tema–Mpakadan)
- Each card shows: origin → destination | next departure time | progress indicator
- Live status: Waiting / In-transit / No service
- GRDA badge (Ghana Railway Development Authority)
- Expandable full schedule with all stops

### Train Line Detail (`app/train/[lineId].tsx`)
- Full line details and schedule visualization
- Tappable stations that expand to show station-specific reports
- "Start Trip" button → GO Mode with train params

---

## GO Mode (Trip Tracking)

**File:** `app/trip/[routeId].tsx` | **Route:** `/trip/[routeId]?type=train&lineId=...`

### Map View
- Full-screen map with user location dot
- Vehicle marker icon (TrotroTopDown / TrainTopDown / MotoTopDown) based on transport type
- Route polyline overlay

### Station List
- Collapsible list: origin → intermediate stops → destination
- Progress bar (0–100%)
- Current station highlight

### Trip States
1. **Start** — Location permission check → begin tracking
2. **Active** — Background tracking (expo-location, 15s intervals, 100m distance)
3. **Approaching** — Alert when <1km from destination
4. **Arrived** — End trip prompt + fare collection

### Trip Completion
- Optional fare input
- Points awarded: 5 base + 3 fare bonus = 8 max
- Trip saved to `completed_trips` table (coordinates, duration, distance, fare, stations)
- Reward popup with confetti

### Background Service
- Task: `TROSKI_TRIP_TRACKING` via expo-task-manager
- Foreground notification: "Troski GO Mode" (amber color)
- Persists active trip in AsyncStorage (survives cold start)

---

## Stations Map

**File:** `app/stations/index.tsx` | **Route:** `/stations`

- Full-screen Mapbox
- Layer toggles: Trotro Stops | Train Stops | Transport Routes
- Station markers colored by queue status
- Bottom sheet: StationBottomSheet with sort tabs (Nearest | Shortest Wait)
- Search filter
- RouteInfoCard overlay on station tap

---

## Leaderboard

**File:** `app/leaderboard.tsx` | **Route:** `/leaderboard`

- GlassBackButton header
- "Weekly Leaderboard" title + "Your rank: #X"
- FlatList of all ranked users:
  - Rank display (🥇🥈🥉 for top 3, #N for rest)
  - Avatar + name + level
  - Points (right-aligned)
  - Highlighted row if current user (amber bg)
- Pull-to-refresh, infinite scroll

---

## Notifications

**File:** `app/notifications/index.tsx` | **Route:** `/notifications`

### Notification Types
| Type | Icon Color | Trigger |
|------|-----------|---------|
| Fare Drop | Amber | Fare drops >15% below avg on favorited route |
| Queue Alert | Violet | Long/very long queue on favorited route |
| Streak Risk | Orange | 20–48hrs since last report |
| Level Up | Green | New level reached |
| Badge Earned | Purple | Achievement unlocked |
| Community | Blue | 5+ reports in last 24h on watched routes |

### UI
- FlatList with icon + title + body + time ago + unread dot
- Mark as read on tap
- "Mark all read" button
- Pull-to-refresh

---

## Settings & Legal

### Settings (`app/settings/index.tsx`)
- Theme selector: System | Light | Dark
- Notification toggle
- Camera permission toggle
- Privacy & Terms links
- Clear local data (with confirmation)

### Edit Name (`app/settings/edit-name.tsx`)
- TextInput for display name + save

### Edit Profile (`app/settings/edit-profile.tsx`)
- Bio text + home route selector + avatar upload

### Privacy (`app/privacy.tsx`) & Terms (`app/terms.tsx`)
- Scrollable legal text pages

---

## Social Features

### Public Profile (`app/profile/[deviceId].tsx`)
- Avatar + display name + level
- Follow button (if not own profile)
- Bio + home route
- Stats: followers, following, points, streak
- Recent activity/posts

### Followers/Following (`app/profile/followers.tsx`)
- Toggle tabs: Followers | Following
- User list with follow/unfollow buttons

---

## Reel (Video Viewer)

**File:** `app/reel.tsx` | **Route:** `/reel?postId=...&videoUrl=...`

- Full-screen modal with hidden status bar
- Blurred background + centered video player
- Controls: Play/Pause | Mute/Unmute | Progress bar
- Social actions: Like (❤️) | Comment | Share | Bookmark
- Display name + location + time (floating overlay)
- Gestures: tap to pause, swipe to close

---

## Driver Dashboard

**File:** `app/driver/index.tsx` | **Route:** `/driver` (Stub/Incomplete)

- Driver registration modal
- Trip logging
- Stats by period (today/week/month)
- Earnings display

---

## Onboarding Flow

**File:** `components/OnboardingFlow.tsx`

### Slides (2)
1. **Welcome** — Troski logo, 4 feature pills (Fares, Tales, Rewards, Live updates), orange→red gradient
2. **Notifications** — Animated bell, example alert cards, blue→purple gradient

### Features
- Horizontal FlatList with pagination
- Skip button (always visible)
- Dot indicators (active: 24px, inactive: 8px)
- Notification permission request with 3 states (idle → loading → granted/denied)
- Stored in AsyncStorage with version key (`troski_onboarding_complete`, version `2`)

---

## Components Library

### Core UI (51 components total)

| Component | Description |
|-----------|-------------|
| `GlassCard` | Frosted glass card (expo-blur with Android fallback) |
| `GlassView` | Semi-transparent glass overlay (92% opacity) |
| `GlassActionButton` | Rounded glass button (40px) |
| `GlassBackButton` | Glass-styled back navigation |
| `Skeleton` | Pulsing opacity skeleton loader |
| `OfflineBanner` | Offline status + pending report count |
| `NewUpdatesBanner` | Animated live update count badge |
| `StoreUpdateModal` | App update prompt with version check |
| `AppErrorBoundary` | React error boundary with retry |
| `TroskiSplash` | Animated launch splash with bouncing dots |
| `ExternalLink` | In-app browser wrapper (expo-web-browser) |

### Badge Components

| Component | Description |
|-----------|-------------|
| `GPRTUBadge` | Green GPRTU verification shield + date |
| `GRDABadge` | Blue GRDA official shield (train) |
| `ContributorBadge` | 3-tier: Reporter (3-9) / Trusted (10-49) / Top (50+) |
| `TrafficBadge` | Traffic condition (light/moderate/heavy/severe) |
| `WeatherBadge` | Weather icon + temperature (WMO codes, 30min cache) |

### Home Page Components

| Component | Description |
|-----------|-------------|
| `ServiceModePills` | Mode switcher: Trotro/Train/GO/Tales |
| `SmartCommuteCard` | Time-context card (Morning Rush/Afternoon/Evening) |
| `MyCommutesRow` | Saved commutes row with quick access |
| `MyCommuteWidget` | Frequently searched routes widget |
| `PopularRoutesScroller` | Auto-scrolling popular routes carousel |
| `PromoBanner` | Dismissible promo carousel |
| `NearbyLines` | Urban Pulse-styled nearby transit cards |
| `HappeningNow` | Live incidents/queue alerts |
| `MiniMap` | Mapbox mini-map with queue-colored dots |
| `UnifiedSearch` | Full-screen search modal (trotro + train) |

### Map & Station Components

| Component | Description |
|-----------|-------------|
| `MapMarkers` | Custom SVG markers (TrotroStation/TrainStation/QueueActive) |
| `RoutePlanMap` | Route plan with trotro/okada/walk legs |
| `RoutePlannerResults` | Multi-leg transfer plans with fare/duration |
| `StationCard` | Station with distance, queue bar, wait estimate |
| `StationBottomSheet` | Bottom sheet station list (sort: nearest/wait) |
| `QueueStatusBar` | 5-segment visual queue indicator |
| `SortTabs` | Nearest/Shortest Wait tab switcher |

### Feed & Media

| Component | Description |
|-----------|-------------|
| `ImageCarousel` | Swipeable image carousel |
| `VideoPlayer` | expo-video with controls + blur loading |
| `VehicleIcons` | Top-down SVG icons for GO Mode |
| `FareTrendChart` | SVG line chart (7/14/30-day periods) |
| `CommentSheet` | Modal for comments with nested replies |
| `ReactionBar` | Emoji reaction pills with counts |

### Engagement

| Component | Description |
|-----------|-------------|
| `ReportFAB` | 3x2 grid report menu (bottom-right FAB) |
| `ConfettiCelebration` | Animated confetti + reward card |
| `SpendingSummary` | Trip spending stats (total/avg/routes) |
| `ReferralCard` | M3 referral code card with copy/share |
| `ExploreGhana` | Region hero card carousel |
| `ServiceIcons` | Vibrant SVG mode icons with gradients |

### Social

| Component | Description |
|-----------|-------------|
| `InitialsAvatar` | Deterministic color avatar from initials |
| `UserRow` | Profile row with avatar, name, level, follow |
| `FollowButton` | Optimistic follow/unfollow toggle |
| `TripShareButton` | Share trip via token + SMS |
| `SOSButton` | Emergency contact button with setup modal |

---

## Hooks Library

### 35 hooks across categories:

#### Device & Identity
| Hook | Description |
|------|-------------|
| `useDeviceId` | Generate/store unique device ID |
| `usePushNotifications` | Register push + handle incoming |
| `useOnboarding` | Track onboarding completion |

#### Location & Tracking
| Hook | Description |
|------|-------------|
| `useLocation` | GPS permission + position + background watch |
| `useTrip` | GO Mode trip tracking + background task |
| `useTransportData` | OSM transport stops/routes (24h cache) |

#### Data Fetching
| Hook | Description |
|------|-------------|
| `useRoutes` | Fetch/filter routes with cache fallback |
| `useStations` | Stations + queue stats (2min auto-poll + Realtime) |
| `useRewards` | Profile, leaderboard, badges, points history |
| `useReports` | Submit reports + award points |
| `useActivity` | Activity feed with dismiss tracking |
| `useTales` | Tale posts with pagination + reactions |
| `useComments` | Comments + replies with optimistic add |
| `useTrain` | Train lines + stations + reports |
| `useTraffic` | Route traffic + busyness scoring |
| `useNotifications` | In-app notifications + read tracking |
| `usePublicProfile` | Public user profiles with follow status |

#### Search & Navigation
| Hook | Description |
|------|-------------|
| `useUnifiedSearch` | Multi-modal search (trotro + train + okada), 300ms debounce |
| `useSearchHistory` | Search history (20-entry limit, AsyncStorage) |
| `useSmartSuggestions` | Time-of-day + frequency route suggestions |
| `useRoutePlanner` | Multi-leg route planning (direct + transfers) |

#### Preferences & Favorites
| Hook | Description |
|------|-------------|
| `usePreferences` | Theme, notifications, privacy (AsyncStorage) |
| `useFavorites` | Favorite routes toggle (AsyncStorage) |
| `useMyCommutes` | Saved commute shortcuts with labels |
| `useRouteAlerts` | Route-specific alert toggles |
| `useCommuteAlerts` | Commute alerts via Supabase Realtime + local notifications |

#### Social
| Hook | Description |
|------|-------------|
| `useFollow` | Follow/unfollow with optimistic state |

#### App Lifecycle
| Hook | Description |
|------|-------------|
| `useAppUpdate` | Silent OTA check (expo-updates) |
| `useStoreUpdate` | App Store/Play Store version check (24h dismiss) |
| `useOfflineQueue` | Auto-process queued reports on reconnect |
| `useRefreshOnFocus` | Invalidate React Query caches on screen focus |
| `useHaptics` | Haptic feedback (light/medium/heavy) |
| `useStoreReview` | Store review prompt at 3/15/50 reports |
| `useSupabaseRealtime` | Generic Realtime subscription |

---

## Services Layer

### 18 services:

| Service | Description |
|---------|-------------|
| `reports.ts` | Submit fare/queue/incident reports + route auto-creation |
| `rewards.ts` | Profile CRUD + leaderboard + badges + points + level calculations |
| `routes.ts` | Fetch routes with fare stats + sorting |
| `stations.ts` | Stations + queue stats + wait estimate calculation |
| `tales.ts` | Tale posts CRUD + media upload (image/video) + reactions |
| `comments.ts` | Comments + nested replies |
| `activity.ts` | Activity feed (all report types + trips) |
| `train.ts` | Train lines + stations + reports + points |
| `trip.ts` | Trip progress (nearest station, distance, alerts, percent) |
| `trips.ts` | Save completed trips to Supabase |
| `route-planner.ts` | Multi-leg route planning (direct + transfer + fare/duration) |
| `traffic-api.ts` | Route traffic from PWA API + Supabase fallback |
| `transport-stops.ts` | OSM transport stops with bundled fallback |
| `offline-queue.ts` | Queue reports offline + auto-sync on reconnect |
| `offline-cache.ts` | Cache routes/stations to AsyncStorage (48h TTL) |
| `driver.ts` | Driver profile CRUD + trip history + earnings |
| `safety.ts` | Trip share tokens + emergency contacts |
| `notifications.ts` | Generate notifications (fare drops, queue alerts, streaks) |

---

## Theme & Design System

**File:** `lib/theme.ts`

### Color Palette (Tailwind-inspired)
- **Primary:** Amber (#f59e0b)
- **Neutrals:** Stone (50–950)
- **Accents:** Violet, Orange, Emerald, Red, Pink, Cyan

### Glassmorphism
| Mode | Background | Border | Blur |
|------|-----------|--------|------|
| Dark | `rgba(12,10,9,0.65)` | `rgba(255,255,255,0.08)` | 50–80 |
| Light | `rgba(250,250,249,0.55)` | `rgba(0,0,0,0.06)` | 50–80 |

### Font Family (Poppins)
- regular (400), medium (500), semibold (600), bold (700), extrabold (800), black (900)

### Helper
`themed(isDark)` returns dynamic color values: `bg`, `card`, `text`, `textSecondary`, `textTertiary`, `border`

### Pattern
All screens use: `const s = getStyles(isDark)` with `StyleSheet.create`

---

## Data & Constants

### Train Schedules (`lib/constants/train-schedule.ts`)

**TMA — Tema–Accra Commuter:**
- Fare: GH₵15 | Days: Mon–Sat | 8 stations
- Morning (S112): Community 1 → Accra Central (06:00–07:24)
- Evening (S117): Accra Central → Tema (17:40–19:14)

**TMP — Tema–Mpakadan:**
- Fare: GH₵40 (zoned) | Days: Mon–Sat | 9 stations | 97.3 km
- Morning (S315): Tema Harbour → Mpakadan (06:00–08:15)
- Evening (S316): Mpakadan → Tema (16:00–18:15)

### Rewards (`lib/constants/rewards.ts`)
- Point values: fare=10, queue=5, incident=15, train=10, tale=8
- Trip: 5 base + 3 fare bonus
- Streak: 7-day threshold → +5 bonus
- Levels: Passenger (0) → Regular (50) → Local Expert (200) → Troski Legend (500)

### Layout (`lib/constants/layout.ts`)
- Tab bar height: iOS 88px / Android 72px

### Tales (`lib/constants/tales.ts`)
- Reaction emojis: 👍❤️😂🚨💯👀

---

## Offline & Caching

### Offline Queue (`lib/services/offline-queue.ts`)
- Reports queued to AsyncStorage when offline
- Auto-processed when connectivity returns
- Pending count shown in OfflineBanner + AppContext

### Offline Cache (`lib/services/offline-cache.ts`)
- **Cached data:** Routes, popular routes, stations
- **TTL:** 48 hours
- **Storage:** AsyncStorage with timestamp tracking
- **Keys:** `@troski_cache_routes`, `@troski_cache_popular_routes`, `@troski_cache_stations`

### React Query
- `staleTime`: 2–30min depending on endpoint
- Auto-poll: 2min for stations (queue data freshness)
- Cache invalidation on screen focus via `useRefreshOnFocus`

---

## Notifications System

### Push Notifications
- expo-notifications with custom icon + amber color
- Token registered to Supabase on app launch
- Handles foreground + background notification receipt

### In-App Notifications (`lib/services/notifications.ts`)
Generated from Supabase data:
- **Fare drops** — >15% below average on favorited routes
- **Queue alerts** — Long queues on favorited routes
- **Streak risk** — 20–48hrs since last report
- **Level up / Badge earned** — Achievement notifications
- **Community** — 5+ reports in 24h on watched routes

### Commute Alerts (`lib/hooks/useCommuteAlerts.ts`)
- Supabase Realtime subscriptions on watched routes
- Local notifications for incidents/long queues
- 30-minute throttle to prevent spam

---

## Gamification & Rewards

### Point System
| Action | Points |
|--------|--------|
| Fare report | +10 |
| Queue report | +5 |
| Incident report | +15 |
| Train report | +10 |
| Share a tale | +8 |
| Complete GO trip | +5 |
| GO trip + fare | +8 |
| 7-day streak | +5 bonus |

### Levels
| Level | Points | Emoji | Color |
|-------|--------|-------|-------|
| Passenger | 0–49 | 🚶 | Gray |
| Regular | 50–199 | 🚌 | Blue |
| Local Expert | 200–499 | 📍 | Purple |
| Troski Legend | 500+ | 🏆 | Amber |

### Contributor Tiers
| Tier | Reports | Icon | Color |
|------|---------|------|-------|
| Reporter | 3–9 | Star | Amber |
| Trusted | 10–49 | Award | Violet |
| Top | 50+ | Flame | Orange |

### Badges
- Criteria types: count, streak, type, time, route
- Awarded automatically after each report
- Points bonus per badge

### Celebrations
- ConfettiCelebration modal after earning rewards
- Auto-dismiss: 3.5s normal, 5s special (level up/badges)
- Larger confetti burst (120 particles) for special events

### Store Review
- Prompted at 3rd, 15th, 50th report (one-time per threshold)
- Wired into all 5 report screens

---

## Permissions & Plugins

### Android Permissions
| Permission | Purpose |
|-----------|---------|
| CAMERA | Photo/video reports |
| INTERNET | API calls |
| ACCESS_FINE_LOCATION | GPS for nearby stations, GO Mode |
| ACCESS_COARSE_LOCATION | Approximate location |
| FOREGROUND_SERVICE | GO Mode background tracking |
| FOREGROUND_SERVICE_LOCATION | Location in background |

### Blocked (Google Play compliance)
- READ_MEDIA_IMAGES/VIDEO/AUDIO (blocked via config)
- READ_EXTERNAL_STORAGE has `maxSdkVersion="32"` (custom plugin fix for Expo SDK 54 bug)

### Plugins
- `expo-router`, `expo-secure-store`, `expo-font`, `expo-image-picker`
- `expo-notifications`, `expo-splash-screen`, `expo-video`
- `@rnmapbox/maps` (Mapbox), `expo-location`
- `./plugins/removeMediaPermissions` (must be last in array)

---

## Key Dependencies

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.1.0 | UI framework |
| react-native | 0.81.5 | Native runtime |
| expo | ~54.0 | Development platform |
| expo-router | ~6.0.23 | File-based routing |

### Data & State
| Package | Purpose |
|---------|---------|
| @supabase/supabase-js | Database + Realtime |
| @tanstack/react-query | Async state management |
| @react-native-async-storage/async-storage | Local persistence |
| expo-secure-store | Secure credential storage |

### Maps & Location
| Package | Purpose |
|---------|---------|
| @rnmapbox/maps | Mapbox GL maps |
| expo-location | GPS + background tracking |
| expo-task-manager | Background tasks (GO Mode) |

### UI & Animation
| Package | Purpose |
|---------|---------|
| @gorhom/bottom-sheet | Draggable bottom sheets |
| react-native-reanimated | Performant animations |
| react-native-gesture-handler | Touch gestures |
| expo-blur | Glassmorphism blur |
| expo-linear-gradient | Gradient backgrounds |
| lucide-react-native | Icon library |

### Media
| Package | Purpose |
|---------|---------|
| expo-image | Optimized images (disk cache) |
| expo-image-picker | Camera/gallery access |
| expo-video | Video playback |
| react-native-confetti-cannon | Celebration effects |

### Other
| Package | Purpose |
|---------|---------|
| expo-notifications | Push notifications |
| expo-haptics | Haptic feedback |
| expo-store-review | App store review prompts |
| expo-web-browser | In-app links |
| @react-native-community/netinfo | Network detection |

---

## Screen Count Summary

| Category | Count |
|----------|-------|
| Tab screens | 5 visible + 2 hidden |
| Report modals | 5 |
| Detail pages | 3 (route, train index, train line) |
| Trip/GO Mode | 1 |
| Map pages | 1 (stations) |
| Social pages | 3 (public profile, followers, leaderboard) |
| Settings pages | 3 (settings, edit name, edit profile) |
| Legal pages | 2 (privacy, terms) |
| Media pages | 1 (reel) |
| Notifications | 1 |
| Driver (stub) | 1 |
| **Total** | **~28 screens** |

---

*Last updated: March 2026*
*Business: Troski Technologies (BN299000326)*
*Domain: troski.me | Registrar: Porkbun*
