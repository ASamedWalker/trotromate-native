import { useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { replaceStackWith } from '@/lib/navigation'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { Tap } from '@/components/ui'
import { supabase } from '@/lib/supabase/client'
import { useApp } from '@/lib/contexts/AppContext'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { ownProfiles } from '@/lib/services/profileName'

const BRAND = '#FF4D1C'
const INK = '#1C1917'
const INK2 = '#44403C'
const PAPER = '#FAF6F2'
const CITIES = ['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Other']

/**
 * Screen 3 of the sign-up, new accounts only (auth/verify decides).
 * Replaces register/profile + review + pin + survey (owner-approved
 * 2026-10-03): the wallet PIN is created at the first payment (PinModal),
 * gender/email/last name were unused, and the survey was dropped.
 */
export default function NameScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { deviceId, refreshProfile } = useApp()
  const { user } = useAuthContext()
  const { completeOnboarding } = useOnboarding()
  const [name, setName] = useState('')
  const [city, setCity] = useState<string | null>(null)
  const [showReferral, setShowReferral] = useState(false)
  const [referral, setReferral] = useState('')
  const [saving, setSaving] = useState(false)
  const [refError, setRefError] = useState<string | null>(null)
  const busy = useRef(false)

  const trimmed = name.trim().replace(/\s+/g, ' ')
  const canSave = trimmed.length >= 2 && trimmed.length <= 30

  const finish = async () => {
    await completeOnboarding().catch(() => {})
    replaceStackWith(router, '/(tabs)')
  }

  const handleSave = async () => {
    if (!canSave || busy.current) return
    busy.current = true
    setSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      // A friend's code must exist (checked first, so a typo can be fixed).
      // It's recorded as a referral; it used to be written into this
      // profile's OWN referral_code (unique), which failed the whole save.
      const code = referral.trim().toUpperCase()
      let referrerDevice: string | null = null
      if (code) {
        const { data: ref } = await supabase.from('contributor_profiles').select('device_id').eq('referral_code', code).maybeSingle()
        if (!ref?.device_id) {
          setRefError("We couldn't find that referral code. Check it, or clear it to continue.")
          return
        }
        referrerDevice = ref.device_id
      }

      // Only this person's own profiles (see ownProfiles: a shared phone's
      // row may belong to someone else).
      const rows = await ownProfiles(user?.id, deviceId)
      if (!rows.length) throw new Error('Your profile was not found. Please try again.')
      const fields = { display_name: trimmed, first_name: trimmed.split(' ')[0], city: city === 'Other' ? null : city }
      const { data, error } = await supabase.from('contributor_profiles').update(fields).in('id', rows.map((r) => r.id)).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Your profile was not found. Please try again.')

      if (referrerDevice && deviceId && referrerDevice !== deviceId) {
        const { error: refErr } = await supabase.from('referrals').insert({ referrer_device_id: referrerDevice, referred_device_id: deviceId, referral_code: code })
        // 23505 = this phone was already referred: fine. Others don't block sign-up.
        if (refErr && refErr.code !== '23505') console.warn('[signup] referral not recorded:', refErr.message)
      }

      await refreshProfile().catch(() => {})
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await finish()
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not save your name', e?.message || 'Please check your connection and try again.')
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Signed in already: no swipe back to the code screen */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 8 }}>
            {user?.phone ? <Text style={s.verified}>Phone verified · {formatPhone(user.phone)}</Text> : null}
            <HeroText size={34} style={{ color: INK, letterSpacing: -0.6 }}>What should we call you?</HeroText>
            <Text style={s.lede}>Shown on your Pulse posts and the leaderboard.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={s.block}>
            <Text style={s.label}>Your name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ama"
              placeholderTextColor="#8A817A"
              autoFocus
              autoCapitalize="words"
              textContentType="givenName"
              autoComplete="name-given"
              maxLength={30}
              returnKeyType="done"
              accessibilityLabel="Your name"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(130).duration(320)} style={s.block}>
            <Text style={s.label}>Where do you ride most?</Text>
            <View style={s.chips}>
              {CITIES.map((c) => {
                const on = city === c
                return (
                  <Tap
                    key={c}
                    onPress={() => { Haptics.selectionAsync(); setCity(on ? null : c) }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={StyleSheet.flatten([s.chip, on && s.chipOn])}
                  >
                    <Text style={[s.chipText, on && { fontFamily: font.bold }]}>{c}</Text>
                  </Tap>
                )
              })}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(170).duration(320)}>
            {showReferral ? (
              <View style={s.block}>
                <Text style={s.label}>Referral code</Text>
                <TextInput
                  style={s.input}
                  value={referral}
                  onChangeText={(v) => { setReferral(v); setRefError(null) }}
                  placeholder="From a friend"
                  placeholderTextColor="#8A817A"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={16}
                  accessibilityLabel="Referral code"
                />
                {refError ? <Text style={s.refError} accessibilityLiveRegion="polite">{refError}</Text> : null}
              </View>
            ) : (
              <Tap onPress={() => setShowReferral(true)} accessibilityRole="button" style={s.linkBtn}>
                <Text style={s.link}>Have a referral code?</Text>
              </Tap>
            )}
          </Animated.View>

          <View style={{ flex: 1, minHeight: 24 }} />

          <View style={{ gap: 10, paddingBottom: insets.bottom + 8 }}>
            <Tap
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave || saving }}
              style={StyleSheet.flatten([s.btn, !canSave && s.btnOff])}
            >
              <Text style={[s.btnText, !canSave && { color: '#78716C' }]}>{saving ? 'Saving…' : 'Start using Troski'}</Text>
            </Tap>
            <Text style={s.terms}>
              By continuing you agree to Troski&apos;s{' '}
              <Text style={s.termsLink} accessibilityRole="link" onPress={() => Linking.openURL('https://www.troski.me/terms')}>Terms</Text> and{' '}
              <Text style={s.termsLink} accessibilityRole="link" onPress={() => Linking.openURL('https://www.troski.me/privacy')}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

/** +233241234567 -> +233 24 123 4567 */
function formatPhone(raw: string): string {
  const p = raw.startsWith('+') ? raw : `+${raw}`
  const m = p.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : p
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28 },
  verified: { fontFamily: font.bold, fontSize: 16, color: '#15803D' },
  lede: { fontFamily: font.regular, fontSize: 18, color: INK2 },
  block: { marginTop: 22, gap: 8 },
  label: { fontFamily: font.bold, fontSize: 17, color: INK },
  input: { height: 58, borderRadius: 16, borderWidth: 2, borderColor: '#D6D3D1', backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontFamily: font.medium, fontSize: 20, color: INK, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 2, borderColor: '#D6D3D1', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { borderColor: BRAND, backgroundColor: '#FFF4EF' },
  chipText: { fontFamily: font.semibold, fontSize: 17, color: INK },
  linkBtn: { marginTop: 18, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: font.bold, fontSize: 17, color: '#C2410C' },
  btn: { height: 58, borderRadius: 16, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: '#E7E5E4' },
  btnText: { fontFamily: font.bold, fontSize: 20, color: '#FFFFFF' },
  terms: { fontFamily: font.regular, fontSize: 15, color: INK2, textAlign: 'center' },
  termsLink: { fontFamily: font.bold, color: '#C2410C' },
  refError: { fontFamily: font.semibold, fontSize: 15, color: '#B91C1C' },
})
