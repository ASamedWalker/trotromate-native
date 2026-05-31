import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { supabase } from '@/lib/supabase/client'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

const OPTIONS = [
  'Social Media',
  'Youtube',
  'Friend or family',
  'Influencer',
  'Online Ads',
  'Blog or article',
  'Event',
  'Other',
]

export default function HowDidYouHear() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { completeOnboarding } = useOnboarding()
  const [selected, setSelected] = useState<string | null>(null)

  const handleDone = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Save survey response (fire and forget)
    if (selected) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await supabase.from('contributor_profiles')
            .update({ referral_source: selected })
            .eq('auth_user_id', user.id)
        } catch (e) { console.warn('[survey]', e) }
      }
    }

    // Mark onboarding done + navigate to home
    await completeOnboarding()
    router.replace('/(tabs)' as any)
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#000" />
        </Pressable>
      </View>

      <Text style={s.title}>Just a moment...</Text>
      <Text style={s.subtitle}>How did you hear about us?</Text>

      {/* Options */}
      <View style={s.options}>
        {OPTIONS.map(option => {
          const isSelected = selected === option
          return (
            <Pressable
              key={option}
              onPress={() => { setSelected(option); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
              style={s.option}
            >
              <View style={[s.radio, isSelected && s.radioActive]}>
                {isSelected && <View style={s.radioDot} />}
              </View>
              <Text style={[s.optionText, isSelected && s.optionTextActive]}>{option}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* CTA */}
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [s.btn, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <Text style={s.btnText}>Go to Home Screen</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#000', paddingHorizontal: 24 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginTop: 8 },
  options: { paddingHorizontal: 24, marginTop: 24, gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: BRAND },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND },
  optionText: { fontSize: 15, fontWeight: '500', color: '#333' },
  optionTextActive: { fontWeight: '700', color: '#000' },
  btn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
