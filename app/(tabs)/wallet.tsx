import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Eye, EyeOff, QrCode, ChevronRight, Plus, CheckCircle2, History } from 'lucide-react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { font, themed, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { Button, Badge, SectionHeader } from '@/components/ui'
import { HeroText } from '@/components/HeroText'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { formatGHS } from '@/lib/utils/currency'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { normalizeActivePasses, formatPassExpiry, type ActivePass } from '@/lib/services/tickets'
import { cancelBooking } from '@/lib/services/booking'
import { cacheActivePasses, getCachedPasses } from '@/lib/services/ticketCache'
import { cacheWallet, getCachedWallet } from '@/lib/services/walletCache'
import { useLanguage } from '@/lib/i18n'
import { SkeletonActivityItem } from '@/components/Skeleton'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { authedFetch } from '@/lib/services/authedFetch'

export default function WalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const { t: tr } = useLanguage()
  const insets = useSafeAreaInsets()
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { isAuthenticated } = useAuthContext()

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
  const { user } = useAuthContext()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [passes, setPasses] = useState<ActivePass[]>([])
  // `hydrated` flips once we have ANY data to show (cache seed or first fetch).
  // Until then we render a skeleton instead of the blank empty state, so the
  // wallet never shows "quiet" while it's actually still loading.
  const [hydrated, setHydrated] = useState(false)
  const hasTransactions = transactions.length > 0

  // "GH₵ X added ✓" moment — until the MoMo webhook lands, detect credits by
  // comparing balances across refetches (focus + pull-to-refresh). Lyft's
  // payment-trust principle: make the money moment explicit, never silent.
  const prevBalanceRef = useRef<number | null>(null)
  const [credited, setCredited] = useState<number | null>(null)
  const creditTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (creditTimer.current) clearTimeout(creditTimer.current) }, [])

  const fetchWallet = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${user.id}`)
      const data = await res.json()
      if (data.balance != null) {
        const next = Number(data.balance)
        const prev = prevBalanceRef.current
        if (prev != null && next > prev) {
          setCredited(next - prev)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          if (creditTimer.current) clearTimeout(creditTimer.current)
          creditTimer.current = setTimeout(() => setCredited(null), 5000)
        }
        prevBalanceRef.current = next
        setBalance(next)
      }
      const txs = Array.isArray(data.transactions) ? data.transactions : null
      if (txs) setTransactions(txs)
      // Snapshot balance + transactions so the next open paints instantly. Only
      // write on a confirmed balance, and keep the last-known transactions if
      // this response omitted them (partial/timed-out body) — never clobber a
      // good cache with an empty list.
      if (data.balance != null) {
        cacheWallet({ balance: Number(data.balance), transactions: txs ?? transactions }, user.id)
      }
      // passes ride the same authenticated wallet response (see lib/services/tickets.ts)
      const active = normalizeActivePasses(data.passes, Date.now())
      setPasses(active)
      cacheActivePasses(active) // keep a local copy so the ticket QR works offline
    } catch (e) { console.warn("[troski] silent error:", e) }
    finally { setHydrated(true) }
  }, [user?.id])

  // Seed from the offline caches immediately so the wallet paints real numbers
  // on mount (passes for the QR; balance + transactions to avoid the blank
  // empty-state flash). The live fetch then refreshes everything.
  useEffect(() => {
    getCachedPasses().then((cached) => {
      if (cached.length) setPasses((cur) => (cur.length ? cur : cached))
    })
    getCachedWallet(user?.id).then((snap) => {
      if (!snap) return
      setBalance((cur) => (cur > 0 ? cur : snap.balance))
      setTransactions((cur) => (cur.length ? cur : snap.transactions))
      if (snap.balance > 0 || snap.transactions.length) setHydrated(true)
    })
  }, [user?.id])

  useEffect(() => { fetchWallet() }, [fetchWallet])

  // Refetch when returning from fund screen
  useFocusEffect(useCallback(() => { fetchWallet() }, [fetchWallet]))

  const [cancelling, setCancelling] = useState(false)
  const confirmCancel = (pass: ActivePass) => {
    if (!user?.id) return
    Alert.alert(
      'Cancel this booking?',
      `${pass.route_label}\n\nYou'll be refunded ${formatGHS(pass.fare)} to your wallet. This can't be undone.`,
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel & refund',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            const r = await cancelBooking(user.id, pass.trip_code)
            setCancelling(false)
            if (r.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              Alert.alert('Booking cancelled', `${formatGHS(r.refunded)} refunded to your wallet.`)
              fetchWallet()
            } else {
              Alert.alert('Could not cancel', r.message)
            }
          },
        },
      ],
    )
  }

  const handleAuthAction = () => {
    if (!isAuthenticated) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.push('/auth/phone' as Href)
      return
    }
    // Authenticated — go to fund wallet
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/wallet/fund' as Href)
  }

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    await fetchWallet()
    setRefreshing(false)
  }

  const toggleBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setBalanceVisible(!balanceVisible)
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#19120b' : ui.bg }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: t.text }]}>{tr('wallet.title')}</Text>
        <TouchableOpacity
          onPress={toggleBalance}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}
        >
          {balanceVisible
            ? <Eye size={22} color={isDark ? '#78716c' : ui.textTertiary} />
            : <EyeOff size={22} color={isDark ? '#78716c' : ui.textTertiary} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} />
        }
      >
        {/* ── Balance Card ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.section}>
          <View style={[s.balanceCard, isDark && s.balanceCardDark]}>
            {/* Coming Soon badge — only when not funded */}
            {!isAuthenticated && (
              <View style={{ marginBottom: space.md }}>
                <Badge label="Coming soon" tone="brand" />
              </View>
            )}

            <Text style={s.balanceLabelText}>{tr('wallet.balance')}</Text>
            <View style={s.balanceAmountRow}>
              <HeroText size={44} style={{ color: isDark ? '#eee0d3' : ui.text, letterSpacing: -0.5 }}>
                {!balanceVisible
                  ? 'GH₵ ••••••'
                  // Never flash GH₵ 0.00 before the real balance arrives (or for a guest).
                  : isAuthenticated && hydrated ? formatGHS(balance) : 'GH₵ —'
                }
              </HeroText>
            </View>

            {/* Credit celebration — appears when a top-up lands */}
            {credited != null && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.creditedBanner}>
                <CheckCircle2 size={16} color={ui.success} />
                <Text style={s.creditedText}>{formatGHS(credited)} added to your wallet</Text>
              </Animated.View>
            )}

            {/* Add Money — fund the wallet to pay for bookings */}
            {isAuthenticated && (
              <View style={s.balanceCardBtns}>
                <Button
                  label={tr('wallet.addMoney')}
                  icon={Plus}
                  onPress={() => router.push('/wallet/fund' as Href)}
                />
              </View>
            )}
          </View>
        </Animated.View>

        {(isAuthenticated && (balance > 0 || hasTransactions)) ? (
          /* ── Active Pass + Transactions (funded state) ── */
          <>
            {/* My Tickets — full ticket history (active/used/expired/cancelled) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { Haptics.selectionAsync(); router.push('/wallet/tickets' as Href) }}
              style={s.myTicketsRow}
              accessibilityRole="button"
              accessibilityLabel={tr('wallet.myTickets')}
            >
              <View style={s.myTicketsIcon}><QrCode size={18} color={brand.orange} /></View>
              <Text style={s.myTicketsText}>{tr('wallet.myTickets')}</Text>
              <View style={{ flex: 1 }} />
              <ChevronRight size={18} color={ui.textTertiary} />
            </TouchableOpacity>

            {/* Active Pass — real tickets from the wallet backend; hidden when
                the user has none (no more mock pass) */}
            {passes.length > 0 && (() => {
              const pass = passes[0]
              return (
                <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.section}>
                  <View style={s.passHeader}>
                    <Text style={[s.sectionTitle, { color: isDark ? t.text : ui.text }]}>{tr('wallet.activePass')}</Text>
                    {passes.length > 1 && <Text style={s.viewAll}>{passes.length} passes</Text>}
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/wallet/ticket', params: { trip_code: pass.trip_code } } as Href) }}
                    accessibilityRole="button"
                    accessibilityLabel={`Active pass, ${pass.route_label}`}
                  >
                  <LinearGradient
                    colors={[brand.orange, brand.orangePressed]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.passCard}
                  >
                    <View style={s.passTop}>
                      <View style={{ flex: 1 }}>
                        <View style={s.passLiveRow}>
                          <View style={s.passLiveDot} />
                          <Text style={s.passLiveText}>Active pass</Text>
                        </View>
                        <Text style={s.passRoute} numberOfLines={1}>{pass.route_label}</Text>
                      </View>
                      <MaterialIcons name="directions-bus" size={32} color="rgba(255,255,255,0.4)" />
                    </View>
                    <View style={s.passBottom}>
                      <View>
                        <Text style={s.passFieldLabel}>Expires</Text>
                        <Text style={s.passFieldValue}>{formatPassExpiry(pass.expires_at)}</Text>
                      </View>
                      <View style={s.passTripsLeft}>
                        <Text style={s.passTripsText}>{pass.trip_code}</Text>
                      </View>
                    </View>
                    {pass.van_plate && (
                      <Text style={s.passPlate}>Van {pass.van_plate} · {formatGHS(pass.fare)}</Text>
                    )}
                    {/* Decorative circle */}
                    <View style={s.passDecorCircle} />
                  </LinearGradient>
                  </TouchableOpacity>
                  {/* Cancel an unused ticket → full refund to wallet */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={cancelling}
                    onPress={() => confirmCancel(pass)}
                    style={s.cancelPass}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel booking and refund"
                    accessibilityState={{ disabled: cancelling }}
                  >
                    <Text style={s.cancelPassText}>{cancelling ? 'Cancelling…' : 'Cancel booking & refund'}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            })()}

            {/* Transactions */}
            <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.section}>
              <SectionHeader
                title={tr('wallet.recentTransactions')}
                action={transactions.length > 5 ? 'See all' : undefined}
                onAction={() => router.push('/wallet/transactions' as Href)}
                style={{ marginBottom: space.md }}
              />
              {!hydrated ? (
                [0, 1, 2, 3].map((i) => (
                  <Animated.View key={`tx-skeleton-${i}`} entering={FadeInDown.delay(280 + i * 50).duration(300)}>
                    <SkeletonActivityItem isDark={isDark} />
                  </Animated.View>
                ))
              ) : transactions.slice(0, 5).map((tx: any, i: number) => {
                const isTopup = tx.type === 'topup'
                const credit = tx.type === 'topup' || tx.type === 'refund'
                const icon = isTopup ? 'account-balance' as const : tx.type === 'refund' ? 'undo' as const : 'commute' as const
                const amountStr = `${credit ? '+' : '-'}${formatGHS(Number(tx.amount))}`
                const amountColor = credit ? ui.success : (isDark ? t.text : ui.text)
                const statusLabel = tx.status === 'success'
                  ? (isTopup ? 'MoMo pay' : tx.type === 'refund' ? 'Refunded' : 'Completed')
                  : String(tx.status).charAt(0).toUpperCase() + String(tx.status).slice(1).toLowerCase()
                const statusTone = tx.status === 'success'
                  ? 'success' as const
                  : tx.status === 'pending' ? 'warning' as const
                  : tx.status === 'failed' ? 'danger' as const
                  : 'neutral' as const
                const date = new Date(tx.created_at).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                return (
                <Animated.View key={tx.id} entering={FadeInDown.delay(280 + i * 50).duration(300)}>
                  <View style={[s.txRow, isDark && s.txRowDark]} accessible accessibilityLabel={`${tx.type} ${formatGHS(Number(tx.amount))}`}>
                    <View style={[s.txIcon, { backgroundColor: isDark ? '#3c332b' : ui.surface }]}>
                      <MaterialIcons name={icon} size={20} color={brand.orange} />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={[s.txLabel, { color: isDark ? t.text : ui.text }]}>{(tx.description || (isTopup ? 'MoMo Top-up' : 'Payment')).replace(/\bGHS\b/g, 'GH₵')}</Text>
                      <Text style={s.txDate}>{date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[s.txAmount, { color: amountColor }]}>{amountStr}</Text>
                      <Badge label={statusLabel} tone={statusTone} />
                    </View>
                  </View>
                </Animated.View>
                )
              })}
            </Animated.View>

            {/* Promo banner removed (UX-04): "Get 5% Back" had no backing promo
                system — an unfulfillable money promise. Reinstate only when a
                real promo engine credits it. */}
          </>
        ) : (isAuthenticated && !hydrated) ? (
          /* ── Loading skeleton — shown until the first fetch (or cache) lands,
                so we never flash the "quiet" empty state while still loading ── */
          <View style={s.skeletonWrap}>
            <View style={[s.skelBar, { width: '55%', height: 16 }]} />
            <View style={[s.skelBar, { width: '85%', height: 12, marginTop: 14 }]} />
            <View style={[s.skelCard, { marginTop: space.section }]} />
            <View style={[s.skelCard, { marginTop: 12 }]} />
          </View>
        ) : (
          /* ── Empty State (Stitch Page 3 — "Your wallet is quiet") ── */
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={s.emptyContainer}>
            <View style={s.emptyWalletBox}>
              <MaterialIcons name="account-balance-wallet" size={48} color={brand.orange} />
            </View>

            {/* Text */}
            <Text style={[s.emptyTitle, { color: isDark ? t.text : ui.text }]}>Your wallet is quiet.</Text>
            <Text style={[s.emptySub, { color: isDark ? '#78716c' : ui.textSecondary }]}>
              Start your journey by funding your{'\n'}account via MoMo. Secure transit{'\n'}payments at your fingertips.
            </Text>

            {/* CTA Buttons */}
            <View style={s.emptyCTAs}>
              <Button label="Add money now" icon={Plus} onPress={handleAuthAction} />
              <Button label="Connect MoMo account" variant="outline" onPress={handleAuthAction} />
            </View>
          </Animated.View>
        )}

        {/* ── Transactions (empty state) — only once we know there are none ── */}
        {!hasTransactions && (!isAuthenticated || hydrated) && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[s.section, { marginTop: 'auto' }]}>
            <SectionHeader title={tr('wallet.recentTransactions')} style={{ marginBottom: space.md }} />
            <View style={[s.txEmptyBox, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : ui.surfaceStrong }]}>
              <History size={28} color={isDark ? '#44403c' : ui.textTertiary} />
              <Text style={s.txEmptyText}>No transactions yet</Text>
            </View>
          </Animated.View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: space.gutter, marginBottom: space.section },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.md,
  },
  headerTitle: { ...type.title },

  // Balance card
  balanceCard: {
    borderRadius: radius.lg, padding: space.gutter, alignItems: 'center', overflow: 'hidden',
    backgroundColor: ui.card, ...cardShadow,
  },
  balanceCardDark: {
    backgroundColor: 'rgba(60,51,43,0.2)', shadowOpacity: 0, elevation: 0,
    borderWidth: 1, borderColor: 'rgba(255,77,28,0.1)',
  },
  balanceLabelText: { ...type.label, color: ui.textSecondary, marginBottom: space.xs },
  balanceCardBtns: { width: '100%', marginTop: space.xs },
  balanceAmountRow: { marginBottom: space.lg },
  creditedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: ui.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginBottom: 14,
  },
  creditedText: { ...type.labelStrong, color: ui.success },

  // Section
  sectionTitle: { ...type.title },
  viewAll: { ...type.labelStrong, color: brand.orangeText },
  passHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },

  // Active Pass
  passCard: { borderRadius: radius.lg, padding: space.xl, overflow: 'hidden', gap: space.gutter },
  passTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  passLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ui.onBrand },
  passLiveText: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  passRoute: { fontSize: 22, fontFamily: font.extrabold, color: ui.onBrand, letterSpacing: -0.5 },
  passBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  passFieldLabel: { ...type.caption, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  passFieldValue: { fontSize: 15, fontFamily: font.bold, color: ui.onBrand },
  passTripsLeft: {
    backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  passTripsText: { ...type.caption, fontFamily: font.bold, color: ui.onBrand },
  passPlate: { fontSize: 12, fontFamily: font.semibold, color: 'rgba(255,255,255,0.85)', marginTop: -12 },
  cancelPass: { alignSelf: 'center', marginTop: space.md, paddingVertical: 6, paddingHorizontal: space.md },
  cancelPassText: { ...type.labelStrong, color: ui.danger },
  myTicketsRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    marginHorizontal: space.gutter, marginBottom: space.section,
    backgroundColor: ui.card, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: 14,
    ...cardShadow,
  },
  myTicketsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  myTicketsText: { ...type.bodyMedium, color: ui.text },
  passDecorCircle: {
    position: 'absolute', left: -20, bottom: -20,
    width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Transactions
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: space.lg,
    borderRadius: radius.lg, marginBottom: space.sm, backgroundColor: ui.card, ...cardShadow,
  },
  txRowDark: { backgroundColor: 'rgba(60,51,43,0.2)', shadowOpacity: 0, elevation: 0 },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txLabel: { ...type.bodyMedium },
  txDate: { ...type.caption, color: ui.textSecondary, marginTop: 2 },
  txAmount: { ...type.bodyMedium, fontFamily: font.bold },

  // Loading skeleton
  skeletonWrap: { paddingHorizontal: space.gutter, paddingTop: space.gutter },
  skelBar: { backgroundColor: ui.surface, borderRadius: radius.sm },
  skelCard: { height: 72, borderRadius: radius.lg, backgroundColor: ui.surface },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.gutter, paddingVertical: space.xl },
  emptyWalletBox: {
    width: 96, height: 96, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center',
    backgroundColor: brand.orangeSoft, marginBottom: space.gutter,
  },
  emptyTitle: { ...type.title, marginBottom: 10 },
  emptySub: { fontSize: 15, fontFamily: font.regular, textAlign: 'center', lineHeight: 22 },
  emptyCTAs: { width: '100%', marginTop: space.section, gap: 10 },

  // Empty transactions
  txEmptyBox: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.lg,
    paddingVertical: space.section, alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  txEmptyText: { ...type.label, color: ui.textSecondary },
})
