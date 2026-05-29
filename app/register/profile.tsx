import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

export default function RegisterProfile() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { phone, email } = useLocalSearchParams<{ phone: string; email?: string }>()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [city, setCity] = useState('')
  const [referral, setReferral] = useState('')

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0

  const handleContinue = () => {
    if (!canContinue) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: '/register/review',
      params: { phone, email, firstName, lastName, gender, city, referral },
    } as any)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#000" />
          </Pressable>
          <View style={s.stepBadge}>
            <Text style={s.stepText}>3/4</Text>
          </View>
        </View>

        <Text style={s.title}>Create your{'\n'}personal profile</Text>
        <Text style={s.subtitle}>Start by creating your profile in just few steps</Text>

        <View style={s.fields}>
          <Field label="First Name" value={firstName} onChange={setFirstName} placeholder="Enter first name" />
          <Field label="Last Name" value={lastName} onChange={setLastName} placeholder="Enter last name" />
          <Field label="Gender" value={gender} onChange={setGender} placeholder="Select gender" />
          <Field label="City" value={city} onChange={setCity} placeholder="Enter city" />
          <Field label="Referral Code" value={referral} onChange={setReferral} placeholder="Optional" suffix="(Optional)" />
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => [s.btn, !canContinue && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <Text style={s.btnText}>Continue</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function Field({ label, value, onChange, placeholder, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; suffix?: string
}) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>
        {label} {suffix && <Text style={s.labelSuffix}>{suffix}</Text>}
      </Text>
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        value={value}
        onChangeText={onChange}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  stepBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontWeight: '700', color: BRAND },
  title: { fontSize: 26, fontWeight: '700', color: '#000', paddingHorizontal: 24, lineHeight: 32 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginTop: 8 },
  fields: { paddingHorizontal: 24, marginTop: 28, gap: 18 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#333' },
  labelSuffix: { fontSize: 12, fontWeight: '400', color: '#aaa' },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#e5e5e5', paddingHorizontal: 16, fontSize: 16, fontWeight: '500', color: '#000', backgroundColor: '#fafafa' },
  ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#fff' },
  btn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
