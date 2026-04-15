# Troski Watch App — Apple Watch + Wear OS

## Overview
Real-time transit alerts on your wrist. Queue status, fare updates, commute notifications — without pulling out your phone. First transit Watch app in Africa for informal transport.

## Phase 1: Apple Watch ✅ COMPLETE (2026-04-14)

### What was done
- Installed `@bacons/apple-targets@^4.0.6` and `react-native-watch-connectivity@^2.0.0`
- Created all SwiftUI files under `targets/TroskiWatch/`
- Registered `@bacons/apple-targets` plugin in `app.config.js` (bundleId: `com.troski.app.watchkitapp`, team: `6NVKXYM5TK`, app group: `group.com.troski.app`)
- Created `lib/watchSync.ts` iOS bridge — call `syncCommuteToWatch(payload)` from any RN screen

### Files created
| File | Purpose |
|---|---|
| `TroskiWatchApp.swift` | `@main` entry point |
| `ContentView.swift` | TabView (Commute Summary ↔ Stations), fullScreenCover for alerts |
| `CommuteSummaryView.swift` | "Your morning commute" glance card with smart "Leave by" suggestion based on queue status |
| `MainCommuteView.swift` | Dark bg + kinetic amber/red glow, route, fare, tinted queue dot |
| `StationListView.swift` | "TROSKI / NEARBY HUBS" header, colored left-border cards, NavigationLink to detail |
| `StationDetailView.swift` | Station name, large queue status badge, wait time, fare, "Report Queue" button (deep links to phone) |
| `AlertView.swift` | Kinetic amber+red glow, fire headline, alternative suggestion, gradient Navigate + outline Dismiss |
| `CommuteRow.swift` | Compact row for complications / future list views |
| `Models/CommuteData.swift` | `CommuteData`, `Station` (with `isDistant`), `WatchAlert`, `QueueStatus` (short/moderate/long/veryLong) |
| `Services/WatchConnector.swift` | `WCSession` delegate, publishes `commute`, `stations`, `activeAlert`; mock data in DEBUG |
| `Extensions/Color+Troski.swift` | Full design-token color palette + hex initializer + `troskiSurfaceHigh` |
| `Extensions/ButtonStyles.swift` | `TroskiGradientButtonStyle` + `TroskiOutlineButtonStyle` |
| `Extensions/Typography.swift` | Centralized font tokens: `.troskiBrand`, `.troskiHeadline`, `.troskiFare`, `.troskiBody`, etc. |
| `expo-target.config.js` | `@bacons/apple-targets` config — type `watch`, frameworks `SwiftUI` + `WatchConnectivity` |
| `Info.plist` | watchOS bundle configuration |
| `Assets.xcassets/` | App icon — all sizes (44–1024) generated via sips |
| `lib/watchSync.ts` (root) | iOS bridge: `syncCommuteToWatch`, `syncStationsToWatch`, `sendAlertToWatch`, `clearWatchAlert` |

### Watch screens (4 total)
1. **Commute Summary** (page 1) — "Your morning/afternoon/evening commute", route, fare, smart "Leave by X:XX AM" suggestion based on queue wait + status buffer, queue dot + label
2. **Station List** (page 2, swipe left) — "NEARBY HUBS", colored left-border cards per queue status, tap → Station Detail
3. **Station Detail** (push from list) — station name, large colored queue badge, wait time row, fare row, "Report Queue" button (sends WC message to iPhone app)
4. **Alert** (fullScreenCover) — pops when very long queue detected, fire headline, Navigate/Dismiss buttons with kinetic glow

### Remaining issues before shipping

#### 🔴 Blockers
- [x] **Wire sync calls to real data** — DONE. `lib/hooks/useWatchSync.ts` syncs commute data. Homepage `index.tsx` syncs active queue stations + sends alerts for very_long queues.
- [x] **EAS iOS Preview build** — DONE. Build `c701ae40` finished 2026-04-14. But Watch app doesn't install on physical Watch via ad-hoc distribution — Watch apps require TestFlight or App Store.
  - Build: https://expo.dev/accounts/swalker01/projects/troski/builds/c701ae40-8e21-46e6-8d8c-b007564feed8
- [ ] **EAS iOS Production build + TestFlight submission** — NEXT STEP. Run these commands on Mac:
  ```bash
  cd ~/trotromate-native
  git pull origin main
  npx eas-cli build --platform ios --profile production --clear-cache
  ```
  Wait for the build to complete. It will prompt for Apple credentials for the Watch target provisioning profile.
  
  After build completes, submit to TestFlight:
  ```bash
  npx eas-cli submit --platform ios --profile production --latest
  ```
  
  Once submitted, Apple reviews it (24-48 hrs). After approval, the Watch app appears in TestFlight on iPhone. Open the Watch app on iPhone → find Troski → Install on Watch.

#### 🟡 Required before App Store
- [ ] **Watch app icon** — 1024x1024 marketing icon is done (`watch-1024.png`). Remaining sizes need generating on Mac using `sips`. Run these commands:
  ```bash
  cd targets/TroskiWatch/Assets.xcassets/AppIcon.appiconset
  cp ../../../../assets/images/icon.png ./source.png
  sips -z 88 88 source.png --out watch-44@2x.png
  sips -z 100 100 source.png --out watch-50@2x.png
  sips -z 172 172 source.png --out watch-86@2x.png
  sips -z 196 196 source.png --out watch-98@2x.png
  sips -z 216 216 source.png --out watch-108@2x.png
  rm source.png
  git add . && git commit -m "Add Watch app icons (all sizes)" && git push
  ```
  `Contents.json` already has the filenames mapped. After running sips, all icons are ready.
- [x] **Phase 2: Complications** — DONE. WidgetKit-based (not ClockKit). Separate `targets/TroskiWatchWidget/` extension target (type: `watch-widget`, bundleId: `com.troski.app.watch.widget`).
  - **Circular** (accessoryCircular): queue dot + fare
  - **Rectangular** (accessoryRectangular): "CURRENT ROUTE" label + dot, route + fare
  - **Corner** (accessoryCorner): fare on bezel + route as widget label
  - Data flows via shared App Group UserDefaults (`group.com.troski.app`)
  - Timeline refreshes every 30 min (~2 updates/hour, within watchOS budget)
  - Works on Infograph Modular, Metropolitan, Chronograph Pro faces (not Numerals — it doesn't support accessory complications)
- [x] **Watch app icons** — all sizes generated and committed
- [x] **CommuteSummaryView layout** — "Leave by" card moved below queue status line

#### 🟢 Nice to have
- [x] **Navigate deep link** — DONE. AlertView "Navigate" opens Apple Maps with alternative station in Accra, Ghana
- [x] **relativeTime auto-refresh** — DONE. 60s Timer in ContentView triggers re-render for "Updated X min ago"
- [x] **accessoryInline complication** — DONE. "Circle→Madina · ₵8.50" single-line text for inline-capable faces
- [ ] APNs complication push for urgent queue spikes
- [ ] Test on physical Apple Watch SE 2nd gen (40mm)
- [ ] Production EAS build + TestFlight submission

---

## Phase 1 original spec: Apple Watch (1-2 days)

### What it shows
- Your commute route (from → to)
- Current fare (GH₵8.50)
- Queue status with color indicator (green/amber/red)
- Wait time estimate
- Last updated timestamp

### Architecture
```
iOS Main App (Expo React Native)
    ↕ WatchConnectivity
Apple Watch App (SwiftUI)
```

- Watch app written in **SwiftUI** (watchOS cannot run React Native)
- Data synced from iOS app via **WatchConnectivity** framework
- iOS app sends: commute data, queue status, fare, last update time
- Watch receives and displays in a native SwiftUI list

### Folder Structure
```
targets/TroskiWatch/
├── TroskiWatchApp.swift       ← App entry point
├── ContentView.swift          ← Main list view
├── CommuteRow.swift           ← Single commute row component
├── Models/
│   └── CommuteData.swift      ← Data model matching iOS app
├── Services/
│   └── WatchConnector.swift   ← WatchConnectivity bridge
├── Assets.xcassets/           ← Watch app icon
└── Info.plist
```

### Expo Integration
- Use `expo-apple-targets` plugin to register Watch target
- Add to `app.config.js`:
```js
plugins: [
  ["expo-apple-targets", {
    appleTeamId: "6NVKXYM5TK",
    targets: {
      watch: {
        type: ".watchApp",
        name: "TroskiWatch",
        bundleIdentifier: "com.troski.app.watchkitapp",
        deploymentTarget: "10.0",
        entitlements: {
          "com.apple.security.application-groups": ["group.com.troski.app"],
        },
      },
    },
  }],
]
```

### iOS Side (React Native)
- Add WatchConnectivity bridge in native module or use `react-native-watch-connectivity`
- Send commute data when it changes:
```typescript
import { sendMessage } from 'react-native-watch-connectivity';

sendMessage({
  commute: {
    from: 'Circle',
    to: 'Madina',
    fare: 8.50,
    queueStatus: 'long',
    waitTime: '25 min',
    lastUpdated: new Date().toISOString(),
  }
});
```

### Watch UI Design (SwiftUI)
```
┌──────────────────────────┐
│  TROSKI                  │
│                          │
│  Circle → Madina         │
│  GH₵8.50                │
│  🔴 Long Queue · 25 min  │
│                          │
│  Updated 3 min ago       │
└──────────────────────────┘
```

- Green/amber/red status colors matching the app
- Poppins-style font (SF Pro on watchOS)
- Dark background matching app theme

## Phase 2: Watch Complication (Day 2)

### What it shows on the watch face
- Circular complication: green/amber/red dot
- Modular complication: "Circle→Madina 🟢"
- Graphic complication: fare + queue status

### Update frequency
- watchOS complications update ~2x per hour via CLKComplicationDataSource
- Push-based updates for urgent queue spikes via APNs complication push

## Phase 3: Wear OS (Future, 1-2 weeks)

### Architecture
```
Android Main App (Expo React Native)
    ↕ MessageClient / DataClient API
Wear OS App (Jetpack Compose)
```

- Separate Kotlin codebase
- Uses `react-native-wear-connectivity` for bridge
- Same data model as Apple Watch

### Folder
```
targets/TroskiWear/
├── src/main/
│   ├── java/com/troski/wear/
│   │   ├── MainActivity.kt
│   │   ├── CommuteScreen.kt
│   │   └── WearDataSync.kt
│   └── res/
└── build.gradle
```

## Prerequisites
- Mac with Xcode 15+ for Apple Watch development
- watchOS Simulator for testing
- Physical Apple Watch for final validation
- Android Studio for Wear OS (Phase 3)
- New EAS build after adding Watch target

## What Already Works (No Code Needed)
- Push notifications already appear on Apple Watch and Wear OS
- Morning commute push (6:15 AM) shows on wrist
- Afternoon rush push (4 PM) shows on wrist
- Streak risk push (8 PM) shows on wrist

## Dependencies to Add
```bash
npx expo install expo-apple-targets
npm install react-native-watch-connectivity
```

## Build Commands
```bash
# After adding Watch target, rebuild iOS
npx eas-cli build --platform ios --profile production --clear-cache

# The Watch app is included in the iOS binary automatically
```

## Marketing Hook
"Troski on your wrist — know your fare before you leave the house."
First transit Watch app in Africa. Gen Z appeal. Wearable users check 50+ times/day.
