import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import StepIndicator from '@/components/StepIndicator'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

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
    <View style={[s.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <ArrowLeft size={20} color="#0A0A0A" />
            </Pressable>
            <StepIndicator current={3} total={4} />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.titleWrap}>
            <Text style={s.title}>Create your{'\n'}personal profile</Text>
            <Text style={s.subtitle}>Start by creating your profile in just a few steps</Text>
          </Animated.View>

          {/* Fields */}
          <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.fields}>
            <Field label="First Name" value={firstName} onChange={setFirstName} placeholder="Enter first name" autoFocus />
            <Field label="Last Name" value={lastName} onChange={setLastName} placeholder="Enter last name" />
            <Field label="Gender" value={gender} onChange={setGender} placeholder="Select gender" />
            <Field label="City" value={city} onChange={setCity} placeholder="Enter city" />
            <Field label="Referral Code" value={referral} onChange={setReferral} placeholder="Optional" suffix="(Optional)" />
          </Animated.View>

          <View style={{ flex: 1 }} />
        </ScrollView>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient
              colors={canContinue ? [BRAND, BRAND] : ['#E0E0E0', '#D0D0D0']}
              style={s.btn}
            >
              <Text style={[s.btnText, !canContinue && { color: '#999' }]}>Continue</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

function Field({ label, value, onChange, placeholder, suffix, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; suffix?: string; autoFocus?: boolean
}) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>
        {label} {suffix && <Text style={s.labelSuffix}>{suffix}</Text>}
      </Text>
      <TextInput
        style={[s.input, value.length > 0 && s.inputActive]}
        placeholder={placeholder}
        placeholderTextColor="#C4C4C4"
        value={value}
        onChangeText={onChange}
        autoFocus={autoFocus}
      />
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

  fields: { paddingHorizontal: 24, marginTop: 28, gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: font.semibold, color: '#333' },
  labelSuffix: { fontSize: 12, fontFamily: font.regular, color: '#AAA' },
  input: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', paddingHorizontal: 16, fontSize: 16, fontFamily: font.medium, color: '#0A0A0A', backgroundColor: '#FAFAFA' },
  inputActive: { borderColor: BRAND, backgroundColor: '#FFF8F5' },

  ctaWrap: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#fff' },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontFamily: font.semibold, color: '#fff' },
})
