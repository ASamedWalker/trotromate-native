import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Share, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Check, Share2, Shield, Copy, AlertTriangle, X, Navigation, Ticket } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { hhmm } from '@/lib/utils/clock'
import { SERVICE_FEE_INCL, splitServiceFee } from '@/lib/utils/serviceFee'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { getCachedPasses, cacheActivePasses } from '@/lib/services/ticketCache'

const BRAND = '#FF4D1C'
const GREEN = '#22C55E'

export default function ReceiptScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; trip_code?: string; fare?: string; route_id?: string; van?: string; expires_at?: string; bus_fare?: string; service_fee?: string; booked_at?: string }>()
  const [showSafety, setShowSafety] = useState(false)
  const [copied, setCopied] = useState(false)

  // A receipt only exists for a real booking. Opened without one (e.g. a
  // direct deep link) we show an honest not-found state — never demo data.
  const hasTicket = !!params.trip_code
  const t = {
    code: params.trip_code || '',
    ref: params.trip_code || '',
    fromName: params.from || '—',
    toName: params.to || '—',
    fare: params.fare && isFinite(parseFloat(params.fare)) ? formatGHS(parseFloat(params.fare)) : '',
  }
  const fareTotal = params.fare && isFinite(parseFloat(params.fare)) ? parseFloat(params.fare) : null
  // Prefer the split the server charged; fall back to the standard fee only if absent.
  const num = (v?: string) => (v && isFinite(parseFloat(v)) ? parseFloat(v) : null)
  const paramBus = num(params.bus_fare)
  const paramFee = num(params.service_fee)
  const serviceFee = paramFee ?? (fareTotal != null && paramBus != null ? Math.max(0, fareTotal - paramBus) : SERVICE_FEE_INCL)
  const busFare = paramBus ?? (fareTotal != null ? Math.max(0, fareTotal - serviceFee) : null)
  const fee = splitServiceFee(serviceFee)
  // Booking time from the server when reported, else the moment the receipt opened.
  const [bookedAt] = useState(() => hhmm(params.booked_at && !isNaN(new Date(params.booked_at).getTime()) ? params.booked_at : new Date()))

  // C6: "Track bus" only when the assigned van's last ping is under 2 min old.
  // vehicle_positions is read-only here; isStale = no update in >2 min.
  const { vehicles } = useVehiclePositions(params.route_id || undefined, !!params.van && !!params.route_id)
  const vanLive = !!params.van && vehicles.some((v) => v.vanId === params.van && !v.isStale)

  // Cache the new ticket at once so "Show ticket" opens offline, even before
  // the Wallet tab refetches.
  useEffect(() => {
    if (!params.trip_code) return
    const pass = {
      trip_code: params.trip_code,
      route_label: `${params.from || ''} → ${params.to || ''}`,
      van_plate: null,
      fare: fareTotal ?? 0,
      currency: 'GHS',
      status: 'active' as const,
      expires_at: params.expires_at || null,
    }
    getCachedPasses()
      .then((ps) => (ps.some((p) => p.trip_code === pass.trip_code) ? null : cacheActivePasses([pass, ...ps])))
      .catch(() => {})
  }, [params.trip_code, params.from, params.to, params.expires_at, fareTotal])

  const copyRef = async () => {
    await Clipboard.setStringAsync(t.ref)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Payment-success animation — spring the check in + an expanding ripple + haptic
  const checkScale = useRef(new Animated.Value(0)).current
  const ringScale = useRef(new Animated.Value(0.7)).current
  const ringOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, friction: 4.5, tension: 95, delay: 120, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ringOpacity, { toValue: 0.4, duration: 150, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.7, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 320, useNativeDriver: true }),
    ]).start()
  }, [checkScale, ringScale, ringOpacity, textOpacity])

  // Native share sheet — surfaces WhatsApp, Messages, Mail, and any installed app
  const shareTrip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await Share.share({
        title: 'My Troski Trip',
        message: `My Troski trip\n${t.fromName} → ${t.toName}\nTicket: ${t.ref}${t.fare ? `\nFare ${t.fare}` : ''}\n\nBook yours on Troski.`,
      })
    } catch {
      // dismissed / unavailable — no-op
    }
  }

  if (!hasTicket) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', textAlign: 'center' }}>No ticket found</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
          This receipt is only available right after a booking. Your tickets live in Wallet → My Tickets.
        </Text>
        <TouchableOpacity
          onPress={() => { if (router.canDismiss()) router.dismissAll(); else router.replace('/(tabs)' as never) }}
          style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: BRAND }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      {/* Close — back to home */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 4 }}>
        <TouchableOpacity onPress={() => { if (router.canDismiss()) router.dismissAll(); else router.replace('/(tabs)' as never) }} style={s.closeTop} accessibilityRole="button" accessibilityLabel="Close">
          <X size={22} color="#111" />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 200 }}>
        {/* Ticket ready — the ticket comes first (C6) */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View pointerEvents="none" style={[s.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
            <Animated.View style={[s.checkRing, { transform: [{ scale: checkScale }] }]}>
              <View style={s.checkCircle}><Check size={34} color="#fff" strokeWidth={3.5} /></View>
            </Animated.View>
          </View>
          <Animated.Text style={[s.title, { opacity: textOpacity }]}>Ticket ready</Animated.Text>
          <Animated.Text style={[s.subtitle, { opacity: textOpacity }]}>
            {[`${t.fromName} → ${t.toName}`, bookedAt, t.fare].filter(Boolean).join(' · ')}
          </Animated.Text>
        </View>

        {/* Receipt — the VAT split lives here, not at checkout (C2) */}
        <View style={s.card}>
          {fareTotal != null ? (
            <>
              <View style={s.row}><Text style={s.rowLabel}>Fare</Text><Text style={s.rowValue}>{formatGHS(busFare ?? 0)}</Text></View>
              <View style={s.row}><Text style={s.rowLabel}>Service fee</Text><Text style={s.rowValue}>{formatGHS(fee.base)}</Text></View>
              <View style={s.row}><Text style={s.rowLabel}>VAT on service fee (20%)</Text><Text style={s.rowValue}>{formatGHS(fee.tax)}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={s.totalLabel}>Total paid</Text><Text style={s.totalLabel}>{formatGHS(fareTotal)}</Text></View>
            </>
          ) : null}
          <TouchableOpacity onPress={copyRef} style={s.refRow} accessibilityRole="button" accessibilityLabel={`Copy ticket reference ${t.ref}`}>
            <Text style={s.rowLabel}>Ref</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[s.rowValue, { letterSpacing: 0.5 }]}>{copied ? 'Copied' : t.ref}</Text>
              {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} color="#6B7280" />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom actions: Show ticket first */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10, backgroundColor: '#FAFAF9' }}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={s.primaryBtn}
          accessibilityRole="button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push({ pathname: '/wallet/ticket', params: { trip_code: t.code } } as never)
          }}
        >
          <Ticket size={20} color="#fff" />
          <Text style={s.primaryText}>Show ticket</Text>
        </TouchableOpacity>
        {/* Track bus only when the assigned van pinged in the last 2 min (C6). */}
        {vanLive && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={s.trackBtn}
            accessibilityRole="button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.push({ pathname: '/booking/track', params: { route_id: params.route_id ?? '', to: params.to ?? '', van: params.van ?? '' } } as never)
            }}
          >
            <Navigation size={18} color="#fff" />
            <Text style={s.trackText}>Track bus</Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity activeOpacity={0.9} style={s.shareBtn} onPress={shareTrip} accessibilityRole="button">
            <Share2 size={18} color="#111" />
            <Text style={s.shareText}>Share trip</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={s.safetyBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSafety(true) }} accessibilityRole="button" accessibilityLabel="Safety">
            <Shield size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Safety Features sheet */}
      <Modal visible={showSafety} transparent animationType="fade" onRequestClose={() => setShowSafety(false)}>
        <TouchableOpacity activeOpacity={1} style={s.backdrop} onPress={() => setShowSafety(false)}>
          <TouchableOpacity activeOpacity={1} style={s.safetySheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#111' }}>Safety Features</Text>
              <TouchableOpacity onPress={() => setShowSafety(false)} hitSlop={8}><X size={18} color="#6B7280" /></TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={s.callBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                Linking.openURL('tel:112').catch(() => Alert.alert('Call 112', 'Dial 112 for Ghana emergency services.'))
              }}
            >
              <AlertTriangle size={18} color="#fff" />
              <Text style={s.callText}>Call 112</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  checkRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' },
  pulseRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: GREEN },
  closeTop: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  checkCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 22, color: '#111', marginTop: 18 },
  subtitle: { fontFamily: font.medium, fontSize: 14, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  card: { marginTop: 24, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: '#EEEEEE' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontFamily: font.medium, fontSize: 14, color: '#6B7280' },
  rowValue: { fontFamily: font.semibold, fontSize: 14, color: '#111', fontVariant: ['tabular-nums'] },
  totalRow: { borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 2 },
  totalLabel: { fontFamily: font.extrabold, fontSize: 16, color: '#111', fontVariant: ['tabular-nums'] },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: '#EEEEEE' },

  primaryBtn: { height: 56, borderRadius: 14, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  trackBtn: { height: 52, borderRadius: 14, backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  trackText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  shareBtn: { flex: 1, height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontFamily: font.bold, fontSize: 16, color: '#111' },
  safetyBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  safetySheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  callBtn: { height: 54, borderRadius: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  callText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
