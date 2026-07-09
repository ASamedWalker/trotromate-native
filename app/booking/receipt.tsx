import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Share, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Check, Share2, Shield, Copy, AlertTriangle, X, Navigation } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'

const BRAND = '#FF4D1C'
const GREEN = '#22C55E'

export default function ReceiptScreen() {
  const router = useRouter()
  const { profile } = useApp()
  const params = useLocalSearchParams<{ from?: string; to?: string; trip_code?: string; fare?: string; route_id?: string; van?: string }>()
  const passenger = profile?.display_name || 'Passenger'
  const [showSafety, setShowSafety] = useState(false)
  const [copied, setCopied] = useState(false)

  // A receipt only exists for a real booking. Opened without one (e.g. a
  // direct deep link) we show an honest not-found state — never demo data.
  const hasTicket = !!params.trip_code
  const code3 = (s?: string) => (s || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  const t = {
    code: params.trip_code || '',
    ref: params.trip_code || '',
    fromName: params.from || '—',
    toName: params.to || '—',
    fromCode: code3(params.from),
    toCode: code3(params.to),
    fare: params.fare ? `GH₵ ${parseFloat(params.fare).toFixed(2)}` : '—',
  }

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
        message: `🚌 My Troski trip\n${t.fromName} → ${t.toName}\nTicket: ${t.ref}\nFare ${t.fare}\n\nBook yours on Troski.`,
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
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 }}>
        <TouchableOpacity onPress={() => { if (router.canDismiss()) router.dismissAll(); else router.replace('/(tabs)' as never) }} style={s.closeTop} hitSlop={8}>
          <X size={20} color="#111" />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
        {/* Success */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View pointerEvents="none" style={[s.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
            <Animated.View style={[s.checkRing, { transform: [{ scale: checkScale }] }]}>
              <View style={s.checkCircle}><Check size={34} color="#fff" strokeWidth={3.5} /></View>
            </Animated.View>
          </View>
          <Animated.Text style={[s.title, { opacity: textOpacity }]}>Booking Successful</Animated.Text>
          <Animated.Text style={[s.subtitle, { opacity: textOpacity }]}>Payment confirmed — show QR to conductor</Animated.Text>
        </View>

        {/* Ticket — floats on a soft shadow like the Figma boarding pass */}
        <View style={s.ticketShadow}>
        <View style={s.ticket}>
          {/* Top: passenger + code */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#111' }}>{passenger}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#6B7280', letterSpacing: 1 }}>{t.code}</Text>
          </View>

          {/* From — To */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
            <View>
              <Text style={s.bigCode}>{t.fromCode}</Text>
              <Text style={s.codeName}>{t.fromName}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {/* shrink-wraps to the dash row so the rails end exactly at the squares */}
              <View style={{ gap: 10 }}>
                <View style={s.trackLine} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {Array.from({ length: 5 }).map((_, i) => <View key={i} style={s.trackDash} />)}
                </View>
                <View style={s.trackLine} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.bigCode}>{t.toCode}</Text>
              <Text style={s.codeName}>{t.toName}</Text>
            </View>
          </View>

          {/* Perforation */}
          <View style={s.perfRow}>
            <View style={[s.notch, { left: -10 }]} />
            <View style={s.perfLine} />
            <View style={[s.notch, { right: -10 }]} />
          </View>

          {/* QR — static; the conductor scans it. No hidden tap behavior. */}
          <View style={{ alignItems: 'center', paddingTop: 18 }}>
            <View style={s.qrFrame} accessibilityLabel={`Ticket QR code, ${t.fromName} to ${t.toName}, ${t.fare}`}>
              <QRCode value={t.ref} size={140} />
            </View>
            <TouchableOpacity onPress={copyRef} style={s.refPill}>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: copied ? '#16A34A' : '#6B7280', letterSpacing: 0.5 }}>
                {copied ? 'Copied!' : t.ref}
              </Text>
              {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          {/* Fare / trip code — only fields we actually know for a real booking */}
          <View style={s.metaStrip}>
            {[
              ['Fare Paid', t.fare],
              ['Trip Code', t.code],
            ].map(([label, value], i) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: '#EFEFEF' }}>
                <Text style={s.metaLabel}>{label}</Text>
                <Text style={s.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        </View>

      </ScrollView>

      {/* Bottom actions */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10 }}>
        {/* Track your bus — live position + ETA toward your stop. Pass the assigned
            van so the passenger locks onto their exact bus's broadcast, not just
            any trotro on the route. */}
        {(!!params.route_id || !!params.van) && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={s.trackBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.push({ pathname: '/booking/track', params: { route_id: params.route_id ?? '', to: params.to ?? '', van: params.van ?? '' } } as any)
            }}
          >
            <Navigation size={18} color="#fff" />
            <Text style={s.trackText}>Track your bus</Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity activeOpacity={0.9} style={s.shareBtn} onPress={shareTrip}>
            <Share2 size={18} color="#fff" />
            <Text style={s.shareText}>Share Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={s.safetyBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSafety(true) }}>
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
  closeTop: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  checkCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 20, color: '#111', marginTop: 18 },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: '#6B7280', marginTop: 4 },

  // Shadow lives on the wrapper: iOS drops shadows on views with overflow:hidden,
  // and the ticket needs overflow:hidden so the perforation notches punch through
  ticketShadow: { marginTop: 28, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  ticket: { backgroundColor: '#fff', borderRadius: 20, paddingBottom: 16, overflow: 'hidden' },
  qrFrame: { padding: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB' },
  refPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  bigCode: { fontFamily: font.extrabold, fontSize: 30, color: '#111', letterSpacing: -0.5 },
  codeName: { fontFamily: font.regular, fontSize: 13, color: '#6B7280', marginTop: 2 },
  // Journey motif between the station codes — rail, sleepers, rail (per Figma)
  trackLine: { alignSelf: 'stretch', height: 2.5, borderRadius: 2, backgroundColor: '#E5E7EB' },
  trackDash: { width: 9, height: 7, borderRadius: 1.5, backgroundColor: '#4B5563' },

  perfRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  perfLine: { flex: 1, height: 1, borderRadius: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginHorizontal: 10 },
  notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FAFAF9' },

  metaStrip: { flexDirection: 'row', backgroundColor: '#FAFAF9', borderRadius: 14, marginHorizontal: 16, marginTop: 18, paddingVertical: 12 },

  metaLabel: { fontFamily: font.medium, fontSize: 11, color: '#6B7280' },
  metaValue: { fontFamily: font.bold, fontSize: 14, color: '#111', marginTop: 3 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  trackBtn: { height: 54, borderRadius: 16, backgroundColor: '#0A0A0A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  trackText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  shareBtn: { flex: 1, height: 54, borderRadius: 16, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  shareText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  safetyBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  safetySheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  callBtn: { height: 54, borderRadius: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  callText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
