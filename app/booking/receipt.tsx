import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Share, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Check, Share2, Shield, Copy, Headphones, Users, AlertTriangle, X } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'

const BRAND = '#FF4D1C'
const GREEN = '#22C55E'

const TICKET = {
  passenger: 'Victor Mensah',
  code: 'TRSK 205',
  fromCode: 'KSH', fromName: 'Kaneshie',
  toCode: 'KSI', toName: 'Kumsasi',
  ref: 'TRSK205-KSH-KSI',
  fare: 'GH₵ 25.25', departure: '10 mins', duration: '4 hr 30 mins',
}

export default function ReceiptScreen() {
  const router = useRouter()
  const { profile } = useApp()
  const passenger = profile?.display_name || TICKET.passenger
  const [showSafety, setShowSafety] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyRef = async () => {
    await Clipboard.setStringAsync(TICKET.ref)
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
        message: `🚌 My Troski trip\n${TICKET.fromName} → ${TICKET.toName}\nTicket: ${TICKET.ref}\nFare ${TICKET.fare} · Departs in ${TICKET.departure}\n\nBook yours on Troski.`,
      })
    } catch {
      // dismissed / unavailable — no-op
    }
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
          <Animated.Text style={[s.subtitle, { opacity: textOpacity }]}>Payment confirmed show QR to conductor</Animated.Text>
        </View>

        {/* Ticket — floats on a soft shadow like the Figma boarding pass */}
        <View style={s.ticketShadow}>
        <View style={s.ticket}>
          {/* Top: passenger + code */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#111' }}>{passenger}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#9CA3AF', letterSpacing: 1 }}>{TICKET.code}</Text>
          </View>

          {/* From — To */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
            <View>
              <Text style={s.bigCode}>{TICKET.fromCode}</Text>
              <Text style={s.codeName}>{TICKET.fromName}</Text>
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
              <Text style={s.bigCode}>{TICKET.toCode}</Text>
              <Text style={s.codeName}>{TICKET.toName}</Text>
            </View>
          </View>

          {/* Perforation */}
          <View style={s.perfRow}>
            <View style={[s.notch, { left: -10 }]} />
            <View style={s.perfLine} />
            <View style={[s.notch, { right: -10 }]} />
          </View>

          {/* QR — tap simulates the conductor scan -> trip -> arrival */}
          <View style={{ alignItems: 'center', paddingTop: 18 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/booking/arrived' as never) }}
              style={s.qrFrame}
            >
              <QRCode value={TICKET.ref} size={140} />
            </TouchableOpacity>
            <TouchableOpacity onPress={copyRef} style={s.refPill}>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: copied ? '#16A34A' : '#6B7280', letterSpacing: 0.5 }}>
                {copied ? 'Copied!' : TICKET.ref}
              </Text>
              {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#9CA3AF" />}
            </TouchableOpacity>
          </View>

          {/* Fare / departure / duration */}
          <View style={s.metaStrip}>
            {[
              ['Fare Paid', TICKET.fare],
              ['Departure', TICKET.departure],
              ['Duration', TICKET.duration],
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
      <View style={s.actions}>
        <TouchableOpacity activeOpacity={0.9} style={s.shareBtn} onPress={shareTrip}>
          <Share2 size={18} color="#fff" />
          <Text style={s.shareText}>Share Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={s.safetyBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSafety(true) }}>
          <Shield size={20} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Safety Features sheet */}
      <Modal visible={showSafety} transparent animationType="fade" onRequestClose={() => setShowSafety(false)}>
        <TouchableOpacity activeOpacity={1} style={s.backdrop} onPress={() => setShowSafety(false)}>
          <TouchableOpacity activeOpacity={1} style={s.safetySheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#111' }}>Safety Features</Text>
              <TouchableOpacity onPress={() => setShowSafety(false)} hitSlop={8}><X size={18} color="#9CA3AF" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.safetyCard}
                onPress={() => { Haptics.selectionAsync(); Alert.alert('Customer Support', 'In-app support chat is coming soon. For urgent help use Call 112.') }}
              >
                <Headphones size={22} color="#111" />
                <Text style={s.safetyCardText}>Customer Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.safetyCard}
                onPress={() => { Haptics.selectionAsync(); Alert.alert('Emergency Contact', 'Add a trusted contact in Settings to alert them with one tap. Coming soon.') }}
              >
                <Users size={22} color="#111" />
                <Text style={s.safetyCardText}>Emergency Contact</Text>
              </TouchableOpacity>
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
  subtitle: { fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  // Shadow lives on the wrapper: iOS drops shadows on views with overflow:hidden,
  // and the ticket needs overflow:hidden so the perforation notches punch through
  ticketShadow: { marginTop: 28, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  ticket: { backgroundColor: '#fff', borderRadius: 20, paddingBottom: 16, overflow: 'hidden' },
  qrFrame: { padding: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB' },
  refPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  bigCode: { fontFamily: font.extrabold, fontSize: 30, color: '#111', letterSpacing: -0.5 },
  codeName: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  // Journey motif between the station codes — rail, sleepers, rail (per Figma)
  trackLine: { alignSelf: 'stretch', height: 2.5, borderRadius: 2, backgroundColor: '#E5E7EB' },
  trackDash: { width: 9, height: 7, borderRadius: 1.5, backgroundColor: '#4B5563' },

  perfRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  perfLine: { flex: 1, height: 1, borderRadius: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginHorizontal: 10 },
  notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FAFAF9' },

  metaStrip: { flexDirection: 'row', backgroundColor: '#FAFAF9', borderRadius: 14, marginHorizontal: 16, marginTop: 18, paddingVertical: 12 },

  metaLabel: { fontFamily: font.medium, fontSize: 11, color: '#9CA3AF' },
  metaValue: { fontFamily: font.bold, fontSize: 14, color: '#111', marginTop: 3 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  shareBtn: { flex: 1, height: 54, borderRadius: 16, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 },
  shareText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  safetyBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  safetySheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  safetyCard: { flex: 1, height: 92, borderRadius: 16, backgroundColor: '#F7F7F6', justifyContent: 'center', alignItems: 'center', gap: 8 },
  safetyCardText: { fontFamily: font.semibold, fontSize: 13, color: '#111' },
  callBtn: { height: 54, borderRadius: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  callText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
