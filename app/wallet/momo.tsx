import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, useColorScheme, StyleSheet, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { font, themed } from '@/lib/theme'
import NetworkLogo, { type NetworkId } from '@/components/NetworkLogo'
import WalletTopUpAnimation from '@/components/WalletTopUpAnimation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const AMOUNTS = [5, 10, 20, 50]
const PROVIDERS = [
  { id: 'mtn', label: 'MTN MoMo', color: '#FFCC00', textColor: '#000' },
  { id: 'tgo', label: 'Telecel Cash', color: '#E60000', textColor: '#fff' },
  { id: 'atl', label: 'AirtelTigo', color: '#ED1C24', textColor: '#fff' },
]

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export default function MomoTopUpScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()
  const { user } = useAuthContext()
  const { provider: providerParam } = useLocalSearchParams<{ provider?: string }>()
  const initialProvider = PROVIDERS.some((p) => p.id === providerParam) ? providerParam! : 'mtn'
  // Normalise the stored auth phone to a clean local number (strip +233 / 233 / leading 0)
  const initialPhone = (user?.phone || '').replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '')

  const [amount, setAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [phone, setPhone] = useState(initialPhone)
  const [provider, setProvider] = useState<string>(initialProvider)
  const [loading, setLoading] = useState(false)
  const [anim, setAnim] = useState<{ state: 'loading' | 'success'; message: string } | null>(null)

  const effectiveAmount = amount || (customAmount ? parseFloat(customAmount) : 0)

  const handleFund = async () => {
    if (!effectiveAmount || effectiveAmount < 1) {
      Alert.alert('Invalid Amount', 'Please select or enter an amount (min GHS 1)')
      return
    }
    if (phone.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter your MoMo phone number')
      return
    }
    if (!user?.id) {
      Alert.alert('Auth Required', 'Please verify your phone number first')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    setAnim({ state: 'loading', message: `Adding GH₵ ${effectiveAmount.toFixed(2)} to your wallet` })

    try {
      const res = await fetch(`${API_URL}/api/wallet/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: user.id,
          amount: effectiveAmount,
          phone,
          provider,
        }),
      })

      const data = await res.json()
      setLoading(false)

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setAnim({
          state: 'success',
          message: data.display_text || `A MoMo prompt was sent to +233${phone}. Approve it to add GH₵ ${effectiveAmount.toFixed(2)} to your wallet.`,
        })
      } else {
        setAnim(null)
        Alert.alert('Error', data.error || 'Failed to initiate top-up')
      }
    } catch {
      setLoading(false)
      setAnim(null)
      Alert.alert('Error', 'Network error. Please try again.')
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: t.text }]}>{PROVIDERS.find((p) => p.id === provider)?.label ?? 'Mobile Money'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Amount selection */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[s.sectionLabel, { color: t.textSecondary }]}>SELECT AMOUNT</Text>
          <View style={s.amountGrid}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[s.amountBtn, {
                  backgroundColor: amount === a ? BRAND : (isDark ? '#1c1917' : '#f5f5f4'),
                  borderColor: amount === a ? BRAND : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                }]}
                onPress={() => { setAmount(a); setCustomAmount(''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
              >
                <Text style={[s.amountBtnText, { color: amount === a ? '#fff' : t.text }]}>
                  GH₵ {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount */}
          <View style={[s.customRow, {
            backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          }]}>
            <Text style={[s.customPrefix, { color: t.textSecondary }]}>GH₵</Text>
            <TextInput
              style={[s.customInput, { color: t.text }]}
              placeholder="Other amount"
              placeholderTextColor={isDark ? '#57534e' : '#a8a29e'}
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={(v) => { setCustomAmount(v); setAmount(null) }}
            />
          </View>
        </Animated.View>

        {/* Phone number */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[s.sectionLabel, { color: t.textSecondary }]}>MOMO NUMBER</Text>
          <View style={[s.phoneRow, {
            backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          }]}>
            <Text style={s.phoneFlag}>🇬🇭</Text>
            <Text style={[s.phonePrefix, { color: t.text }]}>+233</Text>
            <TextInput
              style={[s.phoneInput, { color: t.text }]}
              placeholder="24 XXX XXXX"
              placeholderTextColor={isDark ? '#57534e' : '#a8a29e'}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </Animated.View>

        {/* Provider selection */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[s.sectionLabel, { color: t.textSecondary }]}>NETWORK</Text>
          <View style={s.providerRow}>
            {PROVIDERS.map((p) => {
              const sel = provider === p.id
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.providerBtn, {
                    backgroundColor: sel ? (isDark ? 'rgba(255,77,28,0.12)' : '#FFF0EB') : (isDark ? '#1c1917' : '#f5f5f4'),
                    borderColor: sel ? BRAND : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  }]}
                  onPress={() => { setProvider(p.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
                >
                  <NetworkLogo id={p.id as NetworkId} width={46} height={30} />
                  <Text style={[s.providerText, { color: sel ? BRAND : t.text }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>

        {/* Summary */}
        {effectiveAmount > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[s.summaryCard, {
            backgroundColor: isDark ? '#1c1917' : '#ffffff',
            borderColor: isDark ? 'rgba(255,77,28,0.1)' : 'rgba(0,0,0,0.04)',
          }]}>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: t.textSecondary }]}>Amount</Text>
              <Text style={[s.summaryValue, { color: t.text }]}>GH₵ {effectiveAmount.toFixed(2)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: t.textSecondary }]}>Fee</Text>
              <Text style={[s.summaryValue, { color: '#22c55e' }]}>Free</Text>
            </View>
            <View style={[s.summaryDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]} />
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: t.text, fontFamily: font.bold }]}>Total</Text>
              <Text style={[s.summaryTotal, { color: BRAND }]}>GH₵ {effectiveAmount.toFixed(2)}</Text>
            </View>
          </Animated.View>
        )}

        {/* Fund button */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <TouchableOpacity
            onPress={handleFund}
            disabled={loading || effectiveAmount < 1}
            activeOpacity={0.85}
            style={[s.fundBtn, { opacity: effectiveAmount < 1 ? 0.5 : 1 }]}
          >
            <MaterialIcons name="add-circle" size={20} color="#fff" />
            <Text style={s.fundBtnText}>
              {loading ? 'Processing...' : `Fund GH₵ ${effectiveAmount > 0 ? effectiveAmount.toFixed(2) : '0.00'}`}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <WalletTopUpAnimation
        visible={anim !== null}
        state={anim?.state ?? 'loading'}
        message={anim?.message ?? ''}
        onDone={() => { setAnim(null); router.back() }}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontFamily: font.bold },
  scroll: { paddingHorizontal: 20, gap: 24 },

  sectionLabel: { fontSize: 10, fontFamily: font.bold, letterSpacing: 2, marginBottom: 10 },

  // Amounts
  amountGrid: { flexDirection: 'row', gap: 10 },
  amountBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1,
  },
  amountBtnText: { fontSize: 16, fontFamily: font.bold },

  customRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, height: 56,
  },
  customPrefix: { fontSize: 16, fontFamily: font.bold, marginRight: 8 },
  customInput: { flex: 1, fontSize: 18, fontFamily: font.bold },

  // Phone
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, height: 56, gap: 8,
  },
  phoneFlag: { fontSize: 20 },
  phonePrefix: { fontSize: 16, fontFamily: font.bold },
  phoneInput: { flex: 1, fontSize: 18, fontFamily: font.semibold, letterSpacing: 1 },

  // Providers
  providerRow: { flexDirection: 'row', gap: 8 },
  providerBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, gap: 8,
  },
  providerText: { fontSize: 11, fontFamily: font.bold, textAlign: 'center' },

  // Summary
  summaryCard: { borderRadius: 14, padding: 16, gap: 10, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontFamily: font.medium },
  summaryValue: { fontSize: 14, fontFamily: font.bold },
  summaryDivider: { height: 1, marginVertical: 4 },
  summaryTotal: { fontSize: 20, fontFamily: font.extrabold },

  // Fund button
  fundBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, backgroundColor: BRAND,
  },
  fundBtnText: { fontSize: 16, fontFamily: font.bold, color: '#fff' },
})
