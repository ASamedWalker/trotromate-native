import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, Share2, Shield, Copy, Headphones, Users, AlertTriangle, X } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const GREEN = '#22C55E'

const TICKET = {
  passenger: 'Victor Mensah',
  code: 'TRSK 205',
  fromCode: 'KSH', fromName: 'Kaneshie',
  toCode: 'KSI', toName: 'Kumsasi',
  ref: 'TRSK205-KSH-KSI',
  fare: '$25.25', departure: '10 mins', duration: '4 hr 30 mins',
}

export default function ReceiptScreen() {
  const [showSafety, setShowSafety] = useState(false)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}>
        {/* Success */}
        <View style={{ alignItems: 'center' }}>
          <View style={s.checkRing}>
            <View style={s.checkCircle}><Check size={34} color="#fff" strokeWidth={3.5} /></View>
          </View>
          <Text style={s.title}>Booking Successful</Text>
          <Text style={s.subtitle}>Payment confirmed show QR to conductor</Text>
        </View>

        {/* Ticket */}
        <View style={s.ticket}>
          {/* Top: passenger + code */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#111' }}>{TICKET.passenger}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#9CA3AF', letterSpacing: 1 }}>{TICKET.code}</Text>
          </View>

          {/* From — To */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
            <View>
              <Text style={s.bigCode}>{TICKET.fromCode}</Text>
              <Text style={s.codeName}>{TICKET.fromName}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {Array.from({ length: 6 }).map((_, i) => <View key={i} style={s.dot} />)}
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

          {/* QR */}
          <View style={{ alignItems: 'center', paddingTop: 18 }}>
            <View style={{ padding: 8, backgroundColor: '#fff', borderRadius: 8 }}>
              <QRCode value={TICKET.ref} size={140} />
            </View>
            <TouchableOpacity
              onPress={() => Haptics.selectionAsync()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: '#6B7280', letterSpacing: 0.5 }}>{TICKET.ref}</Text>
              <Copy size={13} color="#9CA3AF" />
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
      </ScrollView>

      {/* Bottom actions */}
      <View style={s.actions}>
        <TouchableOpacity activeOpacity={0.9} style={s.shareBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
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
              <View style={s.safetyCard}>
                <Headphones size={22} color="#111" />
                <Text style={s.safetyCardText}>Customer Support</Text>
              </View>
              <View style={s.safetyCard}>
                <Users size={22} color="#111" />
                <Text style={s.safetyCardText}>Emergency Contact</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.9} style={s.callBtn} onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}>
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
  checkCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 20, color: '#111', marginTop: 18 },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  ticket: { backgroundColor: '#fff', borderRadius: 20, marginTop: 28, paddingBottom: 16, borderWidth: 1, borderColor: '#F1F1F0', overflow: 'hidden' },
  bigCode: { fontFamily: font.extrabold, fontSize: 30, color: '#111', letterSpacing: -0.5 },
  codeName: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D1D5DB' },

  perfRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  perfLine: { flex: 1, height: 1, borderRadius: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginHorizontal: 10 },
  notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FAFAF9' },

  metaStrip: { flexDirection: 'row', backgroundColor: '#FAFAF9', borderRadius: 14, marginHorizontal: 16, marginTop: 18, paddingVertical: 12 },
  metaLabel: { fontFamily: font.medium, fontSize: 11, color: '#9CA3AF' },
  metaValue: { fontFamily: font.bold, fontSize: 14, color: '#111', marginTop: 3 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  shareBtn: { flex: 1, height: 54, borderRadius: 16, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
  safetyBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  safetySheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  safetyCard: { flex: 1, height: 92, borderRadius: 16, backgroundColor: '#F7F7F6', justifyContent: 'center', alignItems: 'center', gap: 8 },
  safetyCardText: { fontFamily: font.semibold, fontSize: 13, color: '#111' },
  callBtn: { height: 54, borderRadius: 16, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  callText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
