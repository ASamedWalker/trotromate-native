import * as SecureStore from 'expo-secure-store'

/**
 * Wallet PIN — a 4-digit code required before spending from the wallet
 * (booking payments). Stored in SecureStore, which is hardware-backed
 * (Keychain / Keystore) and only readable after device unlock, so the raw PIN
 * is safe at rest. Brute-force is bounded by an escalating lockout guard.
 *
 * (Biometric unlock is a planned follow-up — needs expo-local-authentication,
 * a native rebuild.)
 */
const PIN_KEY = 'troski_wallet_pin'
const GUARD_KEY = 'troski_wallet_pin_guard'

interface PinGuard {
  attempts: number
  lockedUntil: number // ms epoch; 0 = not locked
}

const MAX_LOCKOUT_MS = 30 * 60 * 1000 // 30 min cap

async function readGuard(): Promise<PinGuard> {
  try {
    const raw = await SecureStore.getItemAsync(GUARD_KEY)
    if (!raw) return { attempts: 0, lockedUntil: 0 }
    const parsed = JSON.parse(raw)
    return { attempts: parsed.attempts ?? 0, lockedUntil: parsed.lockedUntil ?? 0 }
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

async function writeGuard(guard: PinGuard): Promise<void> {
  try {
    await SecureStore.setItemAsync(GUARD_KEY, JSON.stringify(guard))
  } catch { /* ignore */ }
}

async function clearGuard(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUARD_KEY)
  } catch { /* ignore */ }
}

export async function getPinLockoutMs(): Promise<number> {
  const guard = await readGuard()
  return Math.max(0, guard.lockedUntil - Date.now())
}

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

export async function verifyWalletPin(
  pin: string
): Promise<{ ok: boolean; lockedForMs: number; attemptsLeft: number }> {
  const guard = await readGuard()
  const now = Date.now()

  if (now < guard.lockedUntil) {
    return { ok: false, lockedForMs: guard.lockedUntil - now, attemptsLeft: 0 }
  }

  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY)
    const correct = !!stored && stored === pin

    if (correct) {
      await clearGuard()
      return { ok: true, lockedForMs: 0, attemptsLeft: 5 }
    }

    const attempts = guard.attempts + 1
    let lockedUntil = 0
    if (attempts % 5 === 0) {
      const escalation = 30_000 * 2 ** (attempts / 5 - 1)
      lockedUntil = now + Math.min(escalation, MAX_LOCKOUT_MS)
    }
    await writeGuard({ attempts, lockedUntil })

    const attemptsLeft = lockedUntil > 0 ? 0 : 5 - (attempts % 5)
    return { ok: false, lockedForMs: lockedUntil > 0 ? lockedUntil - now : 0, attemptsLeft }
  } catch {
    return { ok: false, lockedForMs: 0, attemptsLeft: 0 }
  }
}

export async function clearWalletPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY)
  } catch { /* ignore */ }
  await clearGuard()
}
