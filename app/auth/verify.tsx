import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, useColorScheme, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ShieldCheck, ArrowLeft } from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useApp } from '@/lib/contexts/AppContext'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

const OTP_LENGTH = 6

export default function VerifyOtpScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const { verifyOtp, linkToDevice } = useAuthContext()
  const { deviceId } = useApp()

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(45)
  const inputRefs = useRef<(TextInput | null)[]>([])

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setInterval(() => setResendTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [resendTimer])

  const handleChange = async (text: string, index: number) => {
    const newOtp = [...otp]
    newOtp[index] = text
    setOtp(newOtp)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Auto-advance
    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-verify when all digits entered
    const fullCode = newOtp.join('')
    if (fullCode.length === OTP_LENGTH) {
      setLoading(true)
      const { success, error } = await verifyOtp(phone || '', fullCode)
      setLoading(false)

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // Link auth to existing device profile
        if (deviceId) await linkToDevice(deviceId)
        // Go back to wherever they came from
        router.back()
        router.back() // pop both auth screens
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Invalid Code', error || 'Please check the code and try again')
        setOtp(Array(OTP_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
      }
    }
  }

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    const { signInWithPhone } = require('@/lib/hooks/useAuth')
    // Re-trigger via context
    setResendTimer(45)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const displayPhone = phone ? `+233 ${phone.replace(/^0/, '')}` : '+233 XXX XXX XXXX'

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={t.text} />
        </TouchableOpacity>

        <View style={s.content}>
          {/* Icon */}
          <Animated.View entering={FadeInDown.duration(400)} style={[s.iconWrap, {
            backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)',
          }]}>
            <ShieldCheck size={28} color="#22c55e" />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={[s.title, { color: t.text }]}>Enter verification code</Text>
            <Text style={[s.subtitle, { color: t.textSecondary }]}>
              We sent a 6-digit code to{'\n'}
              <Text style={{ fontFamily: font.bold, color: t.text }}>{displayPhone}</Text>
            </Text>
          </Animated.View>

          {/* OTP boxes */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref }}
                style={[s.otpBox, {
                  backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
                  borderColor: digit
                    ? '#FFAD3A'
                    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  color: t.text,
                }]}
                value={digit}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </Animated.View>

          {/* Loading */}
          {loading && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={[s.loadingText, { color: c.amber500 }]}>Verifying...</Text>
            </Animated.View>
          )}

          {/* Resend */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.resendRow}>
            <Text style={[s.resendLabel, { color: t.textSecondary }]}>Didn't receive code?</Text>
            <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
              <Text style={[s.resendBtn, {
                color: resendTimer > 0 ? t.textSecondary : c.amber500,
              }]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { paddingHorizontal: 20, paddingTop: 8 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 24, alignItems: 'center' },

  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    fontSize: 26, fontFamily: font.extrabold, textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, fontFamily: font.regular, textAlign: 'center', marginTop: 8, lineHeight: 22,
  },

  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    width: 48, height: 56, borderRadius: 14, borderWidth: 2,
    textAlign: 'center', fontSize: 22, fontFamily: font.extrabold,
  },

  loadingText: { fontSize: 14, fontFamily: font.bold, textAlign: 'center' },

  resendRow: { alignItems: 'center', gap: 4 },
  resendLabel: { fontSize: 13, fontFamily: font.regular },
  resendBtn: { fontSize: 14, fontFamily: font.bold },
})
