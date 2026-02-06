# TrotroMate Native

A native mobile app for Ghana's trotro (minibus) commuters. Search routes, check fares, report conditions, and earn rewards for contributing to the community.

Built with **Expo** and **React Native** for Android and iOS.

## Tech Stack

- **Expo SDK 54** - Latest Expo with New Architecture
- **React Native 0.81** - Latest React Native
- **Expo Router** - File-based navigation
- **NativeWind v4** - Tailwind CSS for React Native
- **Supabase** - Backend (shared with PWA)
- **Lucide React Native** - Icon library
- **React Native Reanimated** - Animations

## Features (MVP)

- **Route Search** - Find trotro routes with current fares
- **Popular Routes** - Quick access to frequently traveled routes
- **Fare Reports** - Crowdsourced fare data from commuters
- **Queue Status** - Real-time station queue reports
- **Rewards System** - Points, levels, and leaderboards for contributors

## Getting Started

### Prerequisites

- Node.js >= 20.19.4
- Expo Go app on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### Setup

```bash
# Clone the repository
git clone https://github.com/ASamedWalker/trotromate-native.git
cd trotromate-native

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start the development server
npx expo start
```

Scan the QR code with Expo Go to run on your device.

### Running on Emulator

```bash
# Android
npx expo start --android

# iOS (macOS only)
npx expo start --ios
```

## Project Structure

```
trotromate-native/
├── app/                    # Screens (Expo Router)
│   ├── (tabs)/             # Tab navigation
│   │   ├── index.tsx       # Home - Route search
│   │   ├── routes.tsx      # Routes - Browse & search
│   │   ├── report.tsx      # Report - Contribute data
│   │   └── rewards.tsx     # Rewards - Points & leaderboard
│   ├── report/             # Report modals
│   │   ├── fare.tsx        # Fare report form
│   │   └── queue.tsx       # Queue status form
│   ├── routes/             # Route details
│   │   └── [id].tsx        # Single route view
│   └── _layout.tsx         # Root layout
├── components/             # Reusable components
├── lib/                    # Shared utilities
│   ├── hooks/              # Custom hooks
│   ├── supabase/           # Supabase client
│   ├── types/              # TypeScript types
│   └── constants/          # App constants
├── assets/                 # Images, fonts
├── metro.config.js         # Metro bundler config (NativeWind)
├── tailwind.config.js      # Tailwind configuration
└── global.css              # Tailwind base styles
```

## Relationship to TrotroMate PWA

This native app shares the same **Supabase backend** as the [TrotroMate PWA](https://github.com/ASamedWalker/trotromate). Both apps read/write to the same database, so data is consistent across platforms.

| Feature | PWA | Native |
|---------|-----|--------|
| Route Search | Yes | Yes |
| Fare Reports | Yes | Yes |
| Queue Status | Yes | Yes |
| Rewards System | Yes | Yes |
| Trotro Tales | Yes | Coming soon |
| Push Notifications | Limited | Full FCM/APNs |
| Offline Mode | Service Worker | AsyncStorage |
| Distribution | Web | Play Store / App Store |

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

## License

Private - All rights reserved.
