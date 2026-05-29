import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const OTP_LENGTH = 6

export default function VerifyOTP() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { phone, email } = useLocalSearchParams<{ phone: string; email?: string }>()
  const { verifyOtp } = useAuthContext()

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(60)
  const refs = useRef<(TextInput | null)[]>([])

  useEffect(() => {
    if (timer <= 0) return
    const t = setInterval(() => setTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [timer])

  const fullPhone = phone?.startsWith('+') ? phone : `+233${(phone || '').replace(/^0/, '')}`

  const handleChange = async (val: string, idx: number) => {
    const newOtp = [...otp]
    newOtp[idx] = val
    setOtp(newOtp)

    if (val && idx < OTP_LENGTH - 1) {
      refs.current[idx + 1]?.focus()
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    // Auto-verify when all digits entered
    if (newOtp.every(d => d !== '')) {
      setLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const { success, error } = await verifyOtp(phone || '', newOtp.join(''))
      setLoading(false)

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.push({ pathname: '/register/profile', params: { phone, email } } as any)
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Invalid Code', error || 'Please try again')
        setOtp(Array(OTP_LENGTH).fill(''))
        refs.current[0]?.focus()
      }
    }
  }

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
      const newOtp = [...otp]
      newOtp[idx - 1] = ''
      setOtp(newOtp)
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#000" />
        </Pressable>
        <View style={s.stepBadge}>
          <Text style={s.stepText}>2/4</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={s.title}>Confirm your{'\n'}phone number</Text>
      <Text style={s.subtitle}>Enter the 6-digit code sent to <Text style={{ fontWeight: '700', color: '#000' }}>{fullPhone}</Text></Text>
      <Pressable onPress={() => router.back()}>
        <Text style={s.changeLink}>Change number?</Text>
      </Pressable>

      {/* OTP Grid */}
      <View style={s.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={r => { refs.current[i] = r }}
            style={[s.otpCell, digit && s.otpCellFilled]}
            value={digit}
            onChangeText={v => handleChange(v.slice(-1), i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Resend */}
      <View style={s.resendRow}>
        <Text style={s.resendText}>Didn't receive code? </Text>
        {timer > 0 ? (
          <Text style={s.resendTimer}>Resend code in <Text style={{ color: BRAND }}>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text></Text>
        ) : (
          <Pressable onPress={() => { setTimer(60); /* resend OTP */ }}>
            <Text style={s.resendLink}>Resend</Text>
          </Pressable>
        )}
      </View>

      {/* Verify button */}
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Pressable
          onPress={() => handleChange('', OTP_LENGTH - 1)}
          disabled={loading || otp.some(d => !d)}
          style={({ pressed }) => [
            s.btn,
            (loading || otp.some(d => !d)) && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={s.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  stepBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontWeight: '700', color: BRAND },
  title: { fontSize: 26, fontWeight: '700', color: '#000', paddingHorizontal: 24, lineHeight: 32 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginTop: 8, lineHeight: 20 },
  changeLink: { fontSize: 14, fontWeight: '600', color: BRAND, paddingHorizontal: 24, marginTop: 6 },
  otpRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 32 },
  otpCell: { flex: 1, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fafafa', textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#000' },
  otpCellFilled: { borderColor: BRAND, backgroundColor: '#fff' },
  resendRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 20, alignItems: 'center' },
  resendText: { fontSize: 13, color: '#888' },
  resendTimer: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, fontWeight: '700', color: BRAND },
  btn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
