import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { supabase } from '@/lib/supabase/client'
import { useApp } from '@/lib/contexts/AppContext'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

export default function ReviewDetails() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { deviceId } = useApp()
  const params = useLocalSearchParams<{
    phone: string; email?: string; firstName: string; lastName: string; gender?: string; city?: string; referral?: string
  }>()
  const [saving, setSaving] = useState(false)

  const fullPhone = params.phone?.startsWith('+') ? params.phone : `+233${(params.phone || '').replace(/^0/, '')}`

  const details = [
    { label: 'Email', value: params.email || '—' },
    { label: 'Phone number', value: fullPhone },
    { label: 'City', value: params.city || '—' },
  ]

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSaving(true)

    try {
      const user = (await supabase.auth.getUser()).data.user
      const profileData: Record<string, any> = {
        email: params.email || null,
        first_name: params.firstName,
        last_name: params.lastName,
        gender: params.gender || null,
        city: params.city || null,
        referral_code: params.referral || null,
      }
      if (user) profileData.auth_user_id = user.id

      if (fullPhone) {
        await supabase.from('contributor_profiles').delete().eq('phone', fullPhone).neq('device_id', deviceId || '')
      }

      profileData.phone = fullPhone
      if (deviceId) {
        const { error } = await supabase.from('contributor_profiles').update(profileData).eq('device_id', deviceId)
        if (error) console.warn('[review] Profile update error:', error.message)
      }
    } catch (e) {
      console.warn('[review] Profile save error:', e)
    }

    setSaving(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    router.push('/register/pin' as any)
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
        <Text style={s.title}>Review details</Text>
        <Text style={s.subtitle}>Review your profile details before continuing</Text>
      </Animated.View>

      {/* Details card */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.card}>
        {details.map((d, i) => (
          <View key={i} style={[s.row, i < details.length - 1 && s.rowBorder]}>
            <Text style={s.rowLabel}>{d.label}</Text>
            <Text style={s.rowValue}>{d.value}</Text>
          </View>
        ))}
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* CTAs */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={handleConfirm} disabled={saving} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
          <LinearGradient colors={saving ? ['#E0E0E0', '#D0D0D0'] : [BRAND, BRAND]} style={s.btn}>
            <Text style={[s.btnText, saving && { color: '#999' }]}>{saving ? 'Saving...' : 'Confirm & Continue'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
          <View style={s.btnOutline}>
            <Text style={s.btnOutlineText}>Edit Details</Text>
          </View>
        </Pressable>

        <Text style={s.terms}>
          By tapping on "Confirm & Continue", you'll be agreeing to{'\n'}
          Troski's <Text style={s.termsLink} onPress={() => router.push('/terms' as never)}>Terms & Condition</Text> and <Text style={s.termsLink} onPress={() => router.push('/privacy' as never)}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#0A0A0A', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#888', marginTop: 10, lineHeight: 22 },

  card: { marginHorizontal: 24, marginTop: 28, borderRadius: 16, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 18 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowLabel: { fontSize: 14, fontWeight: '500', color: '#888' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },

  ctaWrap: { paddingHorizontal: 24, gap: 12 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnOutline: { height: 56, borderRadius: 14, backgroundColor: '#FFF0EB', borderWidth: 1.5, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '600', color: BRAND },

  terms: { fontSize: 11, color: '#AAA', textAlign: 'center', lineHeight: 16, marginTop: 4 },
  termsLink: { color: BRAND, fontWeight: '600' },
})
