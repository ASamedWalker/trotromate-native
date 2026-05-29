import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    const { success, error } = await signInWithPhone(phone)
    setLoading(false)

    if (success) {
      router.push({ pathname: '/register/verify', params: { phone, email } } as any)
    } else {
      Alert.alert('Error', error || 'Failed to send OTP')
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <View style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#000" />
          </Pressable>
          <View style={s.stepBadge}>
            <Text style={s.stepText}>1/4</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>Create your{'\n'}Troski account</Text>
        <Text style={s.subtitle}>Provide the details below to get started.</Text>

        {/* Fields */}
        <View style={s.fields}>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Phone Number</Text>
            <TextInput
              style={s.input}
              placeholder="+233 XX XXX XXXX"
              placeholderTextColor="#bbb"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Email Address</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor="#bbb"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      </View>

      {/* CTA */}
      <View style={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
        <Pressable
          onPress={handleContinue}
          disabled={loading || phone.length < 9}
          style={({ pressed }) => [
            s.btn,
            (loading || phone.length < 9) && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={s.btnText}>{loading ? 'Sending...' : 'Continue'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  stepBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 2, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontWeight: '700', color: BRAND },
  title: { fontSize: 26, fontWeight: '700', color: '#000', paddingHorizontal: 24, lineHeight: 32 },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#888', paddingHorizontal: 24, marginTop: 8 },
  fields: { paddingHorizontal: 24, marginTop: 32, gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#333' },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#e5e5e5', paddingHorizontal: 16, fontSize: 16, fontWeight: '500', color: '#000', backgroundColor: '#fafafa' },
  btn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
