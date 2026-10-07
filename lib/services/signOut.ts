import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase/client'
import { clearWalletCache } from '@/lib/services/walletCache'
import { clearCachedPasses } from '@/lib/services/ticketCache'
import { clearWalletPin } from '@/lib/services/walletPin'
import { setBiometricEnabled } from '@/lib/services/biometric'
import { cancelDepartureReminder, getDepartureReminders } from '@/lib/services/trainReminders'
import { resetWalletCardTheme } from '@/lib/hooks/useWalletCardTheme'

// Personal trip data the next person on the phone shouldn't inherit.
// Device-level settings (language, onboarding, preferences) are kept.
const ACCOUNT_KEYS = [
  '@troski_active_trip',
  'troski_my_train_trip',
  'troski-my-commutes',
  'user-commutes',
  'troski-route-alerts',
  'troski-search-history',
]

/**
 * Sign out and wipe everything that belongs to the account, so the next
 * person on a shared phone starts clean: wallet snapshot, offline tickets,
 * wallet PIN, biometric opt-in, saved trips/alerts, scheduled train
 * reminders, and this device's push token. `resetIdentity` (AppContext)
 * then rotates the device id and empties the query cache.
 */
export async function signOutAndWipe(
  deviceId: string | null,
  resetIdentity: () => Promise<void>,
): Promise<void> {
  // Stop the old profile's pushes reaching this phone (the new device id
  // re-registers the token for the guest profile).
  if (deviceId) {
    // RPC, not UPDATE: a plain UPDATE is anon-only under RLS and matched 0 rows here
    try { await supabase.rpc('save_push_token', { p_device_id: deviceId, p_token: null }) } catch { /* best-effort */ }
  }
  try { await supabase.auth.signOut() } catch { /* still wipe locally */ }
  try {
    const reminders = await getDepartureReminders()
    await Promise.all(Object.keys(reminders).map((id) => cancelDepartureReminder(id)))
  } catch { /* best-effort */ }
  await Promise.all([
    clearWalletCache(),
    clearCachedPasses(),
    clearWalletPin(),
    setBiometricEnabled(false),
    resetWalletCardTheme(),
    AsyncStorage.multiRemove(ACCOUNT_KEYS).catch(() => {}),
  ])
  await resetIdentity()
  await AsyncStorage.setItem('troski_signed_out', 'true')
}
