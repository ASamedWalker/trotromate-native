import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ArrowLeft, ChevronRight, Ticket, Plus, Check, X,
  ShieldCheck, Star, BadgeCheck, Camera, UserCheck,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { formatGHS } from '@/lib/utils/currency'
import { font } from '@/lib/theme'
import InitialsAvatar from '@/components/InitialsAvatar'

const BRAND = '#FF4D1C'

/* ── Mock booking (replace with real data when the booking backend lands) ── */
const DRIVER = { name: 'Mr John Kwame', role: 'Bus Driver', rides: 200, years: 3, rating: 4.5 }

const REVIEWS = [
  { name: 'vic***a', stars: 5, time: '1 week ago', text: 'One of the best commuting experiences I’ve had in a long time. The driver was patient during heavy traffic, drove responsibly and even helped with directions.' },
  { name: 'Joe***y', stars: 4, time: '2 weeks ago', text: 'Excellent service overall. The driver was friendly, respectful and very attentive to passengers during the trip. I liked how calm and professional they remained during rush hour traffic.' },
]

const VERIFY_ITEMS = [
  { Icon: BadgeCheck, title: 'Driver Identification', desc: 'We verify every driver’s identity using valid government-issued identification' },
  { Icon: Camera, title: 'Driver Photo Check', desc: 'Drivers regularly submit live photo confirmation to help prevent impersonation' },
  { Icon: UserCheck, title: 'Safety & Conduct Review', desc: 'Driver activity, commuter feedback, and ratings are continuously monitored to maintain a safe and reliable commuting experience' },
]

const PAYMENTS = [
  { id: 'wallet', label: 'Troski Wallet', sub: 'GH₵ 2,500.00' },
  { id: 'momo', label: 'MTN MoMo', sub: '***** 2096' },
]

export default function CheckoutScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string }>()

  const fromName = params.from || 'Kaneshie Terminal'
  const toName = params.to || 'Kumasi Central'

  const fare = { bus: 25.0, service: 0.25 }
  const total = fare.bus + fare.service

  const [payment, setPayment] = useState('wallet')
  const [showDriver, setShowDriver] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

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
              <Text style={s.placeSub}>Bay 2</Text>
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
              <Text style={[s.placeSub, { textAlign: 'right' }]}>Kejetia Market</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Detail rows */}
          {[
            ['Departs', 'In 5 mins'],
            ['Duration', '2 hr 30 mins'],
            ['Seats', '24 Seater'],
            ['Bus Type', 'STC Coach'],
            ['Bus Code', 'TRSK 235'],
          ].map(([label, value], i) => (
            <View key={label} style={[s.detailRow, i === 0 && { paddingTop: 4 }]}>
              <Text style={s.detailLabel}>{label}</Text>
              <Text style={s.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Driver row ── */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDriver(true)} style={[s.card, { flexDirection: 'row', alignItems: 'center', marginTop: 14 }]}>
          <InitialsAvatar name={DRIVER.name} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.driverName}>{DRIVER.name}</Text>
            <Text style={s.driverRole}>{DRIVER.role}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={s.linkText}>Driver Details</Text>
            <ChevronRight size={16} color={BRAND} />
          </View>
        </TouchableOpacity>

        {/* ── Fare breakdown ── */}
        <Text style={s.sectionTitle}>Fare Breakdown</Text>
        <View style={s.card}>
          <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 12 }}>
            <Ticket size={16} color={BRAND} />
            <Text style={[s.linkText, { fontSize: 14 }]}>Use Promo Code</Text>
          </TouchableOpacity>
          <View style={s.fareRow}><Text style={s.detailLabel}>Bus Fare</Text><Text style={s.fareValue}>{formatGHS(fare.bus)}</Text></View>
          <View style={s.fareRow}><Text style={s.detailLabel}>Service Fee</Text><Text style={s.fareValue}>{formatGHS(fare.service)}</Text></View>
          <View style={[s.fareRow, { marginTop: 4 }]}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{formatGHS(total)}</Text></View>
        </View>

        {/* ── Payment method ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
          <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Payment Method</Text>
          <TouchableOpacity style={s.addBtn} hitSlop={8}><Plus size={16} color="#111" /></TouchableOpacity>
        </View>
        <View style={s.card}>
          {PAYMENTS.map((p, i) => {
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
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/booking/processing' as never) }}
          style={s.payBtn}
        >
          <Text style={s.payBtnText}>Pay ${total.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Driver Details modal ── */}
      <Modal visible={showDriver} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDriver(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity onPress={() => setShowDriver(false)} style={s.closeBtn} hitSlop={8}><X size={18} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
              <DriverHeader onVerify={() => setShowVerify(true)} />

              <Text style={[s.sectionTitle, { marginTop: 24 }]}>Top Reviews</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Star size={15} color="#F5A623" fill="#F5A623" />
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#111' }}>4.5 Reviews</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#9CA3AF' }}>(50 reviews)</Text>
                </View>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={s.linkText}>View all</Text>
                  <ChevronRight size={15} color={BRAND} />
                </TouchableOpacity>
              </View>

              {REVIEWS.map((r) => (
                <View key={r.name} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#111' }}>{r.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={11} color="#F5A623" fill={n <= r.stars ? '#F5A623' : 'transparent'} />
                        ))}
                      </View>
                    </View>
                    <Text style={{ fontFamily: font.regular, fontSize: 11, color: '#9CA3AF' }}>{r.time}</Text>
                  </View>
                  <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: 6 }}>{r.text}</Text>
                </View>
              ))}

              <View style={s.reviewInput}>
                <TextInput placeholder="Write a review..." placeholderTextColor="#9CA3AF" style={{ fontFamily: font.regular, fontSize: 14, color: '#111' }} multiline />
              </View>
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
              <DriverHeader onVerify={() => {}} />

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
    </SafeAreaView>
  )
}

/* ── Shared driver header (avatar + stats + verification row) ── */
function DriverHeader({ onVerify }: { onVerify: () => void }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <InitialsAvatar name={DRIVER.name} size={88} fontSize={32} />
      <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', marginTop: 12 }}>{DRIVER.name}</Text>

      <View style={s.statsRow}>
        {[
          [String(DRIVER.rides), 'Rides'],
          [`${DRIVER.years} yrs`, 'with Troski'],
          [String(DRIVER.rating), 'Rating'],
        ].map(([n, l], i) => (
          <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: '#F3F4F6' }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 20, color: BRAND }}>{n}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={onVerify} style={s.verifyRow}>
        <ShieldCheck size={18} color="#111" />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: '#111', marginLeft: 10 }}>Verification Completed</Text>
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
