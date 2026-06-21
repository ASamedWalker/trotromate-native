import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Delete, ShieldCheck, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { hasWalletPin, setWalletPin, verifyWalletPin } from '@/lib/services/walletPin'

const BRAND = '#FF4D1C'
const MAX_ATTEMPTS = 5

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  // Optional label, e.g. the amount being authorised
  subtitle?: string
}

type Phase = 'loading' | 'create' | 'confirm' | 'verify' | 'locked'

/**
 * PIN gate for wallet spending. If no PIN exists yet it walks the user through
 * creating one (enter → confirm); otherwise it verifies. Calls onSuccess once
 * the PIN is set/verified.
 */
export default function PinModal({ visible, onClose, onSuccess, subtitle }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [entry, setEntry] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const shake = useRef(new Animated.Value(0)).current

  // Decide create-vs-verify each time it opens
  useEffect(() => {
    if (!visible) return
    setEntry(''); setFirstPin(''); setError(''); setAttempts(0)
    setPhase('loading')
    hasWalletPin().then((has) => setPhase(has ? 'verify' : 'create'))
  }, [visible])

  const doShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }, [shake])

  const submit = useCallback(async (pin: string) => {
    if (phase === 'create') {
      setFirstPin(pin); setEntry(''); setError(''); setPhase('confirm'); return
    }
    if (phase === 'confirm') {
      if (pin === firstPin) {
        await setWalletPin(pin)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSuccess()
      } else {
        setError('PINs did not match. Try again.')
        setFirstPin(''); setEntry(''); setPhase('create'); doShake()
      }
      return
    }
    if (phase === 'verify') {
      const ok = await verifyWalletPin(pin)
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSuccess()
      } else {
        const n = attempts + 1
        setAttempts(n); setEntry(''); doShake()
        if (n >= MAX_ATTEMPTS) { setPhase('locked'); setError('Too many attempts. Try again later.') }
        else setError(`Wrong PIN. ${MAX_ATTEMPTS - n} attempt${MAX_ATTEMPTS - n === 1 ? '' : 's'} left.`)
      }
    }
  }, [phase, firstPin, attempts, onSuccess, doShake])

  // Auto-submit when 4 digits entered — guarded so it fires once per entry
  // (the submit callback's identity changes across phases, which would
  // otherwise re-run this effect and double-submit).
  const submittingRef = useRef(false)
  useEffect(() => {
    if (entry.length === 4 && !submittingRef.current) {
      submittingRef.current = true
      submit(entry)
    } else if (entry.length < 4) {
      submittingRef.current = false
    }
  }, [entry, submit])

  const press = (d: string) => {
    if (phase === 'locked') return
    Haptics.selectionAsync()
    setError('')
    setEntry((e) => (e.length < 4 ? e + d : e))
  }
  const back = () => { Haptics.selectionAsync(); setEntry((e) => e.slice(0, -1)) }

  const title =
    phase === 'create' ? 'Create a wallet PIN'
    : phase === 'confirm' ? 'Confirm your PIN'
    : phase === 'locked' ? 'Wallet locked'
    : 'Enter wallet PIN'
  const hint =
    phase === 'create' ? 'Secure your wallet — you’ll use this to pay.'
    : phase === 'confirm' ? 'Re-enter the 4 digits.'
    : subtitle || 'Enter your 4-digit PIN to pay.'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.close}><X size={20} color="#9CA3AF" /></TouchableOpacity>
          <View style={s.badge}><ShieldCheck size={24} color={BRAND} /></View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.hint}>{hint}</Text>

          <Animated.View style={[s.dots, { transform: [{ translateX: shake }] }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[s.dot, i < entry.length && s.dotFilled, !!error && s.dotError]} />
            ))}
          </Animated.View>
          {!!error && <Text style={s.error}>{error}</Text>}

          {phase !== 'locked' && (
            <View style={s.pad}>
              {['1','2','3','4','5','6','7','8','9'].map((d) => (
                <TouchableOpacity key={d} style={s.key} onPress={() => press(d)} activeOpacity={0.6}>
                  <Text style={s.keyText}>{d}</Text>
                </TouchableOpacity>
              ))}
              <View style={s.key} />
              <TouchableOpacity style={s.key} onPress={() => press('0')} activeOpacity={0.6}>
                <Text style={s.keyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.key} onPress={back} activeOpacity={0.6}>
                <Delete size={24} color="#111" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36, alignItems: 'center' },
  close: { position: 'absolute', top: 16, right: 16, padding: 4 },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  title: { fontFamily: font.bold, fontSize: 20, color: '#111', marginTop: 14 },
  hint: { fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  dots: { flexDirection: 'row', gap: 16, marginTop: 24, marginBottom: 8 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },
  dotError: { borderColor: '#EF4444' },
  error: { fontFamily: font.medium, fontSize: 13, color: '#EF4444', marginTop: 4 },

  pad: { width: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20, rowGap: 12 },
  key: { width: 90, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: font.bold, fontSize: 26, color: '#111' },
})
