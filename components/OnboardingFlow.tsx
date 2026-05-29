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
      <View style={[s.slide, { width }]}>
        {/* Illustration */}
        <View style={[s.imageWrap, { paddingTop: insets.top + (isWelcome ? 48 : 24) }]}>
          <Image
            source={item.image}
            style={[s.image, { backgroundColor: 'transparent' }]}
            resizeMode="contain"
          />
        </View>

        {/* Content */}
        <View style={s.content}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.subtitle}>{item.subtitle}</Text>

          {/* Welcome CTA */}
          {isWelcome && (
            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={s.primaryBtnText}>Get Started</Text>
            </Pressable>
          )}

          {/* Auth buttons */}
          {showAuth && (
            <View style={s.authSection}>
              <Pressable
                onPress={() => handleAuth('google')}
                style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={s.primaryBtnText}>Create an Account</Text>
              </Pressable>

              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              <Pressable
                onPress={() => handleAuth('google')}
                style={({ pressed }) => [s.socialBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={s.googleG}>G</Text>
                <Text style={s.socialBtnText}>Continue with Google</Text>
              </Pressable>

              <Pressable
                onPress={() => handleAuth('apple')}
                style={({ pressed }) => [s.socialBtn, s.socialBtnDark, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={s.appleIcon}>{'\uF8FF'}</Text>
                <Text style={[s.socialBtnText, { color: '#fff' }]}>Continue with Apple</Text>
              </Pressable>

              <Pressable onPress={handleLogin}>
                <Text style={s.loginLink}>Already have an account? <Text style={s.loginLinkBold}>Login</Text></Text>
              </Pressable>
            </View>
          )}
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

      {/* Dots indicator */}
      <View style={[s.dotsRow, { bottom: insets.bottom + 16 }]}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[s.dot, i === currentIndex && s.dotActive]}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  slide: { flex: 1 },

  // Image — centered, takes proportional space
  imageWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 8, height: width * 0.7 },
  image: { width: width * 0.65, height: width * 0.65 },

  // Content — centered below image, fills remaining space
  content: { flex: 1, paddingHorizontal: 26, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 50 },
  title: { fontSize: 26, fontWeight: '700', color: '#0A0A0A', letterSpacing: -0.8, lineHeight: 32, marginBottom: 14, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#555', lineHeight: 21, marginBottom: 20, textAlign: 'center', maxWidth: 280 },

  // Primary button
  primaryBtn: { height: 56, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 4 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },

  // Auth section
  authSection: { gap: 12, width: '100%' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E8E8E8' },
  dividerText: { fontSize: 13, fontWeight: '500', color: '#B8B8B8' },
  socialBtn: { height: 56, borderRadius: 14, backgroundColor: '#F2F2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' },
  socialBtnDark: { backgroundColor: '#0A0A0A' },
  googleG: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  socialBtnText: { fontSize: 16, fontWeight: '600', color: '#0A0A0A', letterSpacing: -0.2 },
  appleIcon: { fontSize: 20, color: '#fff' },
  loginLink: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '400', color: '#555' },
  loginLinkBold: { color: BRAND, fontWeight: '600' },

  // Dots
  dotsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8E8E8' },
  dotActive: { width: 22, borderRadius: 4, backgroundColor: BRAND },
})
