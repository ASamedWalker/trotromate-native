import { useEffect, useRef } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native'
import { Wallet as WalletIcon, Check } from 'lucide-react-native'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const COIN_X = [-52, -18, 18, 52] // horizontal offsets for the falling coins

/**
 * "Money dropping into a wallet" top-up animation (RN Animated — no native
 * Lottie dep, so it ships without a rebuild). Coins fall and drop into a
 * wallet on a loop while the MoMo request is in flight, then a success check
 * pops on confirmation. To swap for a real Lottie later: install
 * lottie-react-native (native rebuild) and replace the <Coins/> + wallet block
 * with a <LottieView source={...} autoPlay loop />.
 */
export default function WalletTopUpAnimation({
  visible,
  state,
  message,
  onDone,
}: {
  visible: boolean
  state: 'loading' | 'success'
  message: string
  onDone: () => void
}) {
  const drops = useRef(COIN_X.map(() => new Animated.Value(0))).current
  const bounce = useRef(new Animated.Value(0)).current
  const check = useRef(new Animated.Value(0)).current

  // Looping coin drop
  useEffect(() => {
    if (!visible) return
    const loops = drops.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 380),
          Animated.timing(v, { toValue: 1, duration: 1150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay((COIN_X.length - i) * 380 + 400),
        ]),
      ),
    )
    // subtle wallet "receive" pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(bounce, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    )
    loops.forEach((l) => l.start())
    pulse.start()
    return () => { loops.forEach((l) => l.stop()); pulse.stop() }
  }, [visible, drops, bounce])

  // Success check pop
  useEffect(() => {
    if (state === 'success') {
      Animated.spring(check, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }).start()
    } else {
      check.setValue(0)
    }
  }, [state, check])

  const walletScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.stage}>
            {/* Falling coins */}
            {drops.map((v, i) => {
              const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-118, 30] })
              const opacity = v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] })
              const scale = v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.6, 1, 0.35] })
              return (
                <Animated.View
                  key={i}
                  style={[s.coin, { left: 90 + COIN_X[i] - 23, transform: [{ translateY }, { scale }], opacity }]}
                >
                  <Text style={s.coinText}>₵</Text>
                </Animated.View>
              )
            })}

            {/* Wallet */}
            <Animated.View style={[s.wallet, { transform: [{ scale: walletScale }] }]}>
              <WalletIcon size={56} color="#fff" strokeWidth={2} />
            </Animated.View>

            {/* Pending badge — the money has NOT landed yet (no webhook); a green
                check here read as "paid" before the user even approved (UX-19) */}
            {state === 'success' && (
              <Animated.View style={[s.checkBadge, { backgroundColor: '#F59E0B', transform: [{ scale: check }] }]}>
                <Check size={18} color="#fff" strokeWidth={3.5} />
              </Animated.View>
            )}
          </View>

          <Text style={s.title}>{state === 'success' ? 'Approve on your phone' : 'Sending MoMo request…'}</Text>
          <Text style={s.message}>{message}</Text>

          {state === 'success' ? (
            <TouchableOpacity activeOpacity={0.9} onPress={onDone} style={s.doneBtn}>
              <Text style={s.doneText}>View Wallet</Text>
            </TouchableOpacity>
          ) : (
            <ActivityIndicator color={BRAND} style={{ marginTop: 18 }} />
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 24, paddingTop: 12, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center' },
  stage: { width: 180, height: 180, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  coin: { position: 'absolute', top: 0, width: 46, height: 46, borderRadius: 23, backgroundColor: '#FBBF24', borderWidth: 2, borderColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  coinText: { fontFamily: font.extrabold, fontSize: 24, color: '#7C4A00' },
  wallet: { width: 96, height: 96, borderRadius: 28, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 },
  checkBadge: { position: 'absolute', top: 56, right: 28, width: 30, height: 30, borderRadius: 15, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  title: { fontFamily: font.bold, fontSize: 18, color: '#1c1917', marginTop: 8, textAlign: 'center' },
  message: { fontFamily: font.regular, fontSize: 14, color: '#78716c', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  doneBtn: { marginTop: 20, alignSelf: 'stretch', height: 50, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
