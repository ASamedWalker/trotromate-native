import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * The rider's last-used MoMo network + number (UX v2 TU3: choose the network
 * once). Local only; written after a prompt is sent successfully.
 */
const KEY = '@troski_momo_saved_v1'

export interface SavedMomo { provider: 'mtn' | 'tgo' | 'atl'; phone: string }

export async function getSavedMomo(): Promise<SavedMomo | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if ((v?.provider === 'mtn' || v?.provider === 'tgo' || v?.provider === 'atl') && typeof v?.phone === 'string' && v.phone) {
      return { provider: v.provider, phone: v.phone }
    }
    return null
  } catch {
    return null
  }
}

export async function saveMomo(m: SavedMomo): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(m)) } catch { /* best effort */ }
}
