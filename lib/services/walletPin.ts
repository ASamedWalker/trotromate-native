import * as SecureStore from 'expo-secure-store'

/**
 * Wallet PIN — a 4-digit code required before spending from the wallet
 * (booking payments). Stored in SecureStore, which is hardware-backed
 * (Keychain / Keystore) and only readable after device unlock, so the raw PIN
 * is safe at rest. Brute-force is bounded by the UI attempt limit.
 *
 * (Biometric unlock is a planned follow-up — needs expo-local-authentication,
 * a native rebuild.)
 */
const PIN_KEY = 'troski_wallet_pin'

export async function hasWalletPin(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(PIN_KEY)
    return !!v && v.length === 4
  } catch {
    return false
  }
}

export async function setWalletPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false
  try {
    await SecureStore.setItemAsync(PIN_KEY, pin)
    return true
  } catch {
    return false
  }
}

export async function verifyWalletPin(pin: string): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY)
    return !!stored && stored === pin
  } catch {
    return false
  }
}

export async function clearWalletPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY)
  } catch { /* ignore */ }
}
