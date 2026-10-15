import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Image, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import {
  ChevronLeft, ChevronRight, X, Wallet, ArrowRight, Bus, Clock,
  ShieldCheck, Star, BadgeCheck, Camera, UserCheck,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { formatGHS } from '@/lib/utils/currency'
import { font } from '@/lib/theme'
import InitialsAvatar from '@/components/InitialsAvatar'
import { TROTRO_BOOKING_ENABLED } from '@/lib/config/booking'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { fetchQueueStatus, type StationQueue } from '@/lib/services/queueStatus'
import { fetchAssignedVehicle, type AssignedVehicle } from '@/lib/services/fleet'
import { fetchDriverRatingStats, fetchDriverReviews, fetchDriverRides, type DriverReview } from '@/lib/services/driver-ratings'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { createBooking } from '@/lib/services/booking'
import { cacheWalletBalance } from '@/lib/services/walletCache'
import PinModal from '@/components/PinModal'
import { HeroText } from '@/components/HeroText'
import { SERVICE_FEE_INCL, splitServiceFee } from '@/lib/utils/serviceFee'
import { QueueGlyph } from '@/components/QueueGlyph'
import { QUEUE_WORD, QUEUE_COLOR } from '@/lib/constants/queueStatus'
import { authedFetch } from '@/lib/services/authedFetch'
import { pendingTopups, shortGHS, topupStatusHref, NETWORK_NAME, type PendingTopup } from '@/lib/services/topup'

// Amber = waiting on money that hasn't landed (C4).
const WAIT = '#B45309'
const WAIT_SOFT = '#FFFBEB'

const BRAND = '#FF4D1C'


const VERIFY_ITEMS = [
  { Icon: BadgeCheck, title: 'Driver Identification', desc: 'Drivers on Troski are registered with us' },
  { Icon: Camera, title: 'Driver Photo Check', desc: 'Your ticket is tied to this vehicle’s plate' },
  { Icon: UserCheck, title: 'Safety & Conduct Review', desc: 'Driver activity, commuter feedback, and ratings are continuously monitored to maintain a safe and reliable commuting experience' },
]


export default function CheckoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ from?: string; to?: string; route_id?: string; fare?: string }>()

  // A booking needs real route context — no placeholder names, ever (UX-02).
  const hasRouteContext = !!params.from && !!params.to
  const fromName = params.from || ''
  const toName = params.to || ''

  // Real fare for this route (crowdsourced avg, else official).
  const { route } = useRouteDetail(params.route_id || '')

  // ── Real-time route signals (no fake "departs in 5 mins") ──
  // Live trotros = operator vehicles broadcasting + riders sharing GO Mode.
  const { vehicles, activeCount } = useVehiclePositions(params.route_id || undefined)
  const liveRiders = useLiveTripPositions(params.route_id || undefined).length
  const liveTrotros = activeCount + liveRiders
  // The Troski bus actually serving this route right now (broadcasting via Troski Pro).
  const liveBus = vehicles.find((v) => !v.isStale) ?? null
  // The bus assigned to this route from the fleet (Phase 1 = own buses) — shows
  // the driver + plate at booking, before any live broadcast.
  const [assigned, setAssigned] = useState<AssignedVehicle | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchAssignedVehicle(params.from, params.to).then((a) => { if (!cancelled) setAssigned(a) }).catch(() => {})
    return () => { cancelled = true }
  }, [params.from, params.to])
  // Driver reputation (real, from passenger ratings + completed shifts)
  const [driverRating, setDriverRating] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 })
  const [driverRides, setDriverRides] = useState<number>(0)
  const [driverReviews, setDriverReviews] = useState<DriverReview[]>([])
  useEffect(() => {
    const id = assigned?.driverId
    if (!id) return
    let cancelled = false
    fetchDriverRatingStats(id).then((s) => { if (!cancelled) setDriverRating({ avg: s.avgRating, count: s.ratingCount }) }).catch(() => {})
    fetchDriverRides(id).then((n) => { if (!cancelled) setDriverRides(n) }).catch(() => {})
    fetchDriverReviews(id).then((r) => { if (!cancelled) setDriverReviews(r) }).catch(() => {})
    return () => { cancelled = true }
  }, [assigned?.driverId])
  // C3: trip time only when it is measured from commuter trips. Neither the
  // route's static estimate nor the Directions traffic ETA is, so none is shown.
  // Wait predictability — the #1 pain. Latest crowdsourced queue at the origin.
  const [originQueue, setOriginQueue] = useState<StationQueue | null>(null)
  useEffect(() => {
    let cancelled = false
    const origin = (params.from || '').trim().toLowerCase()
    if (!origin) return
    fetchQueueStatus(Date.now()).then((r) => {
      if (cancelled) return
      const match = r.stations.find((st) => {
        const n = st.stationName.toLowerCase()
        return n === origin || n.includes(origin) || origin.includes(n)
      })
      setOriginQueue(match && !match.isStale ? match : null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [params.from])
  // Prefer the fare the user was shown on the route screen (handles transfer
  // journeys whose total isn't recoverable from leg-0's route_id). Fall back to
  // the route's crowdsourced/official fare for entry points that pass no fare.
  const passedFare = params.fare != null && isFinite(parseFloat(params.fare)) ? parseFloat(params.fare) : null
  // No hardcoded fallback fare — if we don't know the fare, we don't charge one (UX-02).
  // The server charges routes.official_fare, so show that first (money safety, 2026-10-14).
  // A server-reported fare change (FARE_CHANGED) overrides everything below.
  const [serverBusFare, setServerBusFare] = useState<number | null>(null)
  const knownFare = serverBusFare ?? route?.official_fare ?? passedFare ?? route?.fare_stats?.avg_reported_fare ?? null
  const fareKnown = knownFare != null
  // C3: the fare carries its source — the server/official fare is GPRTU's,
  // anything else (passed-in or rider average) is an estimate.
  const fareIsOfficial = serverBusFare != null || route?.official_fare != null
  const busFare = knownFare ?? 0
  // Service fee is tax-inclusive (see lib/utils/serviceFee.ts); the VAT split lives on the receipt (C2).
  const { base: serviceBase, tax: serviceTax } = splitServiceFee()
  const fare = { bus: busFare, serviceBase, serviceTax, serviceIncl: SERVICE_FEE_INCL }
  const total = fare.bus + SERVICE_FEE_INCL

  const payment = 'wallet'
  const [showDriver, setShowDriver] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [booking, setBooking] = useState(false)
  const [pinVisible, setPinVisible] = useState(false)

  // Real wallet balance (same source as the Wallet tab) — replaces the old
  // hardcoded "GH₵ 2,500.00" mock.
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
  const { user } = useAuthContext()
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  // C4: a top-up started from THIS checkout that is still waiting for MoMo approval.
  // While it is pending (and the wallet is still short) Pay stays locked; it unlocks
  // only when the re-checked balance covers the total (i.e. the credit landed).
  const topupSinceRef = useRef<number | null>(null)
  const [pendingTopup, setPendingTopup] = useState<PendingTopup | null>(null)
  const [topupFailed, setTopupFailed] = useState(false)
  const lastTopupRefRef = useRef<string | null>(null)
  const fetchBalance = useCallback(async () => {
    if (!user?.id) { setBalanceLoading(false); return }
    try {
      const res = await authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${user.id}`)
      if (!res.ok) throw new Error(`wallet ${res.status}`)
      const data = await res.json()
      if (data.balance != null) setWalletBalance(Number(data.balance))
      const since = topupSinceRef.current
      if (since != null && Array.isArray(data.transactions)) {
        // 60s slack for phone/server clock skew.
        const mine = pendingTopups(data.transactions).filter((p) => new Date(p.createdAt).getTime() >= since - 60000)
        setPendingTopup(mine[0] ?? null)
        if (mine[0]) { lastTopupRefRef.current = mine[0].reference; setTopupFailed(false) }
        else if (lastTopupRefRef.current) {
          const tx = data.transactions.find((t: any) => t?.paystack_reference === lastTopupRefRef.current)
          setTopupFailed(tx?.status === 'failed')
        }
      }
    } catch { /* leave null → "Tap to check" */ }
    finally { setBalanceLoading(false) }
  }, [API_URL, user?.id])
  useEffect(() => { fetchBalance() }, [fetchBalance])
  // Re-check the balance when returning to checkout (e.g. after topping up) so
  // the button flips from "Top up" to "Pay" without a manual reload.
  useFocusEffect(useCallback(() => { fetchBalance() }, [fetchBalance]))
  const goTopup = (amount?: number) => {
    if (topupSinceRef.current == null) topupSinceRef.current = Date.now()
    router.push({ pathname: '/wallet/momo', params: { ...(amount ? { amount: String(Math.ceil(amount)) } : {}), return: 'checkout', pops: '1' } } as never)
  }
  // While a top-up is pending and this screen is focused, re-check every 5s
  // (20s once it's 3+ min old). One request at a time; stops on blur.
  const pendingRef = pendingTopup?.reference ?? null
  const pendingCreatedAt = pendingTopup?.createdAt ?? null
  useFocusEffect(useCallback(() => {
    if (!pendingRef) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      const age = Date.now() - new Date(pendingCreatedAt ?? Date.now()).getTime()
      timer = setTimeout(async () => {
        if (stopped) return
        await fetchBalance()
        if (!stopped) schedule()
      }, age >= 180000 ? 20000 : 5000)
    }
    schedule()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [pendingRef, pendingCreatedAt, fetchBalance]))

  // Wallet is the only wired payment method. MoMo was listed here before but
  // silently charged the wallet regardless — removed until actually wired (UX-15).
  // The source now sits right above the Pay button (C1).
  const insufficient = payment === 'wallet' && walletBalance != null && walletBalance < total
  // Short AND our top-up is still waiting: show "Waiting for top-up…", Pay locked.
  const awaitingCredit = insufficient && pendingTopup != null
  const shortfall = insufficient ? total - (walletBalance ?? 0) : 0
  // Don't let the user pay from the wallet until we know the balance — avoids a
  // silent overdraw path when the balance fetch is slow, timed out, or failed.
  const waitingBalance = payment === 'wallet' && balanceLoading
  const balanceUnknown = payment === 'wallet' && !balanceLoading && walletBalance == null

  // Pay → require the wallet PIN, then book. PIN protects spending if the phone
  // is unlocked by someone else.
  const payNow = () => {
    if (!user?.id || booking || !fareKnown || balanceUnknown || missingRouteId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setPinVisible(true)
  }

  // The actual booking: debits the wallet + issues a ticket on the backend,
  // then hands the real ticket to the processing/receipt flow.
  const bookingRef = useRef(false)
  // One idempotency key per payment attempt: a retry after a timeout reuses it (server replays
  // instead of charging twice); regenerated only after a successful booking.
  const idemKeyRef = useRef<string | null>(null)
  const newIdemKey = () => `trk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`
  const missingRouteId = !params.route_id
  // Only trotro trips are bookable (okada/pragya rides aren't live).
  const notTrotro = !!route?.transport_type && route.transport_type !== 'trotro'
  const notBookable = notTrotro || !TROTRO_BOOKING_ENABLED

  const doBooking = async () => {
    if (!user?.id || bookingRef.current || notBookable || !params.route_id) return
    bookingRef.current = true
    setBooking(true)
    if (!idemKeyRef.current) idemKeyRef.current = newIdemKey()
    const result = await createBooking({
      authUserId: user.id,
      routeLabel: `${fromName} → ${toName}`,
      routeId: params.route_id,
      idempotencyKey: idemKeyRef.current,
      pickupName: fromName,
      dropoffName: toName,
      vehicleType: 'everyday',
      fare: Number(total.toFixed(2)),
      plateNumber: assigned?.plate,
    })
    setBooking(false)
    bookingRef.current = false
    if (result.ok) {
      idemKeyRef.current = null
      // Home/Wallet paint from this snapshot on focus, so the debit shows at once.
      if (Number.isFinite(result.newBalance)) cacheWalletBalance(result.newBalance, user.id)
      router.push({
        pathname: '/booking/processing',
        params: {
          from: params.from ?? '', to: params.to ?? '',
          trip_code: result.ticket.trip_code,
          expires_at: result.ticket.expires_at,
          fare: String(result.ticket.fare),
          bus_fare: result.ticket.busFare != null ? String(result.ticket.busFare) : '',
          service_fee: result.ticket.serviceFee != null ? String(result.ticket.serviceFee) : '',
          booked_at: result.ticket.bookedAt ?? '',
          route_id: params.route_id ?? '',
          van: assigned?.vanId ?? '',
        },
      } as any)
    } else if (result.reason === 'fare_changed') {
      // Nothing was charged. Show the new price and let the rider confirm again.
      idemKeyRef.current = null
      setServerBusFare(Math.max(0, Number((result.total - SERVICE_FEE_INCL).toFixed(2))))
      Alert.alert('Fare updated', `The fare for this trip is now ${formatGHS(result.total)}. Review it and tap Pay again to confirm.`)
    } else if (result.reason === 'insufficient_balance') {
      Alert.alert('Insufficient balance', 'Top up your wallet to complete this booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Top up', onPress: () => goTopup() },
      ])
    } else {
      // A key reused with different trip details can never succeed: start a fresh attempt.
      if (result.conflict) idemKeyRef.current = null
      Alert.alert('Booking failed', (result.message || 'Could not complete the booking. Please try again.') + '\n\nIf money left your wallet, check My Tickets before trying again.')
    }
  }

  // Opened without route context (deep link / stale entry) — honest dead-end
  // instead of booking placeholder places at a placeholder fare (UX-02).
  if (!hasRouteContext) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', textAlign: 'center' }}>Route details missing</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
          Pick a route first, then book from its page.
        </Text>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as never) }}
          style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: BRAND }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (notBookable) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', textAlign: 'center' }}>{notTrotro ? 'Rides on this route are coming soon' : 'Trotro tickets are coming soon'}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
          {notTrotro
            ? 'You can book trotro trips today. The fares shown for this route are what riders report.'
            : 'Fares and routes are free to check. Pay the mate as usual for now.'}
        </Text>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as never) }}
          style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: BRAND }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={4} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
      </View>

      {/* paddingBottom clears the pinned pay-from + Pay footer. */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 190 }}>
        {/* ── Route card: route, trip shape, queue at the origin ── */}
        <View style={s.card}>
          <Text style={s.routeTitle}>{fromName} → {toName}</Text>
          <Text style={s.routeMeta}>
            {['Trotro', route?.stops?.length ? `${route.stops.length} stops` : null].filter(Boolean).join(' · ')}
          </Text>
          {originQueue ? (
            <View style={s.queueRow}>
              <QueueGlyph status={originQueue.status} color={QUEUE_COLOR[originQueue.status]} size={14} />
              <Text style={s.queueWord}>{QUEUE_WORD[originQueue.status]}</Text>
              <Text style={s.queueAge}>· reported {originQueue.ageMins < 1 ? 'just now' : `${originQueue.ageMins} min ago`}</Text>
            </View>
          ) : null}
          {liveTrotros > 0 && !assigned && (
            <View style={s.queueRow}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
              <Text style={s.queueAge}>{liveTrotros} trotro{liveTrotros === 1 ? '' : 's'} live on this route</Text>
            </View>
          )}
        </View>

        {/* ── Driver + plate (Phase 1 = own fleet). Reviews and "What Troski
              verifies" sit behind "About this driver" (C5). ── */}
        {(() => {
          const plate = liveBus?.plateNumber ?? assigned?.plate ?? null
          const driver = assigned?.driverName ?? null
          const live = !!liveBus
          const onShift = assigned?.isOnShift ?? false
          const statusWord = live ? 'Live' : onShift ? 'On shift' : 'Assigned'
          return (
            <View style={[s.card, s.driverCard]}>
              {driver && assigned?.driverPhotoUrl ? (
                <Image source={{ uri: assigned.driverPhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : driver ? (
                <InitialsAvatar name={driver} size={44} />
              ) : (
                <View style={s.busAvatar}>
                  <Bus size={22} color={plate ? '#16A34A' : '#6B7280'} />
                </View>
              )}
              {plate ? (
                <>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {live && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                      <Text style={s.driverRole} numberOfLines={1}>{driver ? `${driver} · ${statusWord}` : `Troski bus · ${statusWord}`}</Text>
                    </View>
                    <HeroText size={24} style={s.plate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{plate}</HeroText>
                  </View>
                  {driver && (
                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowDriver(true) }} style={s.aboutBtn} accessibilityRole="button">
                      <Text style={s.linkText}>About this driver</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : driver ? (
                /* Driver assigned, no plate yet: name + status, details still reachable */
                <>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.driverName} numberOfLines={1}>{driver}</Text>
                    <Text style={s.driverRole}>{statusWord}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowDriver(true) }} style={s.aboutBtn} accessibilityRole="button">
                    <Text style={s.linkText}>About this driver</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>Board any trotro on this route</Text>
                  <Text style={s.driverRole}>Show your QR ticket to the mate</Text>
                </View>
              )}
            </View>
          )
        })()}

        {/* ── Fare: source chip on the fare (C3), one service-fee line (C2) ── */}
        <View style={[s.card, { marginTop: 12 }]}>
          <View style={s.fareRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.fareLabel}>Fare</Text>
              {fareKnown && (
                <View style={[s.srcChip, fareIsOfficial ? s.srcChipGprtu : s.srcChipEst]}>
                  <Text style={[s.srcChipText, { color: fareIsOfficial ? '#15803D' : '#4B5563' }]}>{fareIsOfficial ? 'GPRTU fare' : 'estimate'}</Text>
                </View>
              )}
            </View>
            <Text style={s.fareValue}>{fareKnown ? formatGHS(fare.bus) : '—'}</Text>
          </View>
          <View style={s.fareRow}>
            <Text style={s.fareLabel}>Service fee <Text style={s.fareHint}>(incl. VAT)</Text></Text>
            <Text style={s.fareValue}>{formatGHS(fare.serviceIncl)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fareKnown ? formatGHS(total) : '—'}</Text>
          </View>
          {missingRouteId && (
            <Text style={s.warnText}>
              This trip can&apos;t be booked from here. Go back and open the route to book.
            </Text>
          )}
          {!fareKnown && (
            <Text style={s.warnText}>
              We couldn&apos;t load the fare for this route. Go back and reopen the route to book.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* ── Pinned: pay-from row (C1) + Pay. Only this bar changes between states. ── */}
      <View style={[s.payBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {awaitingCredit && pendingTopup ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(topupStatusHref({ ...pendingTopup, returnTo: 'checkout', pops: '1' }) as never)}
              style={s.waitRow}
              accessibilityRole="button"
              accessibilityLabel={`Waiting for top-up. Pay unlocks when ${NETWORK_NAME[pendingTopup.provider] ?? 'MoMo'} confirms. Open top-up`}
            >
              <Clock size={16} color={WAIT} />
              <Text style={s.waitText}>Waiting for top-up… unlocks when {NETWORK_NAME[pendingTopup.provider] ?? 'MoMo'} confirms</Text>
            </TouchableOpacity>
            <View style={[s.payBtn, s.payBtnOff]} accessible accessibilityRole="button" accessibilityLabel={`Pay ${formatGHS(total)}`} accessibilityState={{ disabled: true }}>
              <Text style={[s.payBtnText, { color: '#A8A29E' }]}>Pay {formatGHS(total)}</Text>
            </View>
          </>
        ) : insufficient ? (
          <>
            <View style={s.shortRow}>
              <Text style={s.shortText}>Short by {formatGHS(shortfall)}</Text>
              <Text style={s.shortWallet}>Wallet {formatGHS(walletBalance ?? 0)}</Text>
            </View>
            {topupFailed && (
              <Text style={s.topupFailedText}>{"Your top-up didn't go through. You can try again."}</Text>
            )}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                // Pre-fill the top-up with the shortfall (rounded up to a clean cedi).
                goTopup(shortfall)
              }}
              style={s.payBtn}
              accessibilityRole="button"
            >
              <Text style={s.payBtnText}>Top up {shortGHS(Math.max(1, Math.ceil(shortfall)))} and continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={!balanceUnknown}
              onPress={() => { Haptics.selectionAsync(); setBalanceLoading(true); fetchBalance() }}
              style={s.payFrom}
              accessibilityRole={balanceUnknown ? 'button' : 'text'}
              accessibilityLabel={
                balanceUnknown ? "Troski wallet. Couldn't load the balance. Tap to retry"
                  : walletBalance != null && fareKnown ? `Pay from Troski wallet. ${formatGHS(walletBalance)}, ${formatGHS(walletBalance - total)} after`
                  : 'Pay from Troski wallet'
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Wallet size={16} color="#111" />
                <Text style={s.payFromLabel}>Troski wallet</Text>
              </View>
              {waitingBalance ? (
                <Text style={s.payFromValue}>Checking balance…</Text>
              ) : balanceUnknown ? (
                <Text style={[s.payFromValue, { color: WAIT }]}>{"Couldn't load · tap to retry"}</Text>
              ) : walletBalance != null && fareKnown ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={s.payFromValue}>{formatGHS(walletBalance)}</Text>
                  <ArrowRight size={13} color="#6B7280" />
                  <Text style={[s.payFromValue, { fontFamily: font.bold, color: '#0A0A0A' }]}>{formatGHS(walletBalance - total)}</Text>
                  <Text style={s.payFromValue}>after</Text>
                </View>
              ) : walletBalance != null ? (
                <Text style={s.payFromValue}>{formatGHS(walletBalance)}</Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={booking || waitingBalance || !fareKnown || balanceUnknown || missingRouteId}
              onPress={payNow}
              style={[s.payBtn, (booking || waitingBalance || !fareKnown || balanceUnknown || missingRouteId) && s.payBtnOff]}
              accessibilityRole="button"
              accessibilityLabel={`Pay ${formatGHS(total)}`}
              accessibilityState={{ disabled: booking || waitingBalance || !fareKnown || balanceUnknown || missingRouteId }}
            >
              <Text style={[s.payBtnText, (booking || waitingBalance || !fareKnown || balanceUnknown || missingRouteId) && { color: '#A8A29E' }]}>
                {booking ? 'Processing…'
                  : missingRouteId ? 'Route unavailable'
                  : !fareKnown ? 'Fare unavailable'
                  : waitingBalance ? 'Checking balance…'
                  : balanceUnknown ? 'Balance unavailable'
                  : `Pay ${formatGHS(total)}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Driver Details modal ── */}
      <Modal visible={showDriver} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDriver(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity onPress={() => setShowDriver(false)} style={s.closeBtn} hitSlop={8}><X size={18} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
              <DriverHeader driver={assigned} rides={driverRides} rating={driverRating} onVerify={() => setShowVerify(true)} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 4 }}>
                <Text style={s.sectionTitle}>Reviews</Text>
                {driverRating.count > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Star size={14} color="#F5A623" fill="#F5A623" />
                    <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#111' }}>{driverRating.avg?.toFixed(1)}</Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280' }}>({driverRating.count})</Text>
                  </View>
                )}
              </View>
              {driverReviews.length > 0 ? (
                driverReviews.map((r, i) => (
                  <View key={i} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                    <View style={{ flexDirection: 'row', gap: 1, marginBottom: 6 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} color="#F5A623" fill={n <= r.stars ? '#F5A623' : 'transparent'} />
                      ))}
                    </View>
                    <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#6B7280', lineHeight: 19 }}>{r.comment}</Text>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 22, gap: 6 }}>
                  <Star size={26} color="#E5E7EB" fill="#E5E7EB" />
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#374151' }}>No reviews yet</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>Rate your driver after the trip — your feedback keeps the fleet accountable.</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Verification modal ── */}
      <Modal visible={showVerify} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowVerify(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity onPress={() => setShowVerify(false)} style={s.closeBtn} hitSlop={8}><X size={18} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
              <DriverHeader driver={assigned} rides={driverRides} rating={driverRating} onVerify={() => {}} />

              <View style={{ height: 6, backgroundColor: '#F3F4F6', marginHorizontal: -20, marginVertical: 22 }} />

              <Text style={{ fontFamily: font.bold, fontSize: 22, color: '#111', letterSpacing: -0.4, marginBottom: 18 }}>What Troski Verifies</Text>
              {VERIFY_ITEMS.map(({ Icon, title, desc }) => (
                <View key={title} style={{ flexDirection: 'row', gap: 14, marginBottom: 22 }}>
                  <View style={s.verifyIcon}><Icon size={20} color="#111" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#111', marginBottom: 4 }}>{title}</Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#6B7280', lineHeight: 19 }}>{desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Wallet PIN gate — set on first payment, verify thereafter */}
      <PinModal
        visible={pinVisible}
        subtitle={`Authorise ${formatGHS(total)} for this trip`}
        onClose={() => setPinVisible(false)}
        onSuccess={() => { setPinVisible(false); doBooking() }}
      />
    </SafeAreaView>
  )
}

/* ── Shared driver header (real assigned driver — avatar + stats + verification) ── */
function DriverHeader({ driver, rides, rating, onVerify }: { driver: AssignedVehicle | null; rides: number; rating: { avg: number | null; count: number }; onVerify: () => void }) {
  const name = driver?.driverName ?? 'Your driver'
  const since = driver?.driverSince ? new Date(driver.driverSince) : null
  const years = since ? Math.floor((Date.now() - since.getTime()) / (365 * 864e5)) : null
  const tenure = years != null && years >= 1 ? `${years} yr${years > 1 ? 's' : ''}` : 'New'
  const verified = driver?.kycVerified ?? false
  return (
    <View style={{ alignItems: 'center' }}>
      {driver?.driverPhotoUrl ? (
        <Image source={{ uri: driver.driverPhotoUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
      ) : (
        <InitialsAvatar name={name} size={88} fontSize={32} />
      )}
      <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', marginTop: 12 }}>{name}</Text>

      <View style={s.statsRow}>
        {[
          [rides > 0 ? String(rides) : '—', 'Rides'],
          [tenure, 'with Troski'],
          [rating.avg != null ? rating.avg.toFixed(1) : 'New', 'Rating'],
        ].map(([n, l], i) => (
          <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: '#F3F4F6' }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 20, color: BRAND }}>{n}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 2 }}>{l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={onVerify} style={s.verifyRow}>
        <ShieldCheck size={18} color={verified ? '#16A34A' : '#6B7280'} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: '#111', marginLeft: 10 }}>{verified ? 'Verification Completed' : 'Verification Pending'}</Text>
        <ChevronRight size={18} color="#6B7280" />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 52 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: '#111' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#EEEEEE' },

  routeTitle: { fontFamily: font.bold, fontSize: 18, color: '#0A0A0A', letterSpacing: -0.2 },
  routeMeta: { fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: 2 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  queueWord: { fontFamily: font.bold, fontSize: 14, color: '#0A0A0A' },
  queueAge: { fontFamily: font.medium, fontSize: 13, color: '#6B7280' },

  driverCard: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12, paddingVertical: 12 },
  busAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  driverName: { fontFamily: font.bold, fontSize: 15, color: '#111' },
  driverRole: { fontFamily: font.medium, fontSize: 12, color: '#6B7280' },
  plate: { color: '#0A0A0A', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  aboutBtn: { minHeight: 48, justifyContent: 'center', paddingLeft: 4 },
  linkText: { fontFamily: font.bold, fontSize: 13, color: '#C2360F' },

  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 20, marginBottom: 10 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  fareLabel: { fontFamily: font.medium, fontSize: 15, color: '#0A0A0A' },
  fareHint: { fontFamily: font.medium, fontSize: 13, color: '#6B7280' },
  fareValue: { fontFamily: font.semibold, fontSize: 15, color: '#111', fontVariant: ['tabular-nums'] },
  srcChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  srcChipGprtu: { backgroundColor: '#DCFCE7' },
  srcChipEst: { backgroundColor: '#F3F4F6' },
  srcChipText: { fontFamily: font.bold, fontSize: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  totalLabel: { fontFamily: font.extrabold, fontSize: 18, color: '#111' },
  totalValue: { fontFamily: font.extrabold, fontSize: 18, color: '#111', fontVariant: ['tabular-nums'] },
  warnText: { fontFamily: font.medium, fontSize: 13, color: '#B45309', marginTop: 8 },

  payBar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  payFrom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, minHeight: 24 },
  payFromLabel: { fontFamily: font.bold, fontSize: 14, color: '#0A0A0A' },
  payFromValue: { fontFamily: font.medium, fontSize: 14, color: '#6B7280', fontVariant: ['tabular-nums'] },
  payBtn: { height: 56, borderRadius: 14, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' },
  payBtnOff: { backgroundColor: '#E7E5E4' },
  payBtnText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  shortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
    backgroundColor: WAIT_SOFT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  shortText: { fontFamily: font.bold, fontSize: 14, color: WAIT },
  shortWallet: { fontFamily: font.medium, fontSize: 13, color: '#6B7280' },
  topupFailedText: { fontFamily: font.semibold, fontSize: 13, color: '#DC2626', textAlign: 'center', marginBottom: 8 },
  waitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, minHeight: 40,
    backgroundColor: WAIT_SOFT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  waitText: { fontFamily: font.bold, fontSize: 13, color: WAIT, flexShrink: 1 },

  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAF9', borderRadius: 16, paddingVertical: 14, marginTop: 18, width: '100%' },
  verifyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F1F0', borderRadius: 14, paddingHorizontal: 14, height: 52, marginTop: 14, width: '100%' },
  reviewInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginTop: 16, minHeight: 80 },
  verifyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
})
