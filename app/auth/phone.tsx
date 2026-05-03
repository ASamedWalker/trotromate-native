import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, useColorScheme, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Phone, ArrowLeft } from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function PhoneAuthScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()
  const { signInWithPhone } = useAuthContext()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (phone.length < 9) {
      Alert.alert('Invalid Number', 'Please enter a valid Ghana phone number')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    const { success, error } = await signInWithPhone(phone)
    setLoading(false)

    if (success) {
      router.push({ pathname: '/auth/verify', params: { phone } } as any)
    } else {
      Alert.alert('Error', error || 'Failed to send OTP. Try again.')
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={t.text} />
        </TouchableOpacity>

        <View style={s.content}>
          {/* Icon */}
          <Animated.View entering={FadeInDown.duration(400)} style={[s.iconWrap, {
            backgroundColor: isDark ? 'rgba(255,173,58,0.1)' : 'rgba(255,173,58,0.06)',
          }]}>
            <Phone size={28} color="#FFAD3A" />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={[s.title, { color: t.text }]}>Verify your number</Text>
            <Text style={[s.subtitle, { color: t.textSecondary }]}>
              We'll send a 6-digit code to verify your phone number
            </Text>
          </Animated.View>

          {/* Phone input */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.inputRow}>
            <View style={[s.prefixBox, {
              backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }]}>
              <Text style={s.flag}>🇬🇭</Text>
              <Text style={[s.prefix, { color: t.text }]}>+233</Text>
            </View>
            <TextInput
              style={[s.phoneInput, {
                backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: t.text,
              }]}
              placeholder="XX XXX XXXX"
              placeholderTextColor={isDark ? '#57534e' : '#a8a29e'}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.ctaWrap}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={phone.length < 9 || loading}
              activeOpacity={0.85}
              style={{ opacity: phone.length < 9 ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={['#FF716A', '#FFAD3A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.ctaBtn}
              >
                <Text style={s.ctaText}>{loading ? 'Sending...' : 'Continue'}</Text>
              </LinearGradient>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 24 },

  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
  },
  title: {
    fontSize: 26, fontFamily: font.extrabold, textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, fontFamily: font.regular, textAlign: 'center', marginTop: 8, lineHeight: 20,
  },

  inputRow: { flexDirection: 'row', gap: 10 },
  prefixBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, borderRadius: 14, borderWidth: 1,
  },
  flag: { fontSize: 20 },
  prefix: { fontSize: 16, fontFamily: font.bold },
  phoneInput: {
    flex: 1, fontSize: 18, fontFamily: font.bold,
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 14, borderWidth: 1, letterSpacing: 1,
  },

  ctaWrap: { marginTop: 8 },
  ctaBtn: {
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontFamily: font.bold, color: '#1c1917' },
})
