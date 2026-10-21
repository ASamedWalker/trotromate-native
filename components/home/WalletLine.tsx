import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Wallet } from 'lucide-react-native'
import { font, ui, brand } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { getCachedWallet, cacheWalletBalance } from '@/lib/services/walletCache'
import { authedFetch } from '@/lib/services/authedFetch'
import { useLanguage } from '@/lib/i18n'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

/**
 * Wallet as one 48 pt line on Home (UX v2 H3): "Wallet GH₵2.05 · Top up". The big
 * wallet lives on its own tab. Rendered only in the full (wallet) layout, signed in.
 * Balance seeds from the wallet cache so a failed fetch never shows a fake GH₵0.00.
 */
export default function WalletLine({ authUserId }: { authUserId: string }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [balance, setBalance] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setBalance(null)
    getCachedWallet(authUserId).then((snap) => { if (snap) setBalance((prev) => prev ?? snap.balance) })
  }, [authUserId])

  // Refetch on focus so a top-up or booking debit shows the moment the rider returns Home.
  useFocusEffect(useCallback(() => {
    let live = true
    getCachedWallet(authUserId).then((snap) => { if (live && snap) setBalance(snap.balance) })
    authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${authUserId}`)
      .then((r) => { if (!r.ok) throw new Error(`wallet ${r.status}`); return r.json() })
      .then((data) => {
        if (!live || data.balance == null) return
        setBalance(Number(data.balance)); setFailed(false); cacheWalletBalance(Number(data.balance), authUserId)
      })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [authUserId]))

  const amount = balance != null ? formatGHS(balance) : 'GH₵—'

  return (
    <View style={{
      marginHorizontal: 20, marginTop: 12, height: 48, borderRadius: 16, backgroundColor: ui.card, borderWidth: 1, borderColor: ui.hairline,
      flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    }}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/wallet' as Href) }}
        accessibilityRole="button"
        accessibilityLabel={`${t('homeX.walletA11y', { amount })}${failed ? t('homeX.lastKnown') : ''}`}
        style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14 }}
      >
        <Wallet size={18} color={ui.text} />
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: ui.text }} numberOfLines={1}>
          {t('nav.wallet')} <Text style={{ fontVariant: ['tabular-nums'] }}>{amount}</Text>
        </Text>
        {failed && balance != null ? <Text style={{ fontFamily: font.medium, fontSize: 12, color: ui.textTertiary }}>{t('homeX.offlineDot')}</Text> : null}
      </Pressable>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/wallet/fund' as Href) }}
        accessibilityRole="button"
        accessibilityLabel={t('homeX.topUpA11y')}
        style={{ height: '100%', justifyContent: 'center', paddingHorizontal: 14 }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: brand.orangeText }}>{t('homeX.topUp')}</Text>
      </Pressable>
    </View>
  )
}
