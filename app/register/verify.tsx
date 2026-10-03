import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { OtpBoxes } from '@/components/OtpBoxes'
import StepIndicator from '@/components/StepIndicator'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const OTP_LENGTH = 6

export default function VerifyOTP() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { phone, email } = useLocalSearchParams<{ phone: string; email?: string }>()
  const { verifyOtp, signInWithPhone } = useAuthContext()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(60)
  const inputRef = useRef<TextInput>(null)
  // Set synchronously: iOS autofill can fire onChange twice before a re-render.
  const verifying = useRef(false)

  useEffect(() => {
    if (timer <= 0) return
    const t = setInterval(() => setTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [timer])

  const fullPhone = phone?.startsWith('+') ? phone : `+233${(phone || '').replace(/^0/, '')}`

  const handleChange = (next: string) => {
    if (verifying.current) return
    if (next.length > code.length) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCode(next)
    if (next.length === OTP_LENGTH) submitOtp(next)
  }

  const submitOtp = async (entered: string) => {
    if (verifying.current || entered.length < OTP_LENGTH) return
    verifying.current = true
    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const { success, error } = await verifyOtp(phone || '', entered)
    setLoading(false)
    verifying.current = false

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Signed in now: clear a flag left by an earlier sign-out, or the next
      // launch would open the sign-in page again.
      await AsyncStorage.removeItem('troski_signed_out')
      router.push({ pathname: '/register/profile', params: { phone, email } } as any)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Invalid Code', error || 'Please try again')
      setCode('')
      inputRef.current?.focus()
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ArrowLeft size={20} color="#0A0A0A" />
        </Pressable>
        <StepIndicator current={2} total={4} />
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.titleWrap}>
        <Text style={s.title}>Confirm your{'\n'}phone number</Text>
        <Text style={s.subtitle}>
          Enter the 6-digit code sent to{' '}
          <Text style={{ fontFamily: font.bold, color: '#0A0A0A' }}>{fullPhone}</Text>
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.changeLink}>Change number?</Text>
        </Pressable>
      </Animated.View>

      {/* OTP Grid */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)}>
        <OtpBoxes ref={inputRef} value={code} onChange={handleChange} length={OTP_LENGTH} autoFocus editable={!loading} />
      </Animated.View>

      {/* Resend */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)} style={s.resendRow}>
        <Text style={s.resendText}>Didn&apos;t receive code? </Text>
        {timer > 0 ? (
          <Text style={s.resendTimer}>
            Resend code in <Text style={{ color: BRAND, fontFamily: font.semibold }}>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text>
          </Text>
        ) : (
          <Pressable onPress={async () => { await signInWithPhone(phone || ''); setTimer(60) }}>
            <Text style={s.resendLink}>Resend</Text>
          </Pressable>
        )}
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(320).duration(400)} style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={() => submitOtp(code)}
          disabled={loading || code.length < OTP_LENGTH}
          style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient
            colors={(loading || code.length < OTP_LENGTH) ? ['#E0E0E0', '#D0D0D0'] : [BRAND, BRAND]}
            style={s.btn}
          >
            <Text style={[s.btnText, (loading || code.length < OTP_LENGTH) && { color: '#999' }]}>
              {loading ? 'Verifying...' : 'Verify'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontFamily: font.bold, color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 37 },
  subtitle: { fontSize: 15, fontFamily: font.regular, color: '#888', marginTop: 10, lineHeight: 22 },
  changeLink: { fontSize: 14, fontFamily: font.semibold, color: BRAND, marginTop: 8 },


  resendRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 20, alignItems: 'center' },
  resendText: { fontSize: 13, color: '#888' },
  resendTimer: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, fontFamily: font.bold, color: BRAND },

  ctaWrap: { paddingHorizontal: 24, paddingTop: 12 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontFamily: font.semibold, color: '#fff' },
})
