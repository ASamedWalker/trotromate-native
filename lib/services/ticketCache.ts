import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ActivePass } from '@/lib/services/tickets'

// Active tickets must be showable to a conductor even with NO network (trotros
// often have no signal). Cache the latest active passes locally so the QR
// always renders offline.
const KEY = '@troski_active_passes_v1'

export async function cacheActivePasses(passes: ActivePass[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ passes, at: new Date().toISOString() }))
  } catch { /* best-effort */ }
}

export async function getCachedPasses(): Promise<ActivePass[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const passes: ActivePass[] = parsed.passes ?? []
    // Drop anything that has since expired so we never show a dead ticket.
    const now = Date.now()
    return passes.filter((p) => !p.expires_at || new Date(p.expires_at).getTime() > now)
  } catch {
    return []
  }
}
