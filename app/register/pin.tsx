import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const PIN_LENGTH = 4
const PIN_STORAGE_KEY = 'troski_user_pin'

export default function CreatePIN() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inputRef = useRef<TextInput>(null)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [error, setError] = useState('')

  const currentPin = step === 'create' ? pin : confirmPin

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [step])

  const handleChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH)
    setError('')

    if (step === 'create') {
      setPin(digits)
      if (digits.length === PIN_LENGTH) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setTimeout(() => { setStep('confirm'); setConfirmPin('') }, 300)
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    } else {
      setConfirmPin(digits)
      if (digits.length === PIN_LENGTH) {
        if (digits === pin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          AsyncStorage.setItem(PIN_STORAGE_KEY, digits).then(() => {
            router.push('/register/survey' as any)
          })
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setError("PINs don't match. Try again.")
          setTimeout(() => { setStep('create'); setPin(''); setConfirmPin('') }, 500)
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={() => {
              if (step === 'confirm') { setStep('create'); setPin(''); setConfirmPin('') }
              else router.back()
            }}
            hitSlop={12}
            style={s.backBtn}
          >
            <ArrowLeft size={20} color="#0A0A0A" />
          </Pressable>
          <View style={s.stepBadge}>
            <Text style={s.stepText}>4/4</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleWrap}>
          <Text style={s.title}>
            {step === 'create' ? 'Create your\n4-digit PIN' : 'Confirm your\n4-digit PIN'}
          </Text>
          <Text style={s.subtitle}>You'll use this to sign in and approve transactions.</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        {/* PIN Dots */}
        <Pressable onPress={() => inputRef.current?.focus()} style={s.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[s.dot, i < currentPin.length && s.dotFilled]} />
          ))}
        </Pressable>

        {/* Hidden TextInput — system keyboard handles input */}
        <TextInput
          ref={inputRef}
          value={currentPin}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          secureTextEntry
          autoFocus
          style={s.hiddenInput}
        />

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient
              colors={currentPin.length < PIN_LENGTH ? ['#E0E0E0', '#D0D0D0'] : [BRAND, BRAND]}
              style={s.btn}
            >
              <Text style={[s.btnText, currentPin.length < PIN_LENGTH && { color: '#999' }]}>
                {step === 'create' ? 'Set PIN' : 'Confirm PIN'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  stepBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontWeight: '700', color: BRAND },

  titleWrap: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 32 },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#888', marginTop: 8 },
  error: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginTop: 8 },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 40 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },

  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },

  ctaWrap: { paddingHorizontal: 24, paddingTop: 16 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
})
