import AsyncStorage from '@react-native-async-storage/async-storage'

// The Wallet tab must render instantly — fetching balance/transactions over the
// network takes a beat, and showing the blank "Your wallet is quiet" empty state
// in the meantime (then flipping to funded) is jarring. Cache the last-known
// balance + transactions so the screen paints real numbers on mount, then the
// live fetch refreshes them in the background.
const KEY = '@troski_wallet_snapshot_v1'

export type WalletSnapshot = { balance: number; transactions: any[] }

// The snapshot records whose wallet it is, so a shared phone never paints the
// previous account's balance for the next user.
export async function cacheWallet(snap: WalletSnapshot, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...snap, userId, at: new Date().toISOString() }))
  } catch { /* best-effort */ }
}

export async function getCachedWallet(userId: string | null | undefined): Promise<WalletSnapshot | null> {
  if (!userId) return null
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.userId !== userId) return null
    return { balance: Number(parsed.balance) || 0, transactions: parsed.transactions ?? [] }
  } catch {
    return null
  }
}

/** Update just the balance (e.g. after a booking debit) without a refetch. */
export async function cacheWalletBalance(balance: number, userId: string): Promise<void> {
  const snap = await getCachedWallet(userId)
  await cacheWallet({ balance, transactions: snap?.transactions ?? [] }, userId)
}

export async function clearWalletCache(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY) } catch { /* ignore */ }
}
