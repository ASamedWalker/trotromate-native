import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { ArrowLeft } from 'lucide-react-native'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signInWithPhone } = useAuthContext()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (phone.length < 9) {
      Alert.alert('Invalid Number', 'Enter a valid Ghana phone number')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    const { success, error } = await signInWithPhone(phone)
    setLoading(false)

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.push({ pathname: '/auth/verify', params: { phone } } as any)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error || 'Failed to send OTP')
    }
  }

  const handleCreateAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.replace('/register/phone' as any)
  }

  const canContinue = phone.length >= 9

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Back — screen is replace-mounted from onboarding, so history can be
              empty; fall back to guest home instead of trapping the user here */}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))}
            hitSlop={12}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#0A0A0A" />
          </Pressable>

          {/* Logo + Brand */}
          <Animated.View entering={FadeInDown.duration(300)} style={s.brandWrap}>
            <Image
              source={require('@/assets/images/onboarding/ob_busstop_redskies_image.png')}
              style={s.heroImage}
              resizeMode="contain"
            />
            <Text style={s.brandName}>Troski</Text>
            <Text style={s.brandSub}>Ghana&apos;s Mobility Companion</Text>
          </Animated.View>

          {/* Phone input */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={s.fields}>
            <Text style={s.label}>Phone Number</Text>
            <View style={[s.inputWrap, phone.length > 0 && s.inputWrapActive]}>
              <Text style={s.prefix}>+233</Text>
              <TextInput
                style={s.input}
                placeholder="XX XXX XXXX"
                placeholderTextColor="#C4C4C4"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>
          </Animated.View>

          {/* Login CTA */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)} style={s.ctaSection}>
            <Pressable
              onPress={handleSend}
              disabled={loading || !canContinue}
              style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient
                colors={canContinue ? [BRAND, BRAND] : ['#E0E0E0', '#D0D0D0']}
                style={s.btn}
              >
                <Text style={[s.btnText, !canContinue && { color: '#999' }]}>
                  {loading ? 'Sending code...' : 'Log In'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text style={s.helperText}>We&apos;ll text you a 6-digit code to verify your number.</Text>
          </Animated.View>

          <View style={{ flex: 1 }} />
        </ScrollView>

        {/* Footer — Create Account link */}
        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.footerText}>
            Don&apos;t have an account?{' '}
            <Text style={s.footerLink} onPress={handleCreateAccount}>Sign Up</Text>
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginLeft: 20 },
  container: { flex: 1, backgroundColor: '#fff' },

  // Brand hero
  brandWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 8 },
  heroImage: { width: 140, height: 140, marginBottom: 16 },
  brandName: { fontSize: 32, fontFamily: font.extrabold, color: '#0A0A0A', letterSpacing: -1.2 },
  brandSub: { fontSize: 14, fontFamily: font.regular, color: '#888', marginTop: 4 },

  // Fields
  fields: { paddingHorizontal: 24, marginTop: 28, gap: 10 },
  label: { fontSize: 14, fontFamily: font.semibold, color: '#333' },
  inputWrap: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputWrapActive: { borderColor: BRAND, backgroundColor: '#FFF8F5' },
  prefix: { fontSize: 16, fontFamily: font.semibold, color: '#0A0A0A', marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: font.medium, color: '#0A0A0A', paddingVertical: 0 },

  // CTA section
  ctaSection: { paddingHorizontal: 24, marginTop: 24, gap: 12 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontFamily: font.semibold, color: '#fff' },

  helperText: { fontSize: 13, color: '#9A9A9A', textAlign: 'center', marginTop: 4, paddingHorizontal: 12 },

  // Footer
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  footerText: { textAlign: 'center', fontSize: 14, color: '#888' },
  footerLink: { color: BRAND, fontFamily: font.semibold },
})
