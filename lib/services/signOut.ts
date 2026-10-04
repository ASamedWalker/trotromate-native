import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase/client'
import { clearWalletCache } from '@/lib/services/walletCache'
import { clearCachedPasses } from '@/lib/services/ticketCache'
import { clearWalletPin } from '@/lib/services/walletPin'
import { setBiometricEnabled } from '@/lib/services/biometric'

/**
 * Sign out and wipe everything that belongs to the account, so the next
 * person on a shared phone starts clean: wallet snapshot, offline tickets,
 * wallet PIN, biometric opt-in, active trip. `resetIdentity` (AppContext)
 * then rotates the device id and empties the query cache.
 */
export async function signOutAndWipe(resetIdentity: () => Promise<void>): Promise<void> {
  try { await supabase.auth.signOut() } catch { /* still wipe locally */ }
  await Promise.all([
    clearWalletCache(),
    clearCachedPasses(),
    clearWalletPin(),
    setBiometricEnabled(false),
    AsyncStorage.removeItem('@troski_active_trip').catch(() => {}),
  ])
  await resetIdentity()
  await AsyncStorage.setItem('troski_signed_out', 'true')
}
