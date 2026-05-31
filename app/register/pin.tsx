import { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, Delete } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const PIN_LENGTH = 6
const PIN_STORAGE_KEY = 'troski_user_pin'
const { width } = Dimensions.get('window')
const KEY_SIZE = (width - 80) / 3

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function CreatePIN() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [error, setError] = useState('')

  const currentPin = step === 'create' ? pin : confirmPin

  const handlePress = useCallback((key: string) => {
    if (key === 'del') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      if (step === 'create') setPin(p => p.slice(0, -1))
      else setConfirmPin(p => p.slice(0, -1))
      setError('')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setError('')

    const newPin = (step === 'create' ? pin : confirmPin) + key
    if (newPin.length > PIN_LENGTH) return

    if (step === 'create') {
      setPin(newPin)
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => { setStep('confirm'); setConfirmPin('') }, 300)
      }
    } else {
      setConfirmPin(newPin)
      if (newPin.length === PIN_LENGTH) {
        if (newPin === pin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          AsyncStorage.setItem(PIN_STORAGE_KEY, newPin).then(() => {
            router.push('/register/survey' as any)
          })
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setError("PINs don't match. Try again.")
          setTimeout(() => { setStep('create'); setPin(''); setConfirmPin('') }, 500)
        }
      }
    }
  }, [step, pin, confirmPin, router])

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
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
          {step === 'create' ? 'Create your\n6-digit PIN' : 'Confirm your\n6-digit PIN'}
        </Text>
        <Text style={s.subtitle}>You'll use this to sign in and approve transactions.</Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      {/* PIN Dots */}
      <View style={s.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[s.dot, i < currentPin.length && s.dotFilled]} />
        ))}
      </View>

      {/* Number Pad */}
      <View style={s.pad}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            onPress={() => key && handlePress(key)}
            disabled={!key}
            style={({ pressed }) => [
              s.key,
              !key && s.keyEmpty,
              pressed && key ? s.keyPressed : null,
            ]}
          >
            {key === 'del' ? (
              <Delete size={24} color="#0A0A0A" />
            ) : (
              <Text style={s.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => currentPin.length === PIN_LENGTH && handlePress('')}
          disabled={currentPin.length < PIN_LENGTH}
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

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 32, marginBottom: 24 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },

  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 24 },
  key: { width: KEY_SIZE, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 16, margin: 4 },
  keyEmpty: { opacity: 0 },
  keyPressed: { backgroundColor: '#F2F2F2' },
  keyText: { fontSize: 32, fontWeight: '400', color: '#0A0A0A' },

  ctaWrap: { paddingHorizontal: 24, paddingTop: 16 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
})
