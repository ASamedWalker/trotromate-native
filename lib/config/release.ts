import * as Updates from 'expo-updates'

// Store builds (EAS channel 'production') run the slim release: no wallet, no
// "coming soon" features. Preview/dev builds keep everything for testing.
// Local test: EXPO_PUBLIC_RELEASE_MODE=1 npx expo start  (restart Metro after changing)
//
// Nothing behind these flags is deleted. RELEASE_MODE drives the tab set
// (app/(tabs)/_layout.tsx) and Home (ReleaseHome vs FullHomeScreen); each FEATURES
// flag gates the pieces below. To bring a feature back in store builds, change its
// value here to `true` and publish:
//   wallet               onboarding wallet slide. The Wallet TAB and the old Home's wallet card /
//                        top-up come back with RELEASE_MODE=false (the tab set is mode-based)
//   scanToPay            Scan To Pay lives on the old Home (RELEASE_MODE=false restores it)
//   okadaPragyaServices  Okada/Pragya options in the route-detail transport picker
//   liveBuses            Troski Pro vehicle fetch/polling, Available Buses + stop timeline sheets,
//                        "N live" pill on route detail
// Booking (Go Now / Book this trip) is additionally gated by RELEASE_MODE and
// TROTRO_BOOKING_ENABLED (lib/config/booking.ts).
export const RELEASE_MODE = Updates.channel === 'production' || process.env.EXPO_PUBLIC_RELEASE_MODE === '1'

export const FEATURES = {
  wallet: !RELEASE_MODE,
  scanToPay: !RELEASE_MODE,
  okadaPragyaServices: !RELEASE_MODE,
  liveBuses: !RELEASE_MODE,
} as const
