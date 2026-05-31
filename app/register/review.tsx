import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { supabase } from '@/lib/supabase/client'
import { useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

export default function ReviewDetails() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
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

    // Save profile to Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('contributor_profiles').upsert({
        auth_user_id: user.id,
        phone: fullPhone,
        email: params.email || null,
        first_name: params.firstName,
        last_name: params.lastName,
        gender: params.gender || null,
        city: params.city || null,
        referral_code: params.referral || null,
      }, { onConflict: 'auth_user_id' }).catch(e => console.warn('[review] Profile save:', e))
    }

    setSaving(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    router.push('/register/pin' as any)
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#000" />
        </Pressable>
      </View>

      <Text style={s.title}>Review details</Text>
      <Text style={s.subtitle}>Review your profile details before continuing</Text>

      {/* Details card */}
      <View style={s.card}>
        {details.map((d, i) => (
          <View key={i} style={[s.row, i < details.length - 1 && s.rowBorder]}>
            <Text style={s.rowLabel}>{d.label}</Text>
            <Text style={s.rowValue}>{d.value}</Text>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <Pressable onPress={handleConfirm} disabled={saving} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
          <LinearGradient colors={saving ? ['#E0E0E0', '#D0D0D0'] : [BRAND, BRAND]} style={s.btn}>
            <Text style={s.btnText}>{saving ? 'Saving...' : 'Confirm & Continue'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.back()} style={({ pressed }) => [s.btnOutline, pressed && { opacity: 0.7 }]}>
          <Text style={s.btnOutlineText}>Edit Details</Text>
        </Pressable>

        <Text style={s.terms}>
          By tapping on "Confirm & Continue", you'll be agreeing to{'\n'}
          Troski's <Text style={s.termsLink}>Terms & Condition</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#000', paddingHorizontal: 24 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginTop: 8 },
  card: { marginHorizontal: 24, marginTop: 28, borderRadius: 16, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowLabel: { fontSize: 14, fontWeight: '500', color: '#888' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#000' },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnOutline: { height: 56, borderRadius: 14, backgroundColor: '#FFF0EB', borderWidth: 1.5, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '700', color: BRAND },
  terms: { fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 16, marginTop: 4 },
  termsLink: { color: BRAND, fontWeight: '600' },
})
