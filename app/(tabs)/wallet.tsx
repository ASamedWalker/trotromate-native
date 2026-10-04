import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Eye, EyeOff, Plus, CheckCircle2, History, ShieldCheck, Ticket, ScanLine, Landmark, Undo2, Bus } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { MaterialIcons } from '@expo/vector-icons'
import { hasWalletPin } from '@/lib/services/walletPin'
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

// Tickets last hours, so today's expiry reads as a time ("2:46 AM").
function validUntil(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return formatPassExpiry(iso)
  const time = d.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
  const tomorrow = new Date(Date.now() + 86400000)
  if (d.toDateString() === new Date().toDateString()) return time
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`
  return `${d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })} ${time}`
}

// "Today" / "Yesterday" / "3 Oct" buckets, newest first (input is newest first).
function groupByDay(txs: any[]): { key: string; label: string; items: any[] }[] {
  const dayKey = (d: Date) => d.toDateString()
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  const groups: { key: string; label: string; items: any[] }[] = []
  for (const tx of txs) {
    const d = new Date(tx.created_at)
    if (isNaN(d.getTime())) continue
    const label = dayKey(d) === dayKey(today) ? 'Today'
      : dayKey(d) === dayKey(yesterday) ? 'Yesterday'
      : d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
    const key = dayKey(d)
    const existing = groups.find((g) => g.key === key)
    if (existing) existing.items.push(tx)
    else groups.push({ key, label, items: [tx] })
  }
  return groups
}

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
      if (!res.ok) throw new Error(`wallet ${res.status}`)
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
    // The tab stays mounted across sign-out/sign-in: drop the previous
    // account's numbers before seeding for this one.
    setBalance(0)
    setTransactions([])
    setPasses([])
    setHydrated(false)
    prevBalanceRef.current = null
    if (!user?.id) return
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

  // Refetch when returning from fund screen; reopen at the top so an active
  // ticket is the first thing the rider sees.
  const scrollRef = useRef<ScrollView>(null)
  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    fetchWallet()
  }, [fetchWallet]))

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

  const activePass = passes[0] ?? null
  // Never flash GH₵ 0.00 before the real balance arrives (or for a guest).
  const balanceText = !balanceVisible
    ? 'GH₵ ••••••'
    : isAuthenticated && hydrated ? formatGHS(balance) : 'GH₵ —'
  const [hasPin, setHasPin] = useState(false)
  useFocusEffect(useCallback(() => { hasWalletPin().then(setHasPin).catch(() => {}) }, []))

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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} />
        }
      >
        {/* ── Active ticket first: what a rider at the stop needs (B) ── */}
        {isAuthenticated && activePass && (
          <Animated.View entering={FadeInDown.duration(400)} style={s.section}>
            <View style={[s.ticketCard, isDark && s.ticketCardDark]}>
              <LinearGradient colors={[brand.orange, brand.orangePressed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ticketHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ticketKicker}>{tr('wallet.activePass').toUpperCase()} · READY TO BOARD</Text>
                  <Text style={s.ticketRoute} numberOfLines={1}>{activePass.route_label}</Text>
                </View>
                <Text style={s.ticketFare}>{formatGHS(activePass.fare)}</Text>
              </LinearGradient>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/wallet/ticket', params: { trip_code: activePass.trip_code } } as Href) }}
                style={s.ticketBody}
                accessibilityRole="button"
                accessibilityLabel={`Ticket ${activePass.route_label}. Open full screen to show the mate`}
              >
                {activePass.trip_code ? (
                  <View style={s.qrWrap}>
                    <QRCode value={activePass.trip_code} size={168} quietZone={8} backgroundColor="#FFFFFF" />
                  </View>
                ) : null}
                <Text style={[s.ticketCode, { color: isDark ? t.text : ui.text }]}>{activePass.trip_code}</Text>
                <Text style={s.ticketHint}>
                  Show this to the mate when you board{activePass.expires_at ? ` · valid until ${validUntil(activePass.expires_at)}` : ''}
                  {activePass.van_plate ? ` · Van ${activePass.van_plate}` : ''}
                </Text>
                <Text style={s.ticketFull}>Tap for full screen</Text>
              </TouchableOpacity>
              <View style={s.ticketActions}>
                <TouchableOpacity onPress={() => router.push('/wallet/tickets' as Href)} style={s.ticketLink} accessibilityRole="button">
                  <Text style={s.ticketLinkText}>{passes.length > 1 ? `${tr('wallet.myTickets')} (${passes.length})` : tr('wallet.myTickets')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={cancelling}
                  onPress={() => confirmCancel(activePass)}
                  style={s.ticketLink}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: cancelling }}
                >
                  <Text style={s.cancelPassText}>{cancelling ? 'Cancelling…' : 'Cancel & refund'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Balance: bold card like Home's (A), or a slim strip under a ticket ── */}
        {isAuthenticated && activePass ? (
          <View style={s.section}>
            <View style={[s.balanceStrip, isDark && s.ticketCardDark]}>
              <View>
                <Text style={s.stripLabel}>{tr('wallet.balance')}</Text>
                <Text style={[s.stripAmount, { color: isDark ? t.text : ui.text }]}>{balanceText}</Text>
              </View>
              <TouchableOpacity onPress={handleAuthAction} style={s.stripBtn} accessibilityRole="button" accessibilityLabel={tr('wallet.addMoney')}>
                <Plus size={18} color="#FFFFFF" />
                <Text style={s.stripBtnText}>{tr('wallet.addMoney')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={s.section}>
            <LinearGradient colors={[brand.orange, brand.orangePressed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.balanceCard}>
              <Text style={s.balanceLabelText}>{tr('wallet.balance')}</Text>
              <HeroText size={44} style={{ color: '#FFFFFF', letterSpacing: -1 }}>{balanceText}</HeroText>
              {isAuthenticated && (
                <View style={s.trustRow}>
                  <ShieldCheck size={15} color="#FFFFFF" />
                  <Text style={s.trustText}>
                    {hasPin ? 'PIN on · Secured by Paystack' : 'Secured by Paystack'}
                  </Text>
                </View>
              )}
              <View style={s.balanceDecor} />
            </LinearGradient>
          </Animated.View>
        )}

        {/* Credit celebration — appears when a top-up lands */}
        {credited != null && (
          <View style={s.section}>
            <Animated.View entering={FadeInDown.duration(300)} style={s.creditedBanner}>
              <CheckCircle2 size={16} color={ui.success} />
              <Text style={s.creditedText}>{formatGHS(credited)} added to your wallet</Text>
            </Animated.View>
          </View>
        )}

        {/* ── Quick actions (hidden under a ticket: the strip carries Topup) ── */}
        {isAuthenticated && !activePass && (
          <View style={[s.section, s.actionsRow]}>
            {[
              { key: 'topup', label: tr('wallet.addMoney'), Icon: Plus, onPress: handleAuthAction },
              { key: 'tickets', label: tr('wallet.myTickets'), Icon: Ticket, onPress: () => router.push('/wallet/tickets' as Href) },
              { key: 'history', label: 'History', Icon: History, onPress: () => router.push('/wallet/transactions' as Href) },
              { key: 'pay', label: 'Pay', Icon: ScanLine, soon: true, onPress: () => Alert.alert('Coming soon', 'Scan to pay is on the way. For now, book a trip and show your QR ticket.') },
            ].map((a) => (
              <TouchableOpacity
                key={a.key}
                onPress={() => { Haptics.selectionAsync(); a.onPress() }}
                style={[s.action, a.soon && { opacity: 0.55 }]}
                accessibilityRole="button"
                accessibilityLabel={a.soon ? `${a.label}, coming soon` : a.label}
                accessibilityState={{ disabled: !!a.soon }}
              >
                <View style={[s.actionCircle, isDark && s.ticketCardDark]}>
                  <a.Icon size={22} color={brand.orange} />
                  {a.soon && <View style={s.soonPill}><Text style={s.soonText}>Soon</Text></View>}
                </View>
                <Text style={[s.actionLabel, { color: isDark ? t.text : ui.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(isAuthenticated && hasTransactions) ? (
          /* ── Activity: one grouped list, badges only for pending/failed ── */
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.section}>
            <SectionHeader
              title={tr('wallet.recentTransactions')}
              action={transactions.length > (activePass ? 3 : 6) ? 'See all' : undefined}
              onAction={() => router.push('/wallet/transactions' as Href)}
              style={{ marginBottom: space.sm }}
            />
            {!hydrated ? (
              [0, 1, 2].map((i) => <SkeletonActivityItem key={`tx-skeleton-${i}`} isDark={isDark} />)
            ) : groupByDay(transactions.slice(0, activePass ? 3 : 6)).map((g) => (
              <View key={g.key} style={{ marginBottom: space.md }}>
                <Text style={s.dayLabel}>{g.label}</Text>
                <View style={[s.txGroup, isDark && s.ticketCardDark]}>
                  {g.items.map((tx: any, i: number) => {
                    const credit = tx.type === 'topup' || tx.type === 'refund'
                    const Icon = tx.type === 'topup' ? Landmark : tx.type === 'refund' ? Undo2 : Bus
                    const title = tx.type === 'topup'
                      ? 'MoMo top-up'
                      : String(tx.description || 'Payment').replace(/^(Booking|Refund):\s*/i, '').replace(/\bGHS\b/g, 'GH₵')
                    const kind = tx.type === 'topup' ? 'Top-up' : tx.type === 'refund' ? 'Refund' : 'Trotro ticket'
                    const time = new Date(tx.created_at).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
                    const badge = tx.status && tx.status !== 'success'
                      ? String(tx.status).charAt(0).toUpperCase() + String(tx.status).slice(1).toLowerCase()
                      : null
                    return (
                      <View
                        key={tx.id}
                        style={[s.txRow, i < g.items.length - 1 && s.txDivider]}
                        accessible
                        accessibilityLabel={`${title}, ${credit ? 'plus' : 'minus'} ${formatGHS(Number(tx.amount))}, ${time}${badge ? `, ${badge}` : ''}`}
                      >
                        <View style={[s.txIcon, { backgroundColor: credit ? '#ECFDF3' : brand.orangeSoft }]}>
                          <Icon size={19} color={credit ? ui.success : brand.orange} />
                        </View>
                        <View style={s.txInfo}>
                          <Text style={[s.txLabel, { color: isDark ? t.text : ui.text }]} numberOfLines={1}>{title}</Text>
                          <View style={s.txSubRow}>
                            <Text style={s.txDate}>{time} · {kind}</Text>
                            {badge && <Badge label={badge} tone={tx.status === 'pending' ? 'warning' : 'danger'} />}
                          </View>
                        </View>
                        <Text style={[s.txAmount, { color: credit ? ui.success : (isDark ? t.text : ui.text) }]}>
                          {`${credit ? '+' : '−'}${formatGHS(Number(tx.amount))}`}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ))}
          </Animated.View>
        ) : (isAuthenticated && (activePass || balance > 0)) ? null : (isAuthenticated && !hydrated) ? (
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
              <MaterialIcons name="account-balance-wallet" size={36} color={brand.orange} />
            </View>

            {/* Text */}
            <Text style={[s.emptyTitle, { color: isDark ? t.text : ui.text }]}>Your wallet is quiet.</Text>
            <Text style={[s.emptySub, { color: isDark ? '#78716c' : ui.textSecondary }]}>
              Start your journey by funding your{'\n'}account via MoMo. Secure transit{'\n'}payments at your fingertips.
            </Text>

            {/* CTA Buttons */}
            <View style={s.emptyCTAs}>
              <Button label="Topup now" icon={Plus} onPress={handleAuthAction} />
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

  // Balance card — same bold orange card as Home (A)
  balanceCard: {
    borderRadius: radius.xl, padding: space.gutter, overflow: 'hidden', gap: 2,
    shadowColor: brand.orange, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  balanceLabelText: { ...type.label, color: 'rgba(255,255,255,0.92)' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  trustText: { ...type.caption, fontFamily: font.semibold, color: 'rgba(255,255,255,0.95)' },
  balanceDecor: {
    position: 'absolute', right: -40, top: -40,
    width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  creditedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: ui.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  creditedText: { ...type.labelStrong, color: ui.success },

  // Quick actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { flex: 1, alignItems: 'center', gap: 6, minHeight: 44 },
  actionCircle: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: ui.card,
    alignItems: 'center', justifyContent: 'center', ...cardShadow,
  },
  actionLabel: { ...type.labelStrong },
  soonPill: {
    position: 'absolute', top: -6, right: -10, backgroundColor: ui.text,
    borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1,
  },
  soonText: { fontSize: 10, fontFamily: font.bold, color: ui.onBrand },

  // Active ticket (B) — leads the screen when there is one
  ticketCard: { backgroundColor: ui.card, borderRadius: radius.xl, overflow: 'hidden', ...cardShadow },
  ticketCardDark: { backgroundColor: 'rgba(60,51,43,0.35)', shadowOpacity: 0, elevation: 0 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  ticketKicker: { ...type.caption, fontFamily: font.bold, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.4 },
  ticketRoute: { fontSize: 21, fontFamily: font.extrabold, color: ui.onBrand, letterSpacing: -0.3 },
  ticketFare: { fontSize: 17, fontFamily: font.extrabold, color: ui.onBrand },
  ticketBody: { alignItems: 'center', gap: 6, paddingTop: space.lg, paddingHorizontal: space.lg },
  qrWrap: { backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: 6 },
  ticketCode: { fontSize: 17, fontFamily: font.extrabold, letterSpacing: 1, marginTop: 4 },
  ticketHint: { ...type.caption, color: ui.textSecondary, textAlign: 'center' },
  ticketFull: { ...type.labelStrong, color: brand.orangeText },
  ticketActions: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, paddingVertical: space.sm },
  ticketLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  ticketLinkText: { ...type.labelStrong, color: brand.orangeText },
  cancelPassText: { ...type.labelStrong, color: ui.danger },

  // Slim balance strip under an active ticket
  balanceStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: ui.card, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md,
    ...cardShadow,
  },
  stripLabel: { ...type.caption, color: ui.textSecondary },
  stripAmount: { fontSize: 24, fontFamily: font.extrabold },
  stripBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
    backgroundColor: brand.orange, borderRadius: radius.md, paddingHorizontal: space.lg,
  },
  stripBtnText: { ...type.labelStrong, color: '#FFFFFF' },

  // Activity — one grouped list per day
  dayLabel: { ...type.caption, fontFamily: font.bold, color: ui.textSecondary, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  txGroup: { backgroundColor: ui.card, borderRadius: radius.lg, overflow: 'hidden', ...cardShadow },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, paddingVertical: 12 },
  txDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.surfaceStrong },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, minWidth: 0 },
  txLabel: { ...type.bodyMedium, fontFamily: font.bold },
  txSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  txDate: { ...type.caption, color: ui.textSecondary },
  txAmount: { ...type.bodyMedium, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },

  // Loading skeleton
  skeletonWrap: { paddingHorizontal: space.gutter, paddingTop: space.gutter },
  skelBar: { backgroundColor: ui.surface, borderRadius: radius.sm },
  skelCard: { height: 72, borderRadius: radius.lg, backgroundColor: ui.surface },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.gutter, paddingVertical: space.md },
  emptyWalletBox: {
    width: 72, height: 72, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center',
    backgroundColor: brand.orangeSoft, marginBottom: space.gutter,
  },
  emptyTitle: { ...type.title, marginBottom: 10 },
  emptySub: { fontSize: 15, fontFamily: font.regular, textAlign: 'center', lineHeight: 22 },
  emptyCTAs: { width: '100%', marginTop: space.gutter, gap: 10 },

  // Empty transactions
  txEmptyBox: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.lg,
    paddingVertical: space.section, alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  txEmptyText: { ...type.label, color: ui.textSecondary },
})
