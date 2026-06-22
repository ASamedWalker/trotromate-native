import AsyncStorage from '@react-native-async-storage/async-storage'

// The Wallet tab must render instantly — fetching balance/transactions over the
// network takes a beat, and showing the blank "Your wallet is quiet" empty state
// in the meantime (then flipping to funded) is jarring. Cache the last-known
// balance + transactions so the screen paints real numbers on mount, then the
// live fetch refreshes them in the background.
const KEY = '@troski_wallet_snapshot_v1'

export type WalletSnapshot = { balance: number; transactions: any[] }

export async function cacheWallet(snap: WalletSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...snap, at: new Date().toISOString() }))
  } catch { /* best-effort */ }
}

export async function getCachedWallet(): Promise<WalletSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { balance: Number(parsed.balance) || 0, transactions: parsed.transactions ?? [] }
  } catch {
    return null
  }
}
