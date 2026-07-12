# Troski Native App — Claude Context

## What is Troski
Ghana's mobility super app — crowdsourced transit info, ticketing, ride-hailing for trotro (minibus), okada (motorcycle), pragya (tuk-tuk), train. Built by TROSKI TECHNOLOGIES (BN299000326).

## Tech Stack
- **Expo SDK 54** + React Native + expo-router (file-based routing)
- **Supabase** backend (Postgres, Auth with phone OTP, Realtime, RLS)
- **Mapbox** (`@rnmapbox/maps`) — custom style `mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31`
- **Font**: Baloo 2 (June 2026; was Jakarta, before that Poppins). Tokens = `font.*` from `lib/theme.ts` — never hardcode family names.
  **lineHeight RULE**: Baloo 2's natural box is 1.6em and RN bottom-anchors clamped lines, so any explicit `lineHeight` < 1.3× fontSize slices glyph tops (1.13× is the floor for digits/ALL-CAPS-only text). When in doubt omit lineHeight. For display-size text (≥20px) use `components/HeroText.tsx` — safe metrics are baked in there; never hand-set fontSize+lineHeight pairs for big Baloo text. Styles with `fontWeight` but no `fontFamily` render the SYSTEM font, not Baloo (register/auth/onboarding titles still do — intentional until those screens get a pass).
- **Icons**: Lucide React Native
- **Bottom sheets**: `@gorhom/bottom-sheet`
- **Animations**: `react-native-reanimated` (but NOT Animated.View inside ScrollView on Android — causes width bugs)

## Design System — Uber Base Tokens
ALL screens must follow these tokens:

| Token | Value |
|-------|-------|
| Horizontal padding | 24px |
| Section spacing | 28px |
| Card shadow | `0 4px 16px rgba(0,0,0,0.12)` / elevation 4 |
| Card radius | 16px (lg), 12px (md), 20px (xl) |
| Button height | 48px standard, 56px large |
| Button radius | 12px |
| Section title | 24px bold, -0.5 letter-spacing |
| Body text | 16px regular |
| Labels | 14px medium |
| Primary text | #000000 |
| Secondary text | #6B7280 |
| Background | #FAFAF9 |
| Cards | #FFFFFF |
| Brand accent | #FF4D1C (orange) |

Source: https://base.uber.com/6d2425e9f/p/93825b-welcome-to-base

## Dark Mode
DISABLED globally. Light only. `Appearance.setColorScheme('light')` in `_layout.tsx`. Settings toggle is no-op. Prefs key = `@troski_preferences_v2`.

## Tab Structure (5 tabs — floating pill nav)
| Tab | File | Content |
|-----|------|---------|
| Home | `(tabs)/index.tsx` | Greeting, wallet card, services, my routes |
| Lines | `(tabs)/lines.tsx` | Routes + Train merged with segment toggle |
| Wallet | `(tabs)/wallet.tsx` | Balance, transactions, MoMo top-up |
| Pulse | `(tabs)/tales.tsx` | Community feed (Instagram-style). Radio/broadcast icon |
| Rewards | `(tabs)/rewards.tsx` | Coins / Earn / History / Referrals sub-tabs |

Profile accessible via header avatar (no Profile tab).

## Pulse (was "Tales")
Renamed **user-facing only** (June 2026): tab label, feed empty state, composer
button ("Post to Pulse"), profile stat, reel badge, notification labels.
**Internal code + ALL backend identifiers are still `tale*`** on purpose — table
`tale_posts`, `report_type: 'tale'`, notification pref keys (`tale_likes` etc.),
hooks (`useTalesFeed`), types (`TalePost`), `components/TalesScreen.tsx`,
`lib/hooks/useTales.ts`, `lib/services/tales.ts`. Renaming those would break the
live Supabase backend for zero user benefit. Composer header intentionally keeps
"Trotro Tales" (matches Figma). Don't "fix" the internal tale naming.

## Rewards (4 sub-tabs, June 2026 — game-feel + Transit-style recognition)
`(tabs)/rewards.tsx` — segmented Coins / Earn / History / Referrals (brand pills).
**DELIBERATE DECISION (owner, June 2026): NO money/cash framing on this screen.**
Coins are recognition + tier progress only (modeled on Transit app's GO/Royale:
civic impact, leaderboards, status — not payment). GH₵ equivalence, COIN_TO_GHS
and the Cash Out stub were REMOVED — do not reintroduce without owner say-so.
- **Coins**: speedometer gauge (`react-native-svg`) — count-up + arc sweep + gold
  TroskiCoin marker riding the arc + ticks that light up; scale = REAL tier bounds
  from `LEVELS` (`lib/constants/rewards.ts`, shared w/ leaderboard; passenger emoji
  is 🎫). Tier pill, Tier Journey strip (current node bounces), Community Impact
  card (`total_reports`), View Leaderboard CTA, stats Today/Streak/Rank.
- **Earn**: gradient Daily Streak card — week anchored to actual weekday via
  `last_report_date`; earned days show coins; "streak on the line" urgency; real
  `STREAK_CONFIG` bonus. Missions = 2-col emoji grid (real `REPORT_POINTS`).
- **History**: Total Coins card + This Month/Redeemed + grouped `points_history`.
- **Referrals**: `referral_code`/`referral_count`, How-it-works steps,
  `REFERRAL_POINTS` (=500) constant, spinning-orbit gift graphic.
- `components/TroskiCoin.tsx` = gold "T" coin SVG (reused across tabs).
- Anims: core RN `Animated` ONLY (Bob/Spin in rewards.tsx) — reanimated is banned
  inside ScrollView on Android. Confetti (`react-native-confetti-cannon`) fires
  once per tier-up / 7-day streak via AsyncStorage `@troski_rewards_celebrated_v1`.
- `components/ReferralCard.tsx` is unused (logic inlined into the Referrals tab).

## GO Mode — Trip Tracking (June 2026)
The moat feature (docs/DESIGN_DIRECTION.md): live in-ride companion for trotro
AND train, built on Transit's GO model.
- **Engine**: `lib/hooks/useTrip.ts` is a MODULE-LEVEL SINGLETON store
  (useSyncExternalStore) — never per-component state; multiple consumers
  (trip screen, ExploreMap) share one watcher/one tripState. Poll fallback
  every 8s because iOS CoreLocation silently pauses "stationary" foreground
  watchers. 'arrived' state is STICKY (never downgrade — deadlocks auto-end).
- **Entries**: booking receipt asks "Keep track of your ride?" (Track live /
  Data Saver / Not now) — tracking is ALWAYS the rider's explicit choice (data
  costs money in Ghana). NOTE (owner, 2026-06-12): GO Mode must NOT appear on
  the route pages — the "Start GO Mode" CTA was removed from routes/[id].tsx.
  Do not reintroduce a GO entry on routes/[id] or routes/detail.
- **Data Saver**: skips the Mapbox map entirely (tiles = the data cost),
  lite backdrop + sheet carries all progress; "Saver" chip in trip header
  toggles. Pass `dataSaver=1` param to /trip/[routeId].
- **Alight picker**: trotro corridors slice origin→chosen stop ("Where will
  you alight?"); get-off alarm = local notification at 300m threshold.
- **Position broadcast**: while GO active, `gps:trip:{routeId}` Realtime
  BROADCAST (no DB writes) every 10s with anonymous tripKey. Consumers:
  `useLiveTripPositions(routeId)` → live dots on routes/detail.tsx map +
  "N trotros live" pill + Live Trotros row on routes/[id].
  **Channels MUST go through `lib/services/tripChannel.ts`** (ref-counted,
  one channel per topic per client) — two channels on one topic on one
  socket kill each other's subscription on removeChannel.
- **Arrival handoff**: completed trips → /booking/arrived with real
  distance/duration/stops params; GO rides hide the driver card and rate
  the LINE, never an individual mate.
- Post-trip fare prompt (GH₵, +5/+8 pts) feeds `fare_reports` WITH
  `reporter_id` (uuid col; deviceId is undashed hex — Postgres accepts it,
  returns it dashed; normalize when joining contributor_profiles).

## Train Section (June 2026; positioning updated 2026-07-11)
`app/train/index.tsx` (now its OWN top-level tab — Home·Lines·Train·Wallet·Pulse)
+ `app/train/[lineId].tsx`. (Was a segment inside Lines; promoted after Search
Console showed train = top organic demand. Rewards left the tab bar → Home coins
chip + profile row.)

**⚠️ TRAIN = INFORMATION ONLY (owner, 2026-07-11). NO booking, NO ticketing, NO
payment/wallet debit for train — do NOT build any.** Goal: be Ghana's #1 go-to app
for TRAIN INFORMATION (schedules, fares, stations, live departures, reminders).
Train booking/ticketing is deferred until a **GRDA partnership** exists; only then
revisit an in-app train booking flow. Until then every train surface (native tab +
web troski.me/train + per-line pages) stays purely informational — no "book",
"buy ticket", or checkout affordance. Fares shown are GRDA's official prices for
reference (paid at the station via TapnGo), not something the app sells.

- **Departure board**: dark "station display" with flip-style countdown to the
  next departure across all lines. States: waiting (countdown) / in-transit
  (progress) / no-service. **No-service renders only on SUNDAY** (all schedules
  are `'Mon – Sat'`, `hasNoSunday`) — see `computeLineDeparture`. Saturday is
  always a service day. Schedules live in `lib/constants/train-schedule.ts`.
- **Departure reminders (NEW)**: `lib/services/trainReminders.ts` +
  `useDepartureReminders` hook. Fires a local notification
  `REMINDER_LEAD_MINUTES` (15) before departure via `scheduleNotificationAsync`
  TIME_INTERVAL trigger seeded from the live board countdown (so it matches what
  ticks). Persisted in AsyncStorage `@troski_train_reminders_v1` (pruned on
  read). UI: "Remind me 15 min before" button in the board waiting state +
  a bell toggle on each waiting line card (replaced the old duplicate MapPin→
  detail icon). Toggle = arm/cancel. Hidden when no waiting departure or the
  next one is inside the 15-min lead. NOT runtime tap-tested yet — sim clock
  was on a Sunday (UTC day 0) so no waiting state surfaced; static checks pass.
- **Train UI backlog (my audit, owner asked for perspective 2026-06-13)** —
  remaining, in value order: (1) honest live status — board/timeline show fake
  green "ON TIME"/"LIVE SERVICE" even with no data + 4-month-old reports; show
  "Scheduled" + report age; (2) animate the `FlipDigit` (named flip, renders a
  static Text); (3) currency consistency — `₵15`/`GHS 15.00`/`₵14.00` all
  appear, route through the currency util (GH₵ rule); (4) replace foreign
  Unsplash hero photos in `[lineId].tsx` (mock data); (5) detail has no primary
  action (read-only) — reminder helps but consider ticket/notify; (6) two
  identical "Official Timetable" headers — title by direction; (7) "Train
  Index" → "Trains".

## Route Detail Flow (June 2026)
```
Home → "Where to?" → routes/search.tsx (Plan a Trip)
  → Select from/to stations → auto-search (1.2s debounce)
  → Tap route card → routes/detail.tsx (full screen map)
    Sheet 1: Transport picker (Trotro/Okada/Pragya) + Go Now
    Sheet 2: Available Buses (search by code, driver, ETA)
    Sheet 3: Bus stop timeline (letter badges, bus position, notification bell)
```

## Map Features (routes/detail.tsx)
- Full-screen Mapbox with custom style
- Road-following route line via Mapbox Directions API (driving profile)
- 3-layer line: shadow + outline + core (black)
- 3D building extrusions at zoom 14+
- Traffic overlay (Mapbox raster tiles)
- Animated route draw (lineTrimOffset, 1.5s cubic easing)
- Pulsing origin marker (green, breathing animation)
- Smooth camera fly-in (zoom to origin → fit bounds)
- Origin/destination circle markers with labels

## Service Icons (Premium 3D PNGs)
Located in `assets/images/home/`:
- `bus_icon_bg_removed.png` — Ghana flag bus
- `okada_icon_bg_removed.png` — motorcycle
- `bullet_train_flip.png` — yellow bullet train (old: `train_bg_removed.png`)
- `Pragya_icon_bg_removed.png` — tuk-tuk
- `van_bg_removed.png` — delivery van
All transparent bg, ~1254px source, rendered at 48-68px.

## Real Data Sources
- **Stations**: 295 entries in `lib/utils/station-coords.ts` (OSM verified coordinates)
- **Routes**: `routes` table — `from_location` → `to_location` corridor pairs (NOT individual stations)
- **Fares**: `route_fare_stats` view — crowdsourced avg/min/max
- **Traffic**: `fetchRouteTraffic(routeId)` → `/api/traffic/{routeId}`
- **Vehicles**: `useVehiclePositions(routeId)` → `vehicle_positions` table (60s refresh)
- **GPS**: `useRealtimeVehicle` → Supabase Realtime `gps:van:{vanId}` (10s updates)

## Android-Specific Bugs
- **NEVER** use `Animated.View` from reanimated inside `ScrollView` — breaks width on Android. Use plain `<View>` with inline styles.
- **NEVER** use `presentation: 'formSheet'` — crashes Android on Expo SDK 54
- **NEVER** nest `@gorhom/bottom-sheet` inside another BottomSheet

## Deployment
- OTA on Windows: deploy iOS and Android SEPARATELY (`--platform ios` then `--platform android`)
- Use `CI=1` env var for eas-cli
- ALWAYS preview first, NEVER production unless explicitly told
- Android PROD = runtimeVersion 1.1.0, everything else = 1.1.1

## Quality Standards
- Research before coding (Golden Standard rule #1)
- International quality bar (Uber/Bolt/Grab level)
- No mock data in production screens — use real Supabase data or proper empty states
- System keyboard over custom keypads (platform conventions)
- No custom back buttons — rely on system gestures

## Wallet Top-Up Flow (June 2026)
```
Home "Topup Wallet" / Wallet "Add Money" → wallet/fund (Top Up Wallet)
  → "Choose mode of payment" selector (radio + Proceed):
    • Bank Transfer    → wallet/bank-transfer (Select Bank picker → account no + Copy + note)  [FE only]
    • MTN MoMo         → wallet/momo?provider=mtn                                              [LIVE backend]
    • AirtelTigo Money → wallet/momo?provider=atl                                              [LIVE backend]
    • Telecel Cash     → wallet/momo?provider=tgo                                              [LIVE backend]
    • Add Debit Card   → "Coming soon" alert                                                   [no screen yet]
```
- `wallet/momo.tsx` is the ONLY method wired to the backend (`POST /api/wallet/topup`).
  Reads `?provider=mtn|atl|tgo` to pre-select the network + set the header; user can still
  switch via the in-screen Network picker. All amounts in GH₵.
- Top-up animation: on Fund, `components/WalletTopUpAnimation.tsx` shows a "money
  dropping into a wallet" overlay (RN `Animated` — gold ₵ coins fall into the brand
  wallet; success → green check + "Approve on your phone" + Done). Built WITHOUT
  `lottie-react-native` on purpose (it's a native dep = dev-client rebuild). **To make
  it a real Lottie**: `npx expo install lottie-react-native`, rebuild the dev client,
  drop a branded JSON in `assets/lottie/`, swap the coins/wallet block for `<LottieView>`.
- Post-top-up destination: success "View Wallet" → `router.dismissAll()` + `navigate('/wallet')`,
  landing on the Wallet tab (refetches on focus, so balance + `topup` tx appear once approved).
  **FOLLOW-UP (no instant confirmation today)**: MoMo funds clear async after the user approves
  the USSD prompt — there's no in-app callback. For a true "GH₵ X added ✓" moment, add a
  backend webhook (MoMo provider → server → Realtime balance update / `usePushNotifications`
  push), then show a confirmation toast/state in-app. Until then the Wallet tab is the source of truth.
- MoMo number prefill is normalised to a clean local number (`replace(/\D/g,'')` then
  strip `233`/leading `0`) so the field stays under `maxLength={10}` and editable — the
  old `replace('+233','')` left a 12-digit value that the input silently rejected.
- Network branding: `components/NetworkLogo.tsx` renders brand-accurate wordmark badges
  (MTN black-on-yellow, AT red→blue gradient, Telecel white-on-red) from official colours —
  NOT bundled logo art (trademark-safe, scalable). Swap for official vector/PNG here if
  brand-approved assets arrive. Used in the top-up selector + MoMo network picker.
- `wallet/bank-transfer.tsx` is front-end only: static partner-bank list + placeholder
  Troski virtual account numbers, Copy via expo-clipboard. **FOLLOW-UP**: backend must
  issue real per-user virtual accounts + reconcile inbound transfers (GH₵ 0.25 charge,
  ~2 min reflect). Debit Card needs a card-tokenization/PSP integration before building.

## Next Up (updated 2026-06-13 — after GO Mode/trust-loop sprints)
Top of queue (in value order):
1. **Rating persistence — CODE DONE (2026-06-12), MIGRATION PENDING**: run
   `lib/supabase/migrations/051_ride_ratings.sql` in the Supabase SQL editor
   (anon key can't do DDL). Client degrades gracefully until then. Pieces:
   `ride_ratings` table + `route_rating_stats` view; `lib/services/ratings.ts`;
   arrived.tsx saves stars+tags on Done (GO passes `routeId`; booking demo
   saves with null route); Lines cards + route detail show `★ avg (count)`.
2. **AutoTroski boarding detection** — one-tap "On this trotro?" prompt
   (Transit AutoGO pattern; 1M+ trips started via their version)
3. Backend asks (other repo): real bus/driver data via the **Trotro Pro** driver
   app (Confirm Booking + scan still show mock driver/bus — see
   `docs/DEFERRED_BACKLOG.md`); fix off-corridor station geocodes in Supabase
   (e.g. "Asofan New Station" sits ~3.5km off the road). [Booking backend
   (debit/ticket) + MoMo top-up push are DONE.]

Original list (still valid):
- **Scan to Pay — live camera (FOLLOW-UP)**. UI flow is DONE (`app/scan/`):
  Home "Scan To Pay" -> scan/index (Pay with QR) -> scan/confirm (Bus Details +
  payment) -> scan/pin (6-box PIN + keypad) -> reuses booking/processing -> receipt.
  The QR scan frame is a PLACEHOLDER; the manual "Input Bus Code" path works.
  To finish the camera:
  1. `npx expo install expo-camera`
  2. Add camera permission (NSCameraUsageDescription) in app.config.js
  3. In scan/index.tsx, replace the ScanFrame placeholder with `CameraView` +
     `onBarcodeScanned` (qr) -> router.push('/scan/confirm', { code })
  4. Native rebuild required: `CI=1 npx expo run:ios` (~10-15 min)
  Minor polish: scan-pay success reuses booking receipt "Booking Successful" —
  could parametrize to "Payment Successful" for this flow.
- Apply Uber Base tokens to Lines tab (Wallet, Pulse, Rewards done)
- **Bus arrival notifications** (route detail timeline bell — currently UI stub).
  Gated on real driver GPS data. Build order:
  1. iOS Live Activity / Android ongoing notification (reuse `lib/services/liveActivity.ts`) — watch bus ETA on lock screen without opening the app
  2. Push "approaching" alert — bell registers a watch (bus + stop); backend sends push when near (`usePushNotifications` already registers tokens)
  3. WhatsApp alert — backend (WhatsApp Business API / Twilio) using the user's auth phone number