import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { replaceStackWith } from '@/lib/navigation'
import { ArrowLeft } from 'lucide-react-native'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { OtpBoxes } from '@/components/OtpBoxes'
import { useApp } from '@/lib/contexts/AppContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { supabase } from '@/lib/supabase/client'
import { ownProfiles, type NameRow } from '@/lib/services/profileName'

const BRAND = '#FF4D1C'
const OTP_LENGTH = 6

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const { verifyOtp, linkToDevice, signInWithPhone } = useAuthContext()
  const { deviceId, refreshProfile } = useApp()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(60)
  const [resending, setResending] = useState(false)
  const inputRef = useRef<TextInput>(null)
  // Set synchronously: iOS autofill can fire onChange twice before a re-render,
  // and a second verify of a used code would show a false "Invalid Code".
  const verifying = useRef(false)

  useEffect(() => {
    if (timer <= 0) return
    const t = setInterval(() => setTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [timer])

  const fullPhone = phone?.startsWith('+') ? phone : `+233${(phone || '').replace(/^0/, '')}`

  const handleChange = async (next: string) => {
    if (verifying.current) return
    if (next.length > code.length) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCode(next)
    const complete = next.length === OTP_LENGTH

    if (complete && !verifying.current) {
      verifying.current = true
      setLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const { success, error } = await verifyOtp(phone || '', next)
      setLoading(false)
      verifying.current = false

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        if (deviceId) await linkToDevice(deviceId)
        // Clear signed-out flag
        await AsyncStorage.removeItem('troski_signed_out')
        // New accounts pick a name (one screen); returning ones go home.
        // replace, so Back doesn't return to the code screen.
        // The device profile may have just picked up the account's real name
        // (needsName copies it over); refetch so Home/Pulse show it.
        const goName = await needsName(deviceId)
        refreshProfile().catch(() => {})
        replaceStackWith(router, goName ? '/auth/name' : '/(tabs)')
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Invalid Code', error || 'Please try again')
        setCode('')
        inputRef.current?.focus()
      }
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ArrowLeft size={20} color="#0A0A0A" />
        </Pressable>
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.titleWrap}>
        <Text style={s.title}>Enter verification{'\n'}code</Text>
        <Text style={s.subtitle}>
          We sent a 6-digit code to{' '}
          <Text style={{ fontFamily: font.bold, color: '#0A0A0A' }}>{fullPhone}</Text>
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.changeLink}>Change number?</Text>
        </Pressable>
      </Animated.View>

      {/* OTP Grid */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)}>
        <OtpBoxes ref={inputRef} value={code} onChange={handleChange} length={OTP_LENGTH} autoFocus editable={!loading} />
      </Animated.View>

      {/* Resend */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)} style={s.resendRow}>
        <Text style={s.resendText}>Didn&apos;t receive code? </Text>
        {timer > 0 ? (
          <Text style={s.resendTimer}>
            Resend code in <Text style={{ color: BRAND, fontFamily: font.semibold }}>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text>
          </Text>
        ) : (
          <Pressable
            onPress={async () => {
              if (resending) return
              setResending(true)
              const { success } = await signInWithPhone(phone)
              setResending(false)
              if (success) {
                setTimer(60)
              } else {
                Alert.alert('Resend failed', 'Check your connection and try again.')
              }
            }}
          >
            <Text style={s.resendLink}>Resend</Text>
          </Pressable>
        )}
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Loading indicator */}
      {loading && (
        <Animated.View entering={FadeInDown.duration(200)} style={s.loadingWrap}>
          <Text style={s.loadingText}>Verifying...</Text>
        </Animated.View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontFamily: font.bold, color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 37 },
  subtitle: { fontSize: 15, fontFamily: font.regular, color: '#888', marginTop: 10, lineHeight: 22 },
  changeLink: { fontSize: 14, fontFamily: font.semibold, color: BRAND, marginTop: 8 },


  resendRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 20, alignItems: 'center' },
  resendText: { fontSize: 13, color: '#888' },
  resendTimer: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, fontFamily: font.bold, color: BRAND },

  loadingWrap: { alignItems: 'center', paddingBottom: 40 },
  loadingText: { fontSize: 15, fontFamily: font.semibold, color: BRAND },
})

const DEFAULT_NAME = /^Troski Fan #/
/**
 * After sign-in: does this person still need to pick a name?
 * A real name = a display name that isn't the auto-made "Troski Fan #XXXX"
 * (lib/services/rewards.ts), or a first name. Old sign-ups saved first_name
 * but never display_name, so they showed as "Troski Fan #…": when a real name
 * exists, copy it into their own display names still on the default.
 * Errors never block sign-in.
 */
async function needsName(deviceId: string | null): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const rows = await ownProfiles(session?.user.id, deviceId)
    if (!rows.length) return true
    const real = (r: NameRow) =>
      (r.display_name && !DEFAULT_NAME.test(r.display_name) ? r.display_name : null) || r.first_name || null
    const name = rows.map(real).find(Boolean)
    if (!name) return true
    const stale = rows.filter((r) => !r.display_name || DEFAULT_NAME.test(r.display_name)).map((r) => r.id)
    if (stale.length) {
      await supabase.from('contributor_profiles').update({ display_name: name }).in('id', stale)
    }
    return false
  } catch {
    return false
  }
}
