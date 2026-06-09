import { useState } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { ArrowLeft, Landmark, Smartphone, CreditCard, Check } from 'lucide-react-native'
import { font, themed } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const BRAND_TINT = '#FFF0EB'

type MethodId = 'bank' | 'mtn' | 'card'

const METHODS: {
  id: MethodId
  label: string
  Icon: typeof Landmark
  route: Href | null
  soon?: boolean
}[] = [
  { id: 'bank', label: 'Bank Transfer', Icon: Landmark, route: '/wallet/bank-transfer' as Href },
  { id: 'mtn', label: 'MTN MoMo', Icon: Smartphone, route: '/wallet/momo' as Href },
  { id: 'card', label: 'Add Debit Card', Icon: CreditCard, route: null, soon: true },
]

export default function TopUpWalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()
  const [selected, setSelected] = useState<MethodId>('bank')

  const handleProceed = () => {
    const method = METHODS.find((m) => m.id === selected)
    if (!method) return
    if (method.soon || !method.route) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      Alert.alert('Coming soon', 'Debit card top-up is on the way. Use Bank Transfer or MTN MoMo for now.')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(method.route)
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.iconBtn}>
          <ArrowLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: t.text }]}>Top Up Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[s.title, { color: t.text }]}>Choose mode of payment</Text>
          <Text style={[s.subtitle, { color: t.textSecondary }]}>
            Select any of the payment options below to top-up wallet
          </Text>
        </Animated.View>

        <View style={s.list}>
          {METHODS.map((m, i) => {
            const active = selected === m.id
            return (
              <Animated.View key={m.id} entering={FadeInDown.delay(80 + i * 70).duration(400)}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => { setSelected(m.id); Haptics.selectionAsync() }}
                  style={[s.row, {
                    backgroundColor: isDark ? '#1c1917' : '#ffffff',
                    borderColor: active ? BRAND : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F1F0'),
                  }]}
                >
                  <View style={[s.iconTile, { backgroundColor: active ? BRAND_TINT : (isDark ? '#292524' : '#F6F6F5') }]}>
                    <m.Icon size={20} color={active ? BRAND : (isDark ? '#a8a29e' : '#57534e')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowLabel, { color: t.text }]}>{m.label}</Text>
                    {m.soon && <Text style={s.soon}>Coming soon</Text>}
                  </View>
                  <View style={[s.radio, active ? { backgroundColor: BRAND, borderColor: BRAND } : { borderColor: isDark ? '#44403c' : '#D4D4D2' }]}>
                    {active && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )
          })}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity activeOpacity={0.9} onPress={handleProceed} style={s.proceed}>
          <Text style={s.proceedText}>Proceed</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: font.bold },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontFamily: font.bold, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontFamily: font.regular, marginTop: 6, lineHeight: 20 },

  list: { gap: 12, marginTop: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5,
  },
  iconTile: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 15, fontFamily: font.semibold },
  soon: { fontSize: 11, fontFamily: font.medium, color: '#9CA3AF', marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },

  proceed: {
    height: 54, borderRadius: 14, backgroundColor: BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  proceedText: { fontSize: 16, fontFamily: font.bold, color: '#fff' },
})
