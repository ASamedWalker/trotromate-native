import { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, Delete } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'
const PIN_LENGTH = 6
const PIN_STORAGE_KEY = 'troski_user_pin'

export default function CreatePIN() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [error, setError] = useState('')

  const currentPin = step === 'create' ? pin : confirmPin
  const setCurrentPin = step === 'create' ? setPin : setConfirmPin

  const handlePress = useCallback((digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setError('')

    if (digit === 'delete') {
      setCurrentPin(prev => prev.slice(0, -1))
      return
    }

    const newPin = currentPin + digit
    if (newPin.length > PIN_LENGTH) return
    setCurrentPin(newPin)

    // Auto-advance when 6 digits entered
    if (newPin.length === PIN_LENGTH) {
      if (step === 'create') {
        setTimeout(() => {
          setStep('confirm')
          setConfirmPin('')
        }, 200)
      } else {
        // Confirm step — check match
        if (newPin === pin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          AsyncStorage.setItem(PIN_STORAGE_KEY, newPin).then(() => {
            router.push('/register/survey' as any)
          })
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setError('PINs don\'t match. Try again.')
          setConfirmPin('')
          setStep('create')
          setPin('')
        }
      }
    }
  }, [currentPin, step, pin, setCurrentPin, router])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => step === 'confirm' ? (setStep('create'), setPin(''), setConfirmPin('')) : router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#000" />
        </Pressable>
        <View style={s.stepBadge}>
          <Text style={s.stepText}>{step === 'create' ? '4/4' : '5/4'}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={s.title}>{step === 'create' ? 'Create your\n6-digit PIN' : 'Confirm your\n6-digit PIN'}</Text>
      <Text style={s.subtitle}>You'll use this to sign in and approve transactions.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}

      {/* PIN dots */}
      <View style={s.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[s.dot, i < currentPin.length && s.dotFilled]} />
        ))}
      </View>

      {/* Number pad */}
      <View style={s.pad}>
        {keys.map((key, i) => (
          <Pressable
            key={i}
            onPress={() => key && handlePress(key)}
            disabled={!key}
            style={({ pressed }) => [s.key, !key && { opacity: 0 }, pressed && key && { backgroundColor: '#f0f0f0' }]}
          >
            {key === 'delete' ? (
              <Delete size={22} color="#000" />
            ) : (
              <Text style={s.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Pressable
          onPress={() => currentPin.length === PIN_LENGTH && handlePress('')}
          disabled={currentPin.length < PIN_LENGTH}
          style={({ pressed }) => [
            s.btn,
            currentPin.length < PIN_LENGTH && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={s.btnText}>{step === 'create' ? 'Set PIN' : 'Confirm PIN'}</Text>
        </Pressable>
      </View>
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
  error: { fontSize: 13, color: '#ef4444', paddingHorizontal: 24, marginTop: 8, fontWeight: '600' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 32, marginBottom: 32 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },

  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 40, gap: 0 },
  key: { width: '33.33%', height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  keyText: { fontSize: 28, fontWeight: '500', color: '#000' },

  btn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
