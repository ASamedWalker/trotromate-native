# Troski Wear OS App — Android Watch

## Overview
Real-time transit alerts on Wear OS (Samsung Galaxy Watch, Pixel Watch, etc.). Mirror of the Apple Watch app — commute status, queue alerts, fare updates on your wrist.

## Status: PLANNING COMPLETE (2026-04-16)

Apple Watch app is complete with 4 screens + 4 complications. Now building the Wear OS counterpart.

## Research Summary

### Key Constraint: Expo Managed Workflow Does NOT Support Wear OS
- No `@bacons/apple-targets` equivalent for Android — that plugin is iOS-only
- `react-native-wear-connectivity` requires bare workflow (no Expo config plugin exists)
- Must generate `android/` via `expo prebuild`, add Wear module manually, commit to git
- Lose some CNG benefits but gain full native Android control

### Technology Stack
| Component | Technology |
|---|---|
| UI Framework | Jetpack Compose for Wear OS (Kotlin) |
| Data Sync | Google Play Services: MessageClient + DataClient |
| Tiles (complications) | `androidx.wear.tiles` v1.6 |
| RN Bridge | `react-native-wear-connectivity` |
| Min API | API 30 (Wear OS 3.0) |
| Build | EAS Build (multi-module Android: phone + wear) |

### Data Sync: MessageClient vs DataClient
| Client | Use Case | Persistent? |
|---|---|---|
| **MessageClient** | Fire-and-forget (queue alerts, immediate updates) | No |
| **DataClient** | Synced state (commute route, fare, stations) | Yes — replicated across devices |
| **ChannelClient** | Large payloads, file transfers | No |

**Recommendation**: Use DataClient for commute/station data (persistent, like iOS App Group UserDefaults). Use MessageClient for alerts (ephemeral, like iOS sendMessage).

### Screen Shape Handling
- Round screens: 192×192dp (small), 227×227dp (large) — Galaxy Watch, Pixel Watch
- Square screens: 240×240dp — older devices
- Use `Modifier.fillMaxSize()` + Compose Wear layout adapters
- Test on both "Wear OS Small Round" and "Wear OS Large Round" emulators

---

## Architecture
```
Android Main App (Expo React Native)
    ↕ react-native-wear-connectivity (MessageClient / DataClient API)
Wear OS App (Jetpack Compose / Kotlin)
    ↕ Shared DataItems via Google Play Services
Wear OS Tiles (TileService)
```

---

## Phases

### Phase 1: Prebuild + Wear Module Setup
**Goal**: Generate native Android project, add Wear OS module, establish build pipeline.

- [ ] Run `expo prebuild --platform android --clean` to generate `android/`
- [ ] Open `android/` in Android Studio → File → New → Module → Wear OS
- [ ] Configure `android/settings.gradle` to include `:wear` module
- [ ] Add phone app dependency: `wearApp project(':wear')` in `android/app/build.gradle`
- [ ] Add Wear OS dependencies to `wear/build.gradle.kts`:
  ```kotlin
  // Core Compose for Wear
  implementation("androidx.wear.compose:compose-foundation:1.5.x")
  implementation("androidx.wear.compose:compose-material:1.5.x")
  implementation("androidx.wear.compose:compose-navigation:1.5.x")
  // Horologist (Google's Wear helper library)
  implementation("com.google.android.horologist:horologist-compose-layout:x.x.x")
  // Tiles
  implementation("androidx.wear.tiles:tiles:1.6.x")
  implementation("androidx.wear.protolayout:protolayout-material:1.x")
  ```
- [ ] Add `AndroidManifest.xml` for Wear module with hardware features:
  ```xml
  <uses-feature android:name="android.hardware.type.watch" />
  ```
- [ ] Install `react-native-wear-connectivity`: `npm install react-native-wear-connectivity`
- [ ] Create custom Expo config plugin to inject Wear permissions into phone app manifest
- [ ] Commit `android/` directory to git
- [ ] Verify EAS build compiles both phone + wear modules
- [ ] Test on Wear OS emulator (API 30+, Small Round)

### Phase 2: Data Bridge (Phone ↔ Watch)
**Goal**: Establish bidirectional data sync between React Native and Wear OS.

- [ ] Update `lib/watchSync.ts` to support Android via `react-native-wear-connectivity`:
  ```typescript
  if (Platform.OS === 'android') {
    const { sendMessage } = require('react-native-wear-connectivity');
    // Same API: syncCommuteToWatch(), syncStationsToWatch(), sendAlertToWatch()
  }
  ```
- [ ] Implement `WearDataSync.kt` in Wear module:
  - DataClient listener for commute/station data (persistent sync)
  - MessageClient listener for alert pushes (ephemeral)
  - Write received data to local DataStore for Tiles access
- [ ] Test data flow: phone sends commute → watch receives and displays
- [ ] Test alert flow: phone sends alert → watch shows notification

### Phase 3: Wear OS UI (Jetpack Compose)
**Goal**: Build all 4 screens matching the Apple Watch app design.

#### Screen 1: Commute Summary (Home)
- [ ] "Your morning commute" greeting (time-of-day aware)
- [ ] Route: Circle → Madina
- [ ] Fare: GH₵8.50 (large, amber)
- [ ] Queue status dot (green/amber/orange/red) + label + wait time
- [ ] "Leave by 6:45 AM" smart suggestion based on queue
- [ ] "Updated 3 min ago" freshness with auto-refresh

#### Screen 2: Station List
- [ ] "TROSKI / NEARBY HUBS" header
- [ ] Scrollable list with colored left borders per queue status
- [ ] Red = Long, Green/Mint = Clear, Amber = Moderate, Stone = No data
- [ ] Station name, status emoji + label, wait time, fare
- [ ] Distant stations at 60% opacity with timer icon
- [ ] Tap → navigates to Station Detail

#### Screen 3: Station Detail
- [ ] Station name (large)
- [ ] Queue status badge (large, colored circle)
- [ ] Wait time + fare info rows
- [ ] "Report Queue" button → opens phone app via MessageClient

#### Screen 4: Alert Screen
- [ ] Triggered on very_long queue
- [ ] "🔥 Circle: Very Long Queue" headline
- [ ] "Consider Kaneshie — shorter queue right now" suggestion
- [ ] "Navigate" button → opens Google Maps (`geo:` intent)
- [ ] "Dismiss" button → clears alert
- [ ] Kinetic amber/red glow background effect

#### Design Tokens (matching Apple Watch)
- [ ] Create `TroskiWearTheme.kt` with color palette:
  - Background: #100e0d, Primary: #ffad3a, Error: #ff716a, Tertiary: #9bffce
  - Queue: #22c55e (short), #f59e0b (moderate), #f97316 (long), #ef4444 (veryLong)
  - Surface: #1c1918 (0.7 opacity), Muted: #afaaa8, Border: #4b4746
- [ ] Typography: system fonts with matching sizes (Compose doesn't bundle custom fonts easily on Wear)

### Phase 4: Wear OS Tiles
**Goal**: Glanceable transit data on the watch face without opening the app.

- [ ] Create `TroskiTileService.kt` extending `TileService`
- [ ] **Large Tile**: route + fare + queue status + wait time (equivalent of rectangular complication)
- [ ] **Small Tile**: queue dot + fare (equivalent of circular complication)
- [ ] Read data from local DataStore (written by WearDataSync)
- [ ] Tile refresh: request update when DataClient receives new data
- [ ] Register TileService in AndroidManifest.xml

### Phase 5: Testing & Deployment
**Goal**: Test on emulators + physical devices, ship via EAS + Google Play.

- [ ] Test all 4 screens on Wear OS Small Round emulator (API 30+)
- [ ] Test all 4 screens on Wear OS Large Round emulator
- [ ] Test data sync: phone ↔ watch (message + data client)
- [ ] Test Tiles on watch face
- [ ] EAS production build: `npx eas-cli build --platform android --profile production --clear-cache`
- [ ] Deploy to Google Play: mark as watch-compatible
- [ ] Test on physical Samsung Galaxy Watch or Pixel Watch (if available)

---

## Folder Structure
```
targets/TroskiWear/
├── src/main/
│   ├── java/com/troski/wear/
│   │   ├── MainActivity.kt          ← Compose Activity entry point
│   │   ├── presentation/
│   │   │   ├── CommuteScreen.kt     ← Screen 1: Commute Summary
│   │   │   ├── StationListScreen.kt ← Screen 2: Station List
│   │   │   ├── StationDetailScreen.kt ← Screen 3: Station Detail
│   │   │   └── AlertScreen.kt       ← Screen 4: Alert
│   │   ├── data/
│   │   │   └── WearDataSync.kt      ← DataClient + MessageClient bridge
│   │   ├── tile/
│   │   │   └── TroskiTileService.kt ← Wear OS Tiles
│   │   └── theme/
│   │       └── TroskiWearTheme.kt   ← Colors, typography tokens
│   ├── res/
│   │   ├── values/colors.xml
│   │   └── drawable/
│   └── AndroidManifest.xml
├── build.gradle.kts
└── PLAN.md
```

---

## Dependencies to Add
```bash
# Phone app (React Native)
npm install react-native-wear-connectivity

# Wear module (Kotlin/Gradle) — added in wear/build.gradle.kts
# androidx.wear.compose:compose-foundation
# androidx.wear.compose:compose-material
# androidx.wear.compose:compose-navigation
# com.google.android.horologist:horologist-compose-layout
# androidx.wear.tiles:tiles
# androidx.wear.protolayout:protolayout-material
# com.google.android.gms:play-services-wearable
```

## Build Commands
```bash
# Generate native Android project (one-time)
npx expo prebuild --platform android --clean

# Local development
npx expo run:android

# EAS production build (includes phone + wear APK)
npx eas-cli build --platform android --profile production --clear-cache
```

## Design Reference
See `targets/TroskiWatch/DESIGN.md` for full visual specs. Both platforms share:
- Same color palette, queue status colors, typography sizes
- Dark mode only
- Kinetic glow effects (amber top, red bottom)
- Gradient buttons (red→amber) and outline buttons

## Version
Ship with v1.1.3 alongside Apple Watch. Both platforms aligned.
