# Troski Wear OS App — Android Watch

## Overview
Real-time transit alerts on Wear OS (Samsung Galaxy Watch, Pixel Watch, etc.). Mirror of the Apple Watch app — commute status, queue alerts, fare updates on your wrist.

## Status: READY TO BUILD (2026-04-15)

Apple Watch app is complete with 4 screens + 4 complications. Now building the Wear OS counterpart.

## Architecture
```
Android Main App (Expo React Native)
    ↕ react-native-wear-connectivity (MessageClient / DataClient API)
Wear OS App (Jetpack Compose / Kotlin)
```

## Prerequisites
- Android Studio installed on Mac
- Wear OS emulator or physical Samsung Galaxy Watch / Pixel Watch
- `react-native-wear-connectivity` package (install if not already)

## Setup Steps
```bash
cd ~/trotromate-native
git pull origin main

# Install Wear OS connectivity if not already installed
npm install react-native-wear-connectivity
```

## Screens to Build (matching Apple Watch)

### 1. Commute Summary (Home)
- "Your morning commute"
- Circle → Madina
- GH₵8.50
- Queue status dot (green/amber/red) + label
- "Leave by 6:45 AM" smart suggestion
- "Updated 3 min ago" freshness

### 2. Station List
- "NEARBY HUBS" header
- Scrollable list with colored left borders per queue status
- Red border = Long Queue, Green = Clear, Amber = Moderate
- Tap → Station Detail
- Distant stations at 60% opacity with "12 min away"

### 3. Station Detail (on tap)
- Station name (large)
- Queue status badge (colored, large)
- Wait time estimate
- Recent fare
- "Report Queue" button → opens phone app

### 4. Alert Screen
- Triggered when very_long queue detected
- "🔥 Circle: Very Long Queue"
- "Consider Kaneshie — shorter queue right now"
- "Navigate" button → opens Google Maps
- "Dismiss" button

## Wear OS Tiles (equivalent of Apple Watch Complications)
- **Circular Tile**: queue status dot + fare
- **Large Tile**: route + fare + queue status + wait time
- Tiles use Horologist / Wear Tiles API

## Data Bridge
Update `lib/watchSync.ts` to support Android:

```typescript
// Already has iOS WatchConnectivity
// Add Android Wear OS connectivity:
if (Platform.OS === 'android') {
  const { sendMessage } = require('react-native-wear-connectivity');
  // Same API: syncCommuteToWatch(), syncStationsToWatch(), sendAlertToWatch()
}
```

## Design Reference
See `targets/TroskiWatch/DESIGN.md` for full design specs:
- Colors: bg #100e0d, primary #ffad3a, error #ff716a, tertiary #9bffce
- Queue colors: green #22c55e, amber #f59e0b, orange #f97316, red #ef4444
- Font: Space Grotesk Bold for headlines, Inter for body
- Dark mode only
- Adapt for both round (Galaxy Watch) AND square watch faces

## Folder Structure
```
targets/TroskiWear/
├── src/main/
│   ├── java/com/troski/wear/
│   │   ├── MainActivity.kt
│   │   ├── presentation/
│   │   │   ├── CommuteScreen.kt
│   │   │   ├── StationListScreen.kt
│   │   │   ├── StationDetailScreen.kt
│   │   │   └── AlertScreen.kt
│   │   ├── data/
│   │   │   └── WearDataSync.kt
│   │   ├── tile/
│   │   │   └── TroskiTileService.kt
│   │   └── theme/
│   │       └── TroskiWearTheme.kt
│   ├── res/
│   │   ├── values/colors.xml
│   │   └── drawable/
│   └── AndroidManifest.xml
├── build.gradle.kts
└── PLAN.md
```

## Build & Test
```bash
# After adding Wear OS module, rebuild Android
npx eas-cli build --platform android --profile production --clear-cache

# Test on Wear OS emulator in Android Studio:
# 1. Create Wear OS emulator (API 33+)
# 2. Pair with phone emulator via: adb -s <wear-serial> tcpip 5555
# 3. Install app on phone emulator, Wear companion auto-installs
```

## Version
Ship with v1.1.3 alongside Apple Watch. Both platforms aligned.
