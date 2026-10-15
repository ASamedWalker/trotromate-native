import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { Plus, CheckCircle2, History, Lock, Ticket, Clock, ChevronRight } from 'lucide-react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { hasWalletPin } from '@/lib/services/walletPin'
import { font, themed, brand, ui, space, radius, type } from '@/lib/theme'
import { Button } from '@/components/ui'
import { WalletCard } from '@/components/WalletCard'
import { AdinkraAccent, AdinkraBand, ADINKRA_BAND_DAY, ADINKRA_INK_NIGHT } from '@/components/AdinkraAccent'
import { useWalletCardTheme } from '@/lib/hooks/useWalletCardTheme'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { formatGHS } from '@/lib/utils/currency'
import { hhmm } from '@/lib/utils/clock'
import { txView, txDetailHref, TX_TONE, TX_PILL } from '@/lib/utils/walletTx'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { normalizeActivePasses, type ActivePass } from '@/lib/services/tickets'
import { cacheActivePasses, getCachedPasses } from '@/lib/services/ticketCache'
import { cacheWallet, getCachedWallet } from '@/lib/services/walletCache'
import { useLanguage } from '@/lib/i18n'
import { SkeletonActivityItem } from '@/components/Skeleton'
import * as Haptics from 'expo-haptics'
import { authedFetch } from '@/lib/services/authedFetch'
import { pendingTopups, shortGHS, topupStatusHref, NETWORK_NAME } from '@/lib/services/topup'

// Amber = money that hasn't landed yet (W1). Never green.
const WAIT = '#B45309'
const WAIT_SOFT = '#FFFBEB'

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
  const { theme: cardTheme } = useWalletCardTheme()
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
  // W5: "Updated 12:26" once the server confirms the balance; "Checking…" while it loads.
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [checking, setChecking] = useState(false)

  // "GH₵ X added ✓" moment — until the MoMo webhook lands, detect credits by
  // comparing balances across refetches (focus + pull-to-refresh). Lyft's
  // payment-trust principle: make the money moment explicit, never silent.
  const prevBalanceRef = useRef<number | null>(null)
  const [credited, setCredited] = useState<number | null>(null)
  const creditTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (creditTimer.current) clearTimeout(creditTimer.current) }, [])

  const fetchWallet = useCallback(async () => {
    if (!user?.id) return
    setChecking(true)
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
        setUpdatedAt(new Date())
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
    finally { setHydrated(true); setChecking(false) }
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
    setUpdatedAt(null)
    prevBalanceRef.current = null
    if (!user?.id) return
    getCachedPasses().then((cached) => {
      const live = normalizeActivePasses(cached, Date.now())
      if (live.length) setPasses((cur) => (cur.length ? cur : live))
    })
    getCachedWallet(user?.id).then((snap) => {
      if (!snap) return
      setBalance((cur) => (cur > 0 ? cur : snap.balance))
      setTransactions((cur) => (cur.length ? cur : snap.transactions))
      if (snap.balance > 0 || snap.transactions.length) setHydrated(true)
    })
  }, [user?.id])

  useEffect(() => { fetchWallet() }, [fetchWallet])

  // Refetch when returning from fund screen; reopen at the top.
  const scrollRef = useRef<ScrollView>(null)
  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    fetchWallet()
  }, [fetchWallet]))

  const handleAuthAction = () => {
    if (!isAuthenticated) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.push('/auth/phone' as Href)
      return
    }
    // Authenticated — go to fund wallet
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/wallet/momo' as Href)
  }

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    await fetchWallet()
    setRefreshing(false)
  }

  const activePass = passes[0] ?? null
  // Top-ups whose MoMo prompt is still waiting for approval (last hour).
  const pending = isAuthenticated ? pendingTopups(transactions) : []
  // Never flash GH₵ 0.00 before the real balance arrives (or for a guest).
  const balanceText = !balanceVisible
    ? 'GH₵ ••••••'
    : isAuthenticated && hydrated ? formatGHS(balance) : 'GH₵ —'
  const balanceNote = !isAuthenticated ? undefined
    : checking && !updatedAt ? 'Checking…'
    : updatedAt ? `Updated ${hhmm(updatedAt)}` : undefined
  const [hasPin, setHasPin] = useState(false)
  useFocusEffect(useCallback(() => { hasWalletPin().then(setHasPin).catch(() => {}) }, []))

  const toggleBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setBalanceVisible(!balanceVisible)
  }

  const openTicket = (pass: ActivePass) => {
    Haptics.selectionAsync()
    router.push({ pathname: '/wallet/ticket', params: { trip_code: pass.trip_code } } as Href)
  }

  const textColor = isDark ? t.text : ui.text

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#19120b' : ADINKRA_BAND_DAY }]} edges={['top']}>
      {/* Header on the Adinkra band */}
      <AdinkraBand bg={isDark ? '#19120b' : undefined} ink={isDark ? ADINKRA_INK_NIGHT : undefined} patternHeight={110} style={s.header}>
        <Text style={[s.headerTitle, { color: t.text }]}>{tr('wallet.title')}</Text>
      </AdinkraBand>

      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: isDark ? '#19120b' : ui.bg }}
        showsVerticalScrollIndicator={false}
        // W6: tab-bar height + 24 (TAB_BAR_CLEARANCE = 72 bar + 24) + the bar's
        // own bottom offset, so the last row never sits under the floating bar.
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE + Math.max(insets.bottom, 16) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} />
        }
      >
        {/* ── Balance card (owner rule: keep the card art) ── */}
        <View style={[s.sectionTight, { gap: space.sm }]}>
          <WalletCard
            theme={cardTheme}
            onPressCard={() => router.push('/wallet/card' as Href)}
            label={tr('wallet.balance')}
            balanceText={balanceText}
            balanceVisible={balanceVisible}
            onToggleBalance={toggleBalance}
            splitPesewas={balanceVisible && isAuthenticated && hydrated}
            footnote={balanceNote}
            footnoteColor={ui.textTertiary}
          />
          {isAuthenticated && (
            <View style={s.trustRow}>
              <Lock size={14} color={ui.textSecondary} />
              <Text style={s.trustText}>{hasPin ? 'Secured by Paystack · PIN on' : 'Secured by Paystack'}</Text>
            </View>
          )}
        </View>

        {/* ── Pending top-ups: amber strip per prompt still waiting (max 2) ── */}
        {pending.length > 0 && (
          <View style={[s.sectionTight, { gap: space.sm }]}>
            {pending.slice(0, 2).map((p) => {
              const net = NETWORK_NAME[p.provider] ?? 'MoMo'
              const sent = hhmm(p.createdAt)
              return (
                <TouchableOpacity
                  key={p.reference}
                  activeOpacity={0.85}
                  onPress={() => { Haptics.selectionAsync(); router.push(topupStatusHref(p) as never) }}
                  style={s.pendingStrip}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortGHS(p.amount)} top-up waiting for you to approve. Sent ${sent}. Open`}
                >
                  {/* Sankofa (go back and get it): come back and approve. Faint corner mark. */}
                  <AdinkraAccent symbol="sankofa" size={60} color={WAIT} opacity={0.08} position="bottomRight" inset={-14} rotate={-8} />
                  <Clock size={20} color={WAIT} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.pendingTitle}>{shortGHS(p.amount)} top-up waiting for you to approve</Text>
                    <Text style={s.pendingSub}>Check your {net} phone for the prompt · sent {sent}</Text>
                  </View>
                  <ChevronRight size={18} color={ui.textTertiary} />
                </TouchableOpacity>
              )
            })}
            {pending.length > 2 && (
              <TouchableOpacity onPress={() => router.push('/wallet/transactions' as Href)} style={s.pendingMore} accessibilityRole="button">
                <Text style={s.pendingMoreText}>+{pending.length - 2} more waiting</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Credit celebration — appears when a top-up lands */}
        {credited != null && (
          <View style={s.sectionTight}>
            <View style={s.creditedBanner}>
              <CheckCircle2 size={16} color={ui.success} />
              <Text style={s.creditedText}>{formatGHS(credited)} added to your wallet</Text>
            </View>
          </View>
        )}

        {/* ── W2: three live actions ── */}
        {isAuthenticated && (
          <View style={[s.sectionTight, s.actionsRow]}>
            {[
              { key: 'topup', label: tr('wallet.addMoney'), Icon: Plus, badge: 0, onPress: handleAuthAction },
              { key: 'tickets', label: 'Tickets', Icon: Ticket, badge: passes.length, onPress: () => router.push('/wallet/tickets' as Href) },
              { key: 'history', label: 'History', Icon: History, badge: 0, onPress: () => router.push('/wallet/transactions' as Href) },
            ].map((a) => (
              <TouchableOpacity
                key={a.key}
                onPress={() => { Haptics.selectionAsync(); a.onPress() }}
                style={s.action}
                accessibilityRole="button"
                accessibilityLabel={a.badge ? `${a.label}, ${a.badge} active` : a.label}
              >
                <View style={s.actionCircle}>
                  <a.Icon size={24} color={brand.orangeText} />
                  {a.badge > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{a.badge}</Text></View>
                  )}
                </View>
                <Text style={[s.actionLabel, { color: textColor }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── W3: active ticket row ── */}
        {isAuthenticated && activePass && (
          <View style={s.sectionTight}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openTicket(activePass)}
              style={s.passRow}
              accessibilityRole="button"
              accessibilityLabel={`Ticket ${activePass.route_label}${activePass.expires_at ? `, valid till ${hhmm(activePass.expires_at)}` : ''}. Show`}
            >
              {/* Gye Nyame peeking from the left edge, behind the ticket icon (Show stays clean). */}
              <AdinkraAccent symbol="gye_nyame" size={64} color={brand.orange} opacity={0.07} position="topLeft" inset={-18} rotate={-12} />
              <Ticket size={22} color={brand.orange} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.passRoute, { color: textColor }]} numberOfLines={1}>{activePass.route_label}</Text>
                <Text style={s.passSub}>{activePass.expires_at ? `Valid till ${hhmm(activePass.expires_at)}` : 'Valid'}</Text>
              </View>
              <View style={s.showBtn}><Text style={s.showText}>Show</Text></View>
            </TouchableOpacity>
          </View>
        )}

        {(isAuthenticated && hasTransactions) ? (
          /* ── W4: recent activity, grouped by day ── */
          <View style={s.section}>
            <View style={s.activityHead}>
              <Text style={[s.activityTitle, { color: textColor }]}>Recent activity</Text>
              <TouchableOpacity onPress={() => router.push('/wallet/transactions' as Href)} hitSlop={12} accessibilityRole="button">
                <Text style={s.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {!hydrated ? (
              [0, 1, 2].map((i) => <SkeletonActivityItem key={`tx-skeleton-${i}`} isDark={isDark} />)
            ) : groupByDay(transactions.slice(0, 6)).map((g) => (
              <View key={g.key}>
                <Text style={s.dayLabel}>{g.label}</Text>
                {g.items.map((tx) => {
                  const v = txView(tx)
                  const tone = TX_TONE[v.tone]
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      activeOpacity={0.6}
                      onPress={() => { Haptics.selectionAsync(); router.push(txDetailHref(tx) as never) }}
                      style={s.txRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.title}, ${v.amountText.replace('−', 'minus ').replace('+', 'plus ')}, ${v.sub}${v.pill ? `, ${v.pill}` : ''}`}
                    >
                      <View style={[s.txIcon, { backgroundColor: tone.bg }]}>
                        <v.Icon size={20} color={tone.fg} />
                      </View>
                      <View style={s.txInfo}>
                        <Text style={[s.txLabel, { color: textColor }]} numberOfLines={1}>{v.title}</Text>
                        <Text style={s.txDate} numberOfLines={1}>{v.sub}</Text>
                      </View>
                      <View style={s.txRight}>
                        <Text style={[s.txAmount, { color: v.amountColor }, v.strike && { textDecorationLine: 'line-through' }]}>
                          {v.amountText}
                        </Text>
                        {v.pill && (
                          <View style={[s.pill, { backgroundColor: TX_PILL[v.pill].bg }]}>
                            <Text style={[s.pillText, { color: TX_PILL[v.pill].fg }]}>{v.pill}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
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
          <View style={s.emptyContainer}>
            <View style={s.emptyWalletBox}>
              <MaterialIcons name="account-balance-wallet" size={36} color={brand.orange} />
            </View>
            <Text style={[s.emptyTitle, { color: textColor }]}>Your wallet is quiet.</Text>
            <Text style={[s.emptySub, { color: isDark ? '#78716c' : ui.textSecondary }]}>
              Start your journey by funding your{'\n'}account via MoMo. Secure transit{'\n'}payments at your fingertips.
            </Text>
            <View style={s.emptyCTAs}>
              <Button label="Top up now" icon={Plus} onPress={handleAuthAction} />
              <Button label="Connect MoMo account" variant="outline" onPress={handleAuthAction} />
            </View>
          </View>
        )}

        {/* ── Transactions (empty state) — only once we know there are none ── */}
        {!hasTransactions && (!isAuthenticated || hydrated) && (
          <View style={[s.section, { marginTop: 'auto' }]}>
            <Text style={[s.activityTitle, { color: textColor, marginBottom: space.md }]}>Recent activity</Text>
            <View style={[s.txEmptyBox, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : ui.surfaceStrong }]}>
              <History size={28} color={isDark ? '#44403c' : ui.textTertiary} />
              <Text style={s.txEmptyText}>No transactions yet</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: space.gutter, marginBottom: space.section },
  sectionTight: { paddingHorizontal: space.gutter, marginBottom: space.lg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.md,
  },
  headerTitle: { ...type.title },

  // Trust line under the card
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { ...type.caption, fontFamily: font.semibold, color: ui.textSecondary },
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

  // Pending top-up strip (amber, W1)
  pendingStrip: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72,
    backgroundColor: WAIT_SOFT, borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A',
    paddingHorizontal: 14, paddingVertical: space.md, overflow: 'hidden',
  },
  pendingTitle: { fontFamily: font.bold, fontSize: 15, color: ui.text },
  pendingSub: { ...type.caption, color: ui.textSecondary, marginTop: 1 },
  pendingMore: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  pendingMoreText: { ...type.labelStrong, color: WAIT },

  // Quick actions (W2)
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { flex: 1, alignItems: 'center', gap: 6, minHeight: 48 },
  actionCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: brand.orangeSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: ui.text, borderWidth: 2, borderColor: ui.bg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: font.extrabold, fontSize: 12, color: '#FFFFFF' },
  actionLabel: { fontFamily: font.bold, fontSize: 14 },

  // Active ticket row (W3)
  passRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64,
    backgroundColor: '#FFF8F5', borderWidth: 1, borderColor: '#FFD6C7', borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: space.md, overflow: 'hidden',
  },
  passRoute: { fontFamily: font.bold, fontSize: 15 },
  passSub: { ...type.caption, color: ui.textSecondary },
  showBtn: { height: 40, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  showText: { fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' },

  // Activity — rows straight on the page, grouped per day (W4)
  activityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityTitle: { fontFamily: font.bold, fontSize: 18, letterSpacing: -0.2 },
  seeAll: { ...type.labelStrong, fontFamily: font.bold, color: brand.orangeText },
  dayLabel: { fontFamily: font.bold, fontSize: 12, color: ui.textTertiary, letterSpacing: 0.6, marginTop: space.md, textTransform: 'uppercase' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,
    borderBottomWidth: 1, borderBottomColor: '#F0EFED',
  },
  txIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, minWidth: 0 },
  txLabel: { fontFamily: font.bold, fontSize: 15 },
  txDate: { ...type.caption, color: ui.textSecondary },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontFamily: font.extrabold, fontSize: 15, fontVariant: ['tabular-nums'] },
  pill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pillText: { fontFamily: font.bold, fontSize: 12 },

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
