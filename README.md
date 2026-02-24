# Troski

Community-powered transit for Ghana. Know your trotro fare, beat the queue.

Troski gives commuters real-time information about Ghana's trotro (minibus) transport system — crowdsourced fares, station queue status, route planning, and a full interactive transport map. Built by people who ride trotro, for people who ride trotro.

## Features

- **Route Search & Planning** — Find trotro/okada routes with current fares and multi-leg transfer options
- **Crowdsourced Reports** — Submit and view fare reports, queue status, road incidents
- **Interactive Transport Map** — 2,386 transport stops and 566 route corridors from OpenStreetMap, with distinct icons for trotro, train, taxi, and lorry parks
- **Train System** — Tema-Accra commuter line with crowdsourced delay/crowd reports
- **Trotro Tales** — Photo sharing for the commuter community
- **Rewards Engine** — Points, streaks, levels, badges, and leaderboards for contributors
- **Offline Support** — Reports queue locally when offline and sync when back online
- **Push Notifications** — Fare drop alerts, queue updates, streak reminders

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo SDK 54 (New Architecture) |
| Navigation | Expo Router v6 (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| State | React Query v5 + React Context |
| Maps | Mapbox GL (@rnmapbox/maps v10.2) |
| Icons | Lucide React Native |
| OTA Updates | EAS Update |

## Getting Started

### Prerequisites

- Node.js >= 20
- Expo Go on your phone — [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) | [iOS](https://apps.apple.com/app/expo-go/id982107779)

### Setup

```bash
git clone https://github.com/ASamedWalker/trotromate-native.git
cd trotromate-native
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npx expo start
```

Scan the QR code with Expo Go to run on your device.

### Running on Emulator

```bash
npx expo start --android    # Android
npx expo start --ios        # iOS (macOS only)
```

## Project Structure

```
app/              Screens (Expo Router)
  (tabs)/           Bottom tab navigation (home, routes, report, rewards, activity, tales)
  report/           Report forms (fare, queue, incident, train, photo)
  routes/           Route details & planner
  stations/         Interactive transport map
  train/            Train system screens
  profile/          User profiles & followers
  settings/         App settings
components/       Reusable UI components
lib/
  services/         Business logic & API calls (15 service modules)
  hooks/            Custom React hooks (25+ hooks)
  types/            TypeScript definitions
  constants/        App constants (rewards, train schedules)
  contexts/         React Context (AppContext)
  supabase/         Database client & migrations
  utils/            Utility functions (distance, time, navigation)
assets/data/      Bundled transport data (OSM fallback)
scripts/          Data pipeline (OSM fetch, Supabase seed)
docs/             Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Comprehensive technical architecture — layers, data flow, schemas, patterns |
| [Vision & Roadmap](docs/VISION.md) | Business vision, 4-phase roadmap, scalability principles |
| [Contributing](docs/CONTRIBUTING.md) | How to set up, contribute, and submit PRs |

## Shared Backend

Troski Native shares the same Supabase database as the [TrotroMate PWA](https://github.com/ASamedWalker/trotromate). Data is consistent across both platforms.

| Capability | PWA | Native |
|-----------|-----|--------|
| Route Search | Yes | Yes |
| Fare/Queue Reports | Yes | Yes |
| Rewards System | Yes | Yes |
| Trotro Tales | Yes | Yes |
| Transport Map | — | Mapbox GL |
| Push Notifications | Limited | Full FCM/APNs |
| Offline Mode | Service Worker | AsyncStorage |
| Distribution | Web | Play Store / App Store |

## Building for Production

```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

### OTA Updates

```bash
npx eas update --branch preview --platform android --message "Description"
npx eas update --branch production --platform android --message "Description"
npx eas update --branch production --platform ios --message "Description"
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for setup instructions, code style, and areas where we need help.

## License

Private — All rights reserved.
