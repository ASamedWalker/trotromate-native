import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, BackHandler } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { replaceStackWith } from '@/lib/navigation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { Tap } from '@/components/ui'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BRAND = '#FF4D1C'
const INK = '#1C1917'
const INK2 = '#44403C' // 9:1 on paper (the old #888 / #9A9A9A failed contrast)
const PAPER = '#FAF6F2'

/**
 * One sign-in for everyone (owner-approved 3-screen sign-up, 2026-10-03):
 * phone → code (auth/verify) → name, only for new accounts (auth/name).
 * The same SMS code signs in an existing account or creates a new one, so
 * there is no separate "Sign Up" path any more. Guests can skip.
 */
export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signInWithPhone } = useAuthContext()
  // Arrived by signing out: no swipe back into the app (it looked like you
  // were still signed in). "Skip for now" is the explicit guest choice.
  const { from } = useLocalSearchParams<{ from?: string }>()
  const afterSignOut = from === 'signout'
  const inputRef = useRef<TextInput>(null)

  // While the number pad is open the intro copy hides so the field and the
  // button stay above the keyboard on small phones.
  const [kbOpen, setKbOpen] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  // Android hardware back after sign-out = skip (guest), not a silent pop
  // back into a screen that looked signed in.
  useEffect(() => {
    if (!afterSignOut) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleSkip(); return true })
    return () => sub.remove()
  })

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const canContinue = phone.replace(/\D/g, '').length >= 9

  const handleSend = async () => {
    if (!canContinue || loading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    const { success, error } = await signInWithPhone(phone)
    setLoading(false)
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.push({ pathname: '/auth/verify', params: { phone } } as any)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not send the code', error || 'Please try again')
    }
  }

  // Guest by choice: clear the signed-out flag so the next launch doesn't
  // open sign-in again. Likes and posts still work signed out (by phone).
  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await AsyncStorage.removeItem('troski_signed_out')
    replaceStackWith(router, '/(tabs)')
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ gestureEnabled: !afterSignOut }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.topBar}>
            <Text style={s.wordmark} accessibilityRole="header" accessibilityLabel="Troski">
              tr<Text style={{ color: '#F5A300' }}>o</Text>ski
            </Text>
            <Tap onPress={handleSkip} hitSlop={8} style={s.skip} accessibilityRole="button">
              <Text style={s.skipText}>Skip for now</Text>
            </Tap>
          </View>

          {/* Title always visible (the field autofocuses, so the keypad is
              usually open); only the longer line hides while typing. */}
          <Animated.View entering={FadeInDown.duration(300)} style={[s.intro, kbOpen && { marginTop: 16 }]}>
            <HeroText size={kbOpen ? 28 : 34} style={{ color: INK, letterSpacing: -0.6 }}>Sign in with your phone</HeroText>
            {!kbOpen && <Text style={s.lede}>Save your routes, keep your likes on every phone, and pay with your wallet.</Text>}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={s.fields}>
            <Text style={s.label}>Phone number</Text>
            {/* The whole box (incl. +233) opens the keypad */}
            {/* Plain Pressable, no press state: re-rendering this row on press-in
                cancelled the input's focus on iOS (as in Troski Pro). One plain
                style object (NativeWind drops array/function styles). */}
            <Pressable onPress={() => inputRef.current?.focus()} accessible={false} style={StyleSheet.flatten([s.field, phone.length > 0 && s.fieldActive])}>
              <Text style={s.prefix}>+233</Text>
              <View style={s.divider} />
              <TextInput
                ref={inputRef}
                style={s.input}
                placeholder="24 123 4567"
                placeholderTextColor="#8A817A"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^\d ]/g, ''))}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                maxLength={13}
                autoFocus
                accessibilityLabel="Phone number"
                returnKeyType="done"
                onSubmitEditing={handleSend}
              />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={s.cta}>
            <Tap
              onPress={handleSend}
              disabled={!canContinue || loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canContinue || loading }}
              style={StyleSheet.flatten([s.btn, !canContinue && s.btnOff])}
            >
              <Text style={[s.btnText, !canContinue && { color: '#78716C' }]}>{loading ? 'Sending code…' : 'Send code'}</Text>
            </Tap>
            <Text style={s.helper}>New to Troski? The same code creates your account.</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  wordmark: { fontFamily: font.extrabold, fontSize: 30, color: INK, letterSpacing: -0.6 },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  skipText: { fontFamily: font.bold, fontSize: 17, color: INK2 },

  intro: { marginTop: 28, gap: 8 },
  lede: { fontFamily: font.regular, fontSize: 18, color: INK2 },

  fields: { marginTop: 24, gap: 8 },
  label: { fontFamily: font.bold, fontSize: 17, color: INK },
  field: { height: 60, borderRadius: 16, borderWidth: 2, borderColor: '#D6D3D1', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  fieldActive: { borderColor: BRAND },
  prefix: { fontFamily: font.bold, fontSize: 20, color: INK },
  divider: { width: 1, height: 26, backgroundColor: '#D6D3D1' },
  input: { flex: 1, alignSelf: 'stretch', fontFamily: font.bold, fontSize: 22, color: INK, paddingVertical: 0 },

  cta: { marginTop: 18, gap: 12 },
  btn: { height: 58, borderRadius: 16, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: '#E7E5E4' },
  btnText: { fontFamily: font.bold, fontSize: 20, color: '#FFFFFF' },
  helper: { fontFamily: font.regular, fontSize: 16, color: INK2, textAlign: 'center' },
})
