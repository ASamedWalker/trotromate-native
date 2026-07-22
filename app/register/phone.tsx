import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import StepIndicator from '@/components/StepIndicator'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

export default function RegisterPhone() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signInWithPhone } = useAuthContext()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (phone.length < 9) {
      Alert.alert('Invalid Number', 'Enter a valid Ghana phone number')
      return
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Enter a valid email address or leave it blank')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    const { success, error } = await signInWithPhone(phone)
    setLoading(false)

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.push({ pathname: '/register/verify', params: { phone, email } } as any)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error || 'Failed to send OTP')
    }
  }

  const canContinue = phone.length >= 9

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
            {/* This screen is reached via router.replace from onboarding, so the
                history can be empty — fall back to guest home instead of a dead
                back button */}
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))}
              hitSlop={12}
              style={s.backBtn}
            >
              <ArrowLeft size={20} color="#0A0A0A" />
            </Pressable>
            <StepIndicator current={1} total={4} />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.titleWrap}>
            <Text style={s.title}>Create your{'\n'}Troski account</Text>
            <Text style={s.subtitle}>Provide the details below to get started.</Text>
          </Animated.View>

          {/* Fields */}
          <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.fields}>
            <View style={s.fieldGroup}>
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
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Email Address</Text>
              <View style={[s.inputWrap, email.length > 0 && s.inputWrapActive]}>
                <TextInput
                  style={[s.input, { paddingLeft: 0 }]}
                  placeholder="you@example.com"
                  placeholderTextColor="#C4C4C4"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </Animated.View>

          <View style={{ flex: 1 }} />
        </ScrollView>

        {/* CTA — sticky bottom */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={handleContinue}
            disabled={loading || !canContinue}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient
              colors={canContinue ? [BRAND, BRAND] : ['#E0E0E0', '#D0D0D0']}
              style={s.btn}
            >
              <Text style={[s.btnText, !canContinue && { color: '#999' }]}>
                {loading ? 'Sending code...' : 'Continue'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  stepBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontFamily: font.bold, color: BRAND },

  // Title
  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontFamily: font.bold, color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 37 },
  subtitle: { fontSize: 15, fontFamily: font.regular, color: '#888', marginTop: 10, lineHeight: 22 },

  // Fields
  fields: { paddingHorizontal: 24, marginTop: 32, gap: 24 },
  fieldGroup: { gap: 10 },
  label: { fontSize: 14, fontFamily: font.semibold, color: '#333' },
  inputWrap: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputWrapActive: { borderColor: BRAND, backgroundColor: '#fff' },
  prefix: { fontSize: 16, fontFamily: font.semibold, color: '#0A0A0A', marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: font.medium, color: '#0A0A0A', paddingVertical: 0 },

  // CTA
  ctaWrap: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#fff' },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontFamily: font.semibold, color: '#fff' },
})
