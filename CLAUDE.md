# Troski Native App — Claude Context

## What is Troski
Ghana's mobility super app — crowdsourced transit info, ticketing, ride-hailing for trotro (minibus), okada (motorcycle), pragya (tuk-tuk), train. Built by TROSKI TECHNOLOGIES (BN299000326).

## Tech Stack
- **Expo SDK 54** + React Native + expo-router (file-based routing)
- **Supabase** backend (Postgres, Auth with phone OTP, Realtime, RLS)
- **Mapbox** (`@rnmapbox/maps`) — custom style `mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31`
- **Font**: Plus Jakarta Sans (was Poppins — fully replaced)
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
| Secondary text | #9CA3AF |
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
| Tales | `(tabs)/tales.tsx` | Community photo feed |
| Rewards | `(tabs)/rewards.tsx` | Leaderboard, earn points |

Profile accessible via header avatar (no Profile tab).

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
    • Bank Transfer → wallet/bank-transfer (Select Bank picker → account no + Copy + note)  [FE only]
    • MTN MoMo      → wallet/momo (amount + MoMo number + network + Fund)                   [LIVE backend]
    • Add Debit Card → "Coming soon" alert                                                  [no screen yet]
```
- `wallet/momo.tsx` is the ONLY method wired to the backend (`POST /api/wallet/topup`).
- `wallet/bank-transfer.tsx` is front-end only: static partner-bank list + placeholder
  Troski virtual account numbers, Copy via expo-clipboard. **FOLLOW-UP**: backend must
  issue real per-user virtual accounts + reconcile inbound transfers (GH₵ 0.25 charge,
  ~2 min reflect). Debit Card needs a card-tokenization/PSP integration before building.

## Next Up (as of June 2026)
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
- Buses Nearby quick action screen
- Queue Status quick action screen
- Booking system
- Apply Uber Base tokens to Lines, Wallet, Tales, Rewards tabs
- **Bus arrival notifications** (route detail timeline bell — currently UI stub).
  Gated on real driver GPS data. Build order:
  1. iOS Live Activity / Android ongoing notification (reuse `lib/services/liveActivity.ts`) — watch bus ETA on lock screen without opening the app
  2. Push "approaching" alert — bell registers a watch (bus + stop); backend sends push when near (`usePushNotifications` already registers tokens)
  3. WhatsApp alert — backend (WhatsApp Business API / Twilio) using the user's auth phone number