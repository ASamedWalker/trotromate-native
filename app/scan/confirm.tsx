import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Route, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

const PAYMENTS = [
  { id: 'wallet', label: 'Troski Wallet', sub: 'GH₵ 2,500.00', emoji: '👛' },
  { id: 'momo', label: 'MTN MoMo', sub: '***** 2096', emoji: '🏦' },
]

export default function ScanConfirmScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code?: string }>()
  const busCode = params.code || 'TRSK 235'
  const [payment, setPayment] = useState('wallet')

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.iconBtn}><ArrowLeft size={22} color="#111" /></TouchableOpacity>
        <Text style={s.headerTitle}>Pay with QR</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.tab}><Text style={s.tabText}>Scan QR Code</Text></View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 16 }}>
        {/* Bus Details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bus Details</Text>

          {/* Route */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <View style={[s.dot, { borderColor: '#10B981' }]} />
              <View style={s.connector} />
              <View style={[s.dot, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]} />
            </View>
            <View style={{ flex: 1, height: 44, justifyContent: 'space-between' }}>
              <Text style={s.stop}>Kumasi Central</Text>
              <Text style={s.stop}>Kaneshie Terminal</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Route size={14} color="#6B7280" />
              <Text style={s.duration}>2hr, 10mins</Text>
            </View>
          </View>

          <View style={s.divider} />

          {[['Bus Type', 'STC Coach'], ['Seat', '24'], ['Bus Code', busCode]].map(([l, v]) => (
            <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowValue}>{v}</Text></View>
          ))}

          <View style={s.divider} />
          <View style={s.row}><Text style={s.rowLabel}>Amount</Text><Text style={s.amount}>GH₵ 25.25</Text></View>
        </View>

        {/* Payment method */}
        <Text style={s.sectionTitle}>Select a payment method to complete your payment</Text>
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
                <View style={s.payIcon}><Text style={{ fontSize: 18 }}>{p.emoji}</Text></View>
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

      <View style={s.bottom}>
        <TouchableOpacity
          style={s.btn}
          activeOpacity={0.9}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/scan/pin' as never) }}
        >
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: '#111' },
  tab: { backgroundColor: BRAND, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontFamily: font.bold, fontSize: 14, color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F1F0', marginBottom: 16 },
  cardTitle: { fontFamily: font.bold, fontSize: 15, color: '#111' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, backgroundColor: '#fff' },
  connector: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginVertical: 2 },
  stop: { fontFamily: font.semibold, fontSize: 14, color: '#111' },
  duration: { fontFamily: font.medium, fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  rowLabel: { fontFamily: font.medium, fontSize: 14, color: '#6B7280' },
  rowValue: { fontFamily: font.bold, fontSize: 14, color: '#111' },
  amount: { fontFamily: font.extrabold, fontSize: 16, color: '#111' },

  sectionTitle: { fontFamily: font.semibold, fontSize: 14, color: '#374151', marginBottom: 10, paddingHorizontal: 2 },
  payIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  payLabel: { fontFamily: font.bold, fontSize: 14, color: '#111' },
  paySub: { fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioOn: { backgroundColor: BRAND, borderColor: BRAND },

  bottom: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#F1F1F0' },
  btn: { height: 54, borderRadius: 14, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
