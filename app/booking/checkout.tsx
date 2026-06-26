import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import {
  ArrowLeft, ChevronRight, Ticket, Plus, Check, X,
  ShieldCheck, Star, BadgeCheck, Camera, UserCheck,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { formatGHS } from '@/lib/utils/currency'
import { font } from '@/lib/theme'
import InitialsAvatar from '@/components/InitialsAvatar'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { fetchRouteTraffic } from '@/lib/services/traffic-api'
import { fetchQueueStatus, QUEUE_META, type StationQueue } from '@/lib/services/queueStatus'
import { fetchAssignedVehicle, type AssignedVehicle } from '@/lib/services/fleet'
import { fetchDriverRatingStats, fetchDriverReviews, fetchDriverRides, type DriverReview } from '@/lib/services/driver-ratings'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { createBooking } from '@/lib/services/booking'
import PinModal from '@/components/PinModal'
import { Bus, Clock, Users as UsersIcon } from 'lucide-react-native'

const BRAND = '#FF4D1C'


const VERIFY_ITEMS = [
  { Icon: BadgeCheck, title: 'Driver Identification', desc: 'We verify every driver’s identity using valid government-issued identification' },
  { Icon: Camera, title: 'Driver Photo Check', desc: 'Drivers regularly submit live photo confirmation to help prevent impersonation' },
  { Icon: UserCheck, title: 'Safety & Conduct Review', desc: 'Driver activity, commuter feedback, and ratings are continuously monitored to maintain a safe and reliable commuting experience' },
]


export default function CheckoutScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; route_id?: string; fare?: string }>()

  const fromName = params.from || 'Kaneshie Terminal'
  const toName = params.to || 'Kumasi Central'

  // Real fare for this route (crowdsourced avg, else official). Falls back to a
  // placeholder only when no route context was passed.
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
  const durationMin = route?.estimated_duration_mins ?? null
  const [traffic, setTraffic] = useState<{ condition: string; etaMin: number | null } | null>(null)
  useEffect(() => {
    if (!params.route_id) return
    let cancelled = false
    fetchRouteTraffic(params.route_id).then((d) => {
      if (cancelled || !d) return
      setTraffic({ condition: d.traffic_condition ?? '', etaMin: d.duration_in_traffic_mins })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [params.route_id])
  const etaMin = traffic?.etaMin ?? durationMin
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
  const busFare = passedFare ?? route?.fare_stats?.avg_reported_fare ?? route?.official_fare ?? 25.0
  // Ghana VAT Act 2025 (Act 1151): public passenger transport is VAT-exempt, so
  // the trotro fare carries no tax (it's the driver's takings). Troski's platform
  // service fee IS a taxable supply → 15% VAT + 2.5% NHIL + 2.5% GETFund (≈20%).
  // The service fee is tax-INCLUSIVE, so the rider's total is unchanged.
  const SERVICE_FEE_INCL = 0.25
  const TAX_RATE = 0.20
  const serviceBase = SERVICE_FEE_INCL / (1 + TAX_RATE)
  const serviceTax = SERVICE_FEE_INCL - serviceBase
  const fare = { bus: busFare, serviceBase, serviceTax, serviceIncl: SERVICE_FEE_INCL }
  const total = fare.bus + SERVICE_FEE_INCL

  const [payment, setPayment] = useState('wallet')
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
  const fetchBalance = useCallback(async () => {
    if (!user?.id) { setBalanceLoading(false); return }
    try {
      const res = await fetch(`${API_URL}/api/wallet/balance?auth_user_id=${user.id}`)
      const data = await res.json()
      if (data.balance != null) setWalletBalance(Number(data.balance))
    } catch { /* leave null → "Tap to check" */ }
    finally { setBalanceLoading(false) }
  }, [API_URL, user?.id])
  useEffect(() => { fetchBalance() }, [fetchBalance])
  // Re-check the balance when returning to checkout (e.g. after topping up) so
  // the button flips from "Top up" to "Pay" without a manual reload.
  useFocusEffect(useCallback(() => { fetchBalance() }, [fetchBalance]))

  const payments = [
    { id: 'wallet', label: 'Troski Wallet', sub: walletBalance != null ? formatGHS(walletBalance) : 'Balance unavailable' },
    { id: 'momo', label: 'MTN MoMo', sub: 'Pay with mobile money' },
  ]
  const insufficient = payment === 'wallet' && walletBalance != null && walletBalance < total
  const shortfall = insufficient ? total - (walletBalance ?? 0) : 0
  // Don't let the user pay from the wallet until we know the balance — avoids a
  // silent overdraw path when the balance fetch is slow or timed out.
  const waitingBalance = payment === 'wallet' && balanceLoading

  // Pay → require the wallet PIN, then book. PIN protects spending if the phone
  // is unlocked by someone else.
  const payNow = () => {
    if (!user?.id || booking) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setPinVisible(true)
  }

  // The actual booking: debits the wallet + issues a ticket on the backend,
  // then hands the real ticket to the processing/receipt flow.
  const bookingRef = useRef(false)
  const doBooking = async () => {
    if (!user?.id || bookingRef.current) return
    bookingRef.current = true
    setBooking(true)
    const result = await createBooking({
      authUserId: user.id,
      routeLabel: `${fromName} → ${toName}`,
      pickupName: fromName,
      dropoffName: toName,
      vehicleType: 'everyday',
      fare: Number(total.toFixed(2)),
    })
    setBooking(false)
    bookingRef.current = false
    if (result.ok) {
      router.push({
        pathname: '/booking/processing',
        params: {
          from: params.from ?? '', to: params.to ?? '',
          trip_code: result.ticket.trip_code,
          expires_at: result.ticket.expires_at,
          fare: String(result.ticket.fare),
          route_id: params.route_id ?? '',
          van: assigned?.vanId ?? '',
        },
      } as any)
    } else if (result.reason === 'insufficient_balance') {
      Alert.alert('Insufficient balance', 'Top up your wallet to complete this booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Top up', onPress: () => router.push('/wallet/fund' as never) },
      ])
    } else {
      Alert.alert('Booking failed', result.message || 'Could not complete the booking. Please try again.')
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confirm Booking</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {/* ── Route + details card ── */}
        <View style={s.card}>
          {/* From → To */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.tinyLabel}>From</Text>
              <Text style={s.placeName}>{fromName}</Text>
            </View>
            <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
              <View style={s.dash} />
              <View style={s.busBadge}>
                <Image source={require('@/assets/images/home/bus_icon_bg_removed.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
              </View>
              <View style={s.dash} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.tinyLabel, { textAlign: 'right' }]}>To</Text>
              <Text style={[s.placeName, { textAlign: 'right' }]}>{toName}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Route status — assigned bus capacity (Phase 1 fleet), or live count */}
          <View style={[s.detailRow, { paddingTop: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bus size={16} color="#374151" />
              <Text style={s.detailLabel}>{assigned ? 'Bus' : 'Live trotros'}</Text>
            </View>
            {assigned ? (
              <Text style={s.detailValue}>{assigned.capacity ? `${assigned.capacity}-seater` : 'Trotro'}{assigned.vehicleType ? ` · ${assigned.vehicleType}` : ''}</Text>
            ) : liveTrotros > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
                <Text style={s.detailValue}>{liveTrotros} active now</Text>
              </View>
            ) : (
              <Text style={[s.detailValue, { color: '#9CA3AF' }]}>None sharing live yet</Text>
            )}
          </View>
          <View style={s.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#374151" />
              <Text style={s.detailLabel}>Est. trip time</Text>
            </View>
            <Text style={s.detailValue}>
              {etaMin != null ? `~${etaMin} min` : '—'}{traffic?.condition ? ` · ${traffic.condition} traffic` : ''}
            </Text>
          </View>
          <View style={s.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UsersIcon size={16} color="#374151" />
              <Text style={s.detailLabel}>Queue at {fromName}</Text>
            </View>
            {originQueue ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: QUEUE_META[originQueue.status].bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: QUEUE_META[originQueue.status].color }}>{QUEUE_META[originQueue.status].label}</Text>
                </View>
                <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: '#9CA3AF' }}>{originQueue.ageMins}m ago</Text>
              </View>
            ) : (
              <Text style={[s.detailValue, { color: '#9CA3AF', fontSize: 13 }]}>Leaves when full</Text>
            )}
          </View>
        </View>

        {/* ── Driver + bus assigned to this route (Phase 1 = own fleet). Shows the
              real driver & plate at booking; a green "Live" badge once the bus is
              broadcasting, else "On shift"/"Assigned". Honest placeholder if no
              bus is assigned to the route yet. ── */}
        {(() => {
          const plate = liveBus?.plateNumber ?? assigned?.plate ?? null
          const driver = assigned?.driverName ?? null
          const live = !!liveBus
          const onShift = assigned?.isOnShift ?? false
          const Card: any = driver ? TouchableOpacity : View
          return (
            <Card
              {...(driver ? { activeOpacity: 0.7, onPress: () => setShowDriver(true) } : {})}
              style={[s.card, { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 }]}
            >
              {driver && assigned?.driverPhotoUrl ? (
                <Image source={{ uri: assigned.driverPhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : driver ? (
                <InitialsAvatar name={driver} size={44} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: plate ? 'rgba(34,197,94,0.12)' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                  <Bus size={22} color={plate ? '#16A34A' : '#9CA3AF'} />
                </View>
              )}
              {driver ? (
                <>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {live && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                      <Text style={s.driverName}>{driver}</Text>
                    </View>
                    <Text style={s.driverRole}>Bus Driver · {plate}{live ? ' · Live' : onShift ? ' · On shift' : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={s.linkText}>Driver Details</Text>
                    <ChevronRight size={16} color={BRAND} />
                  </View>
                </>
              ) : plate ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={s.driverName}>{plate}</Text>
                    <Text style={s.driverRole}>Troski bus on this route</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: live ? 'rgba(34,197,94,0.12)' : '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 }}>
                    {live && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                    <Text style={{ fontFamily: font.bold, fontSize: 12, color: live ? '#16A34A' : '#6B7280' }}>{live ? 'Live' : 'Assigned'}</Text>
                  </View>
                </>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>Assigning your bus</Text>
                  <Text style={s.driverRole}>Driver &amp; plate shown shortly</Text>
                </View>
              )}
            </Card>
          )
        })()}

        {/* ── Fare breakdown ── */}
        <Text style={s.sectionTitle}>Fare Breakdown</Text>
        <View style={s.card}>
          <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 12 }}>
            <Ticket size={16} color={BRAND} />
            <Text style={[s.linkText, { fontSize: 14 }]}>Use Promo Code</Text>
          </TouchableOpacity>
          <View style={s.fareRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.detailLabel}>Bus Fare</Text>
              <View style={{ backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontFamily: font.medium, fontSize: 10.5, color: '#6B7280' }}>VAT exempt</Text>
              </View>
            </View>
            <Text style={s.fareValue}>{formatGHS(fare.bus)}</Text>
          </View>
          <View style={s.fareRow}><Text style={s.detailLabel}>Service Fee</Text><Text style={s.fareValue}>{formatGHS(fare.serviceBase)}</Text></View>
          <View style={s.fareRow}><Text style={s.detailLabel}>VAT + Levies (20%)</Text><Text style={s.fareValue}>{formatGHS(fare.serviceTax)}</Text></View>
          <View style={[s.fareRow, { marginTop: 4 }]}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{formatGHS(total)}</Text></View>
        </View>

        {/* ── Payment method ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
          <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Payment Method</Text>
          <TouchableOpacity style={s.addBtn} hitSlop={8}><Plus size={16} color="#111" /></TouchableOpacity>
        </View>
        <View style={s.card}>
          {payments.map((p, i) => {
            const sel = payment === p.id
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.7}
                onPress={() => { Haptics.selectionAsync(); setPayment(p.id) }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#F3F4F6' }}
              >
                <View style={s.payIcon}><Text style={{ fontSize: 18 }}>{p.id === 'wallet' ? '👛' : '🏦'}</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.payLabel}>{p.label}</Text>
                  <Text style={s.paySub}>{p.sub}</Text>
                </View>
                <View style={[s.radio, sel && s.radioOn]}>{sel && <Check size={13} color="#fff" strokeWidth={3} />}</View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* ── Pay button ── */}
      <View style={s.payBar}>
        {insufficient ? (
          <>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 }}>
              Wallet balance {formatGHS(walletBalance ?? 0)} · short {formatGHS(shortfall)}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                // Pre-fill the top-up with the shortfall (rounded up to a clean cedi).
                router.push({ pathname: '/wallet/fund', params: { amount: String(Math.ceil(shortfall)) } } as never)
              }}
              style={s.payBtn}
            >
              <Text style={s.payBtnText}>Top up {formatGHS(Math.ceil(shortfall))} to pay</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={booking || waitingBalance}
            onPress={payNow}
            style={[s.payBtn, (booking || waitingBalance) && { opacity: 0.6 }]}
          >
            <Text style={s.payBtnText}>{booking ? 'Processing…' : waitingBalance ? 'Checking balance…' : `Pay ${formatGHS(total)}`}</Text>
          </TouchableOpacity>
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
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#9CA3AF' }}>({driverRating.count})</Text>
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
                  <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Rate your driver after the trip — your feedback keeps the fleet accountable.</Text>
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
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={onVerify} style={s.verifyRow}>
        <ShieldCheck size={18} color={verified ? '#16A34A' : '#9CA3AF'} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: '#111', marginLeft: 10 }}>{verified ? 'Verification Completed' : 'Verification Pending'}</Text>
        <ChevronRight size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: '#111' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F1F0' },

  tinyLabel: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF' },
  placeName: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 2 },
  placeSub: { fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  dash: { width: 1.5, height: 10, backgroundColor: '#E5E7EB' },
  busBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0EB', justifyContent: 'center', alignItems: 'center', marginVertical: 4 },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  detailLabel: { fontFamily: font.medium, fontSize: 14, color: '#6B7280' },
  detailValue: { fontFamily: font.bold, fontSize: 14, color: '#111' },

  driverName: { fontFamily: font.bold, fontSize: 15, color: '#111' },
  driverRole: { fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  linkText: { fontFamily: font.bold, fontSize: 13, color: BRAND },

  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 20, marginBottom: 10 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  fareValue: { fontFamily: font.semibold, fontSize: 14, color: '#111' },
  totalLabel: { fontFamily: font.bold, fontSize: 15, color: '#111' },
  totalValue: { fontFamily: font.extrabold, fontSize: 16, color: '#111' },

  addBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  payIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  payLabel: { fontFamily: font.bold, fontSize: 14, color: '#111' },
  paySub: { fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioOn: { backgroundColor: BRAND, borderColor: BRAND },

  payBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, backgroundColor: '#FAFAF9', borderTopWidth: 1, borderTopColor: '#F1F1F0' },
  payBtn: { height: 54, borderRadius: 16, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' },
  payBtnText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },

  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAF9', borderRadius: 16, paddingVertical: 14, marginTop: 18, width: '100%' },
  verifyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F1F0', borderRadius: 14, paddingHorizontal: 14, height: 52, marginTop: 14, width: '100%' },
  reviewInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginTop: 16, minHeight: 80 },
  verifyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
})
