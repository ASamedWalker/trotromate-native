import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  Dimensions,
  FlatList,
  StyleSheet,
  Image,
  type ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'

const { width } = Dimensions.get('window')
const BRAND = '#FF4D1C'

// ─── Onboarding Slides ────────────────────────────────────

interface Slide {
  id: string
  image: any
  title: string
  subtitle: string
  showAuth?: boolean
}

const SLIDES: Slide[] = [
  {
    id: 'welcome1',
    image: require('@/assets/images/onboarding/ob_busstop_redskies_image.png'),
    title: 'Welcome to Troski',
    subtitle: 'Ghana\'s transport companion. Ride, connect, and move with confidence.',
  },
  {
    id: 'welcome2',
    image: require('@/assets/images/onboarding/ob_phone_image.png'),
    title: 'Welcome to Troski',
    subtitle: 'Ghana\'s transport companion. Ride, connect, and move with confidence.',
  },
  {
    id: 'queue',
    image: require('@/assets/images/onboarding/ob_illustrator_image.png'),
    title: 'Know Your Queue\nBefore You Leave',
    subtitle: 'Live queue lengths, bus status and smart routing so you never waste time at the station.',
    showAuth: true,
  },
  {
    id: 'wallet',
    image: require('@/assets/images/onboarding/ob_wallet_image.png'),
    title: 'Pay Your Fare\nFrom Your Wallet',
    subtitle: 'Top up your Troski wallet, scan your QR code and ride. No cash, no stress.',
    showAuth: true,
  },
  {
    id: 'traffic',
    image: require('@/assets/images/onboarding/ob_busstop_blueskies_image.png'),
    title: 'Beat Traffic\nArrive Calm',
    subtitle: 'Live congestion alerts on every corridor, smart departure windows and alternative routes when things get heavy.',
    showAuth: true,
  },
]

// ─── Main Component ───────────────────────────────────────

interface OnboardingFlowProps {
  onComplete: () => void
  deviceId: string | null
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), [])

  const handleGetStarted = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    flatListRef.current?.scrollToIndex({ index: 2, animated: true })
  }, [])

  const handleAuth = useCallback((_method: 'google' | 'apple') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onComplete()
    // Navigate to registration after completing onboarding
    setTimeout(() => router.push('/register/phone' as any), 100)
  }, [onComplete, router])

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onComplete()
    setTimeout(() => router.push('/auth/phone' as any), 100)
  }, [onComplete, router])

  const renderSlide = useCallback(({ item, index }: { item: Slide; index: number }) => {
    const isWelcome = index <= 1
    const showAuth = item.showAuth

    return (
      <View style={[s.slide, { width, paddingTop: insets.top }]}>
        {/* Illustration — centered in available space */}
        <View style={s.imageWrap}>
          <Image
            source={item.image}
            style={s.image}
            resizeMode="contain"
          />
        </View>

        {/* Copy — title + subtitle */}
        <View style={s.copy}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.subtitle}>{item.subtitle}</Text>
        </View>

        {/* Dots */}
        <View style={s.dotsInline}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === currentIndex && s.dotActive]} />
          ))}
        </View>

        {/* Action Buttons */}
        <View style={[s.actions, { paddingBottom: insets.bottom + 16 }]}>
          {isWelcome ? (
            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => [s.btnPrimary, pressed && { transform: [{ scale: 0.985 }] }]}
            >
              <Text style={s.btnPrimaryText}>Get Started</Text>
            </Pressable>
          ) : showAuth ? (
            <>
              <Pressable
                onPress={() => handleAuth('google')}
                style={({ pressed }) => [s.btnPrimary, pressed && { transform: [{ scale: 0.985 }] }]}
              >
                <Text style={s.btnPrimaryText}>Create an Account</Text>
              </Pressable>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Google */}
              <Pressable
                onPress={() => handleAuth('google')}
                style={({ pressed }) => [s.btnSecondary, pressed && { transform: [{ scale: 0.985 }] }]}
              >
                <Text style={s.googleG}>G</Text>
                <Text style={s.btnSecondaryText}>Continue with Google</Text>
              </Pressable>

              {/* Apple */}
              <Pressable
                onPress={() => handleAuth('apple')}
                style={({ pressed }) => [s.btnSecondary, s.btnApple, pressed && { transform: [{ scale: 0.985 }] }]}
              >
                <Text style={s.appleIcon}>{'\uF8FF'}</Text>
                <Text style={[s.btnSecondaryText, { color: '#fff' }]}>Continue with Apple</Text>
              </Pressable>

              {/* Login link */}
              <View style={s.loginRow}>
                <Text style={s.loginText}>Already have an account?</Text>
                <Pressable onPress={handleLogin}>
                  <Text style={s.loginLink}> Login</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    )
  }, [currentIndex, insets.top, handleGetStarted, handleAuth, handleLogin])

  return (
    <View style={s.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      {/* Dots now inline per slide — removed absolute overlay */}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  slide: { flex: 1, justifyContent: 'space-between' },

  // Image — centered in middle of screen
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: width * 0.6, height: width * 0.6 },

  // Copy — title + subtitle centered
  copy: { alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 30, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#555', lineHeight: 21, textAlign: 'center', maxWidth: 280, marginTop: 14 },

  // Dots inline (not absolute)
  dotsInline: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8E8E8' },
  dotActive: { width: 22, backgroundColor: BRAND, borderRadius: 4 },

  // Action Buttons — Stitch pattern
  actions: { paddingHorizontal: 26, gap: 12, paddingTop: 22 },

  btnPrimary: { height: 56, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 4 },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E8E8E8' },
  dividerText: { fontSize: 10, fontWeight: '500', color: '#B8B8B8', textTransform: 'uppercase' },

  btnSecondary: { height: 52, borderRadius: 14, backgroundColor: '#F2F2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#0A0A0A', letterSpacing: -0.1 },
  btnApple: { backgroundColor: '#0A0A0A' },

  googleG: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  appleIcon: { fontSize: 18, color: '#fff' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 4 },
  loginText: { fontSize: 14, fontWeight: '400', color: '#555' },
  loginLink: { fontSize: 14, fontWeight: '600', color: BRAND },

  // Remove old absolute dots (now inline)
  dotsRow: { display: 'none' } as any,
})
