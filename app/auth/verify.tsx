import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useApp } from '@/lib/contexts/AppContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const OTP_LENGTH = 6

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const { verifyOtp, linkToDevice } = useAuthContext()
  const { deviceId } = useApp()

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

    if (newOtp.every(d => d !== '')) {
      setLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const { success, error } = await verifyOtp(phone || '', newOtp.join(''))
      setLoading(false)

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        if (deviceId) await linkToDevice(deviceId)
        // Navigate to home — pop auth screens
        router.back()
        router.back()
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
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ArrowLeft size={20} color="#0A0A0A" />
        </Pressable>
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.titleWrap}>
        <Text style={s.title}>Enter verification{'\n'}code</Text>
        <Text style={s.subtitle}>
          We sent a 6-digit code to{' '}
          <Text style={{ fontWeight: '700', color: '#0A0A0A' }}>{fullPhone}</Text>
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.changeLink}>Change number?</Text>
        </Pressable>
      </Animated.View>

      {/* OTP Grid */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.otpRow}>
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
            autoFocus={i === 0}
          />
        ))}
      </Animated.View>

      {/* Resend */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)} style={s.resendRow}>
        <Text style={s.resendText}>Didn't receive code? </Text>
        {timer > 0 ? (
          <Text style={s.resendTimer}>
            Resend code in <Text style={{ color: BRAND, fontWeight: '600' }}>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text>
          </Text>
        ) : (
          <Pressable onPress={() => setTimer(60)}>
            <Text style={s.resendLink}>Resend</Text>
          </Pressable>
        )}
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Loading indicator */}
      {loading && (
        <Animated.View entering={FadeInDown.duration(200)} style={s.loadingWrap}>
          <Text style={s.loadingText}>Verifying...</Text>
        </Animated.View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 34 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#888', marginTop: 10, lineHeight: 22 },
  changeLink: { fontSize: 14, fontWeight: '600', color: BRAND, marginTop: 8 },

  otpRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 32 },
  otpCell: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#0A0A0A' },
  otpCellFilled: { borderColor: BRAND, backgroundColor: '#FFF8F5' },

  resendRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 20, alignItems: 'center' },
  resendText: { fontSize: 13, color: '#888' },
  resendTimer: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, fontWeight: '700', color: BRAND },

  loadingWrap: { alignItems: 'center', paddingBottom: 40 },
  loadingText: { fontSize: 15, fontWeight: '600', color: BRAND },
})
