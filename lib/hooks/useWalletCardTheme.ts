import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useApp } from '@/lib/contexts/AppContext'
import { LEVELS } from '@/lib/constants/rewards'
import type { LevelSlug } from '@/lib/types'
import type { WalletCardTheme } from '@/components/WalletCard'

/**
 * Wallet card colours are earned through the Rewards tiers (recognition, not
 * money): each tier unlocks one card. The rider's pick is remembered on the
 * phone; a pick they no longer qualify for (e.g. after signing out) falls back
 * to the Passenger card.
 */
export const CARD_TIERS: { theme: WalletCardTheme; level: LevelSlug }[] = [
  { theme: 'orange', level: 'passenger' },
  { theme: 'green', level: 'regular' },
  { theme: 'black', level: 'local_expert' },
  { theme: 'gold', level: 'troski_legend' },
]

export const CARD_THEME_KEY = '@troski_card_theme_v1'

export function isCardUnlocked(theme: WalletCardTheme, points: number): boolean {
  const tier = CARD_TIERS.find((c) => c.theme === theme)
  return !!tier && points >= LEVELS[tier.level].min_points
}

// Shared across mounted cards (Home + Wallet + picker) so a pick shows everywhere at once.
let current: WalletCardTheme | null = null
const listeners = new Set<(t: WalletCardTheme) => void>()

export function useWalletCardTheme() {
  const { profile } = useApp()
  const points = profile?.total_points ?? 0
  const [picked, setPicked] = useState<WalletCardTheme>(current ?? 'orange')

  useEffect(() => {
    const on = (t: WalletCardTheme) => setPicked(t)
    listeners.add(on)
    if (current == null) {
      AsyncStorage.getItem(CARD_THEME_KEY)
        .then((v) => {
          if (v === 'orange' || v === 'green' || v === 'black' || v === 'gold') {
            current = v
            listeners.forEach((l) => l(v))
          }
        })
        .catch(() => {})
    }
    return () => { listeners.delete(on) }
  }, [])

  const choose = useCallback(async (t: WalletCardTheme) => {
    current = t
    listeners.forEach((l) => l(t))
    try { await AsyncStorage.setItem(CARD_THEME_KEY, t) } catch { /* best-effort */ }
  }, [])

  const theme: WalletCardTheme = isCardUnlocked(picked, points) ? picked : 'orange'
  return { theme, picked, points, choose }
}
