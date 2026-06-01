import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

const GoogleLogo = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
)

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

          {/* Logo + Brand */}
          <Animated.View entering={FadeInDown.duration(300)} style={s.brandWrap}>
            <Image
              source={require('@/assets/images/onboarding/ob_busstop_redskies_image.png')}
              style={s.heroImage}
              resizeMode="contain"
            />
            <Text style={s.brandName}>Troski</Text>
            <Text style={s.brandSub}>Ghana's Mobility Companion</Text>
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

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Google */}
            <Pressable onPress={handleSend} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={s.btnSocial}>
                <GoogleLogo />
                <Text style={s.btnSocialLabel}>Continue with Google</Text>
              </View>
            </Pressable>

            {/* Apple */}
            <Pressable onPress={handleSend} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={[s.btnSocial, s.btnApple]}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={[s.btnSocialLabel, s.btnAppleLabel]}>Continue with Apple</Text>
              </View>
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1 }} />
        </ScrollView>

        {/* Footer — Create Account link */}
        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.footerText}>
            Don't have an account?{' '}
            <Text style={s.footerLink} onPress={handleCreateAccount}>Sign Up</Text>
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Brand hero
  brandWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 8 },
  heroImage: { width: 140, height: 140, marginBottom: 16 },
  brandName: { fontSize: 32, fontWeight: '800', color: '#0A0A0A', letterSpacing: -1.2 },
  brandSub: { fontSize: 14, fontWeight: '400', color: '#888', marginTop: 4 },

  // Fields
  fields: { paddingHorizontal: 24, marginTop: 28, gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  inputWrap: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputWrapActive: { borderColor: BRAND, backgroundColor: '#FFF8F5' },
  prefix: { fontSize: 16, fontWeight: '600', color: '#0A0A0A', marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '500', color: '#0A0A0A', paddingVertical: 0 },

  // CTA section
  ctaSection: { paddingHorizontal: 24, marginTop: 24, gap: 12 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EBEBEB' },
  dividerText: { fontSize: 12, fontWeight: '500', color: '#BFBFBF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Social
  btnSocial: { height: 52, borderRadius: 14, backgroundColor: '#F5F5F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnSocialLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  btnApple: { backgroundColor: '#0A0A0A' },
  btnAppleLabel: { color: '#fff' },

  // Footer
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  footerText: { textAlign: 'center', fontSize: 14, color: '#888' },
  footerLink: { color: BRAND, fontWeight: '600' },
})
