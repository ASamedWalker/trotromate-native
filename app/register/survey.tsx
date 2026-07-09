import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { supabase } from '@/lib/supabase/client'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

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
  const [submitting, setSubmitting] = useState(false)

  const handleDone = async () => {
    if (submitting) return
    setSubmitting(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (selected) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('contributor_profiles').update({ referral_source: selected }).eq('auth_user_id', user.id)
        }
      } catch (e) { console.warn('[survey]', e) }
    }

    await completeOnboarding()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    router.replace('/(tabs)' as any)
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
        <Text style={s.title}>Just a moment...</Text>
        <Text style={s.subtitle}>How did you hear about us?</Text>
      </Animated.View>

      {/* Options */}
      <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.options}>
        {OPTIONS.map((option, i) => {
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
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={handleDone} disabled={submitting} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
          <LinearGradient colors={submitting ? ['#E0E0E0', '#D0D0D0'] : [BRAND, BRAND]} style={s.btn}>
            <Text style={s.btnText}>{submitting ? 'Setting up…' : 'Go to Home Screen'}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  titleWrap: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 28, fontFamily: font.bold, color: '#0A0A0A', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, fontFamily: font.regular, color: '#888', marginTop: 10 },

  options: { paddingHorizontal: 24, marginTop: 24, gap: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: BRAND },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: BRAND },
  optionText: { fontSize: 15, fontFamily: font.medium, color: '#333' },
  optionTextActive: { fontFamily: font.bold, color: '#0A0A0A' },

  ctaWrap: { paddingHorizontal: 24, paddingTop: 12 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  btnText: { fontSize: 16, fontFamily: font.semibold, color: '#fff' },
})
