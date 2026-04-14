# Troski Watch App — Apple Watch + Wear OS

## Overview
Real-time transit alerts on your wrist. Queue status, fare updates, commute notifications — without pulling out your phone. First transit Watch app in Africa for informal transport.

## Phase 1: Apple Watch (1-2 days)

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
