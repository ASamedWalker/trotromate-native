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
        <View style={[s.imageWrap, { paddingTop: insets.top + (isWelcome ? 40 : 20) }]}>
          <Image
            source={item.image}
            style={s.image}
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

              <Pressable
                onPress={() => handleAuth('google')}
                style={({ pressed }) => [s.socialBtn, pressed && { opacity: 0.85 }]}
              >
                <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={s.socialIcon} />
                <Text style={s.socialBtnText}>Continue with Google</Text>
              </Pressable>

              <Pressable
                onPress={() => handleAuth('apple')}
                style={({ pressed }) => [s.socialBtn, s.socialBtnDark, pressed && { opacity: 0.85 }]}
              >
                <Text style={s.appleIcon}></Text>
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

  // Image
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  image: { width: width * 0.75, height: width * 0.75, maxHeight: 320 },

  // Content
  content: { paddingHorizontal: 28, paddingBottom: 80 },
  title: { fontSize: 24, fontWeight: '700', color: '#000', letterSpacing: -0.5, lineHeight: 30, marginBottom: 10 },
  subtitle: { fontSize: 14, fontWeight: '400', color: '#666', lineHeight: 21, marginBottom: 24 },

  // Primary button
  primaryBtn: { height: 52, borderRadius: 100, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Auth section
  authSection: { gap: 12 },
  socialBtn: { height: 52, borderRadius: 100, backgroundColor: '#f5f5f5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  socialBtnDark: { backgroundColor: '#000' },
  socialIcon: { width: 18, height: 18 },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  appleIcon: { fontSize: 18, color: '#fff' },
  loginLink: { textAlign: 'center', marginTop: 8, fontSize: 13, color: '#999' },
  loginLinkBold: { color: BRAND, fontWeight: '700' },

  // Dots
  dotsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  dotActive: { width: 24, backgroundColor: BRAND },
})
