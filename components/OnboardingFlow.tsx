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
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const { width, height: SCREEN_H } = Dimensions.get('window')
const BRAND = '#FF4D1C'
const BRAND_DEEP = '#E94817'

// ─── Slides (4 total — merged welcome) ─────────────────────

interface Slide {
  id: string
  image: any
  title: string
  subtitle: string
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    image: require('@/assets/images/onboarding/ob_busstop_redskies_image.png'),
    title: 'Welcome to Troski',
    subtitle: 'Ghana\'s transport companion.\nRide, connect, and move with confidence.',
  },
  {
    id: 'queue',
    image: require('@/assets/images/onboarding/ob_illustrator_image.png'),
    title: 'Know Your Queue\nBefore You Leave',
    subtitle: 'Live queue depths, bay status and departure times for every terminal across Accra.',
  },
  {
    id: 'wallet',
    image: require('@/assets/images/onboarding/ob_wallet_image.png'),
    title: 'Pay Your Fare\nFrom Your Wallet',
    subtitle: 'Top up your Troski wallet, scan your QR code and ride — no cash, no stress.',
  },
  {
    id: 'traffic',
    image: require('@/assets/images/onboarding/ob_busstop_blueskies_image.png'),
    title: 'Beat Traffic\nArrive Calm',
    subtitle: 'Smart departure windows and alternative routes when things get heavy.',
  },
]

// ─── Google 4-color SVG ─────────────────────────────────────

const GoogleLogo = React.memo(() => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
))

// ─── Slide content (illustration + text only — no buttons) ──

const SlideContent = React.memo(({ item }: { item: Slide }) => {
  const insets = useSafeAreaInsets()
  // Illustration takes ~55% of available space above buttons
  const illustrationHeight = SCREEN_H * 0.38

  return (
    <View style={[s.slideContent, { width }]}>
      {/* Illustration */}
      <View style={[s.illustrationWrap, { height: illustrationHeight, marginTop: insets.top + 16 }]}>
        <Image source={item.image} style={s.illustration} resizeMode="contain" />
      </View>

      {/* Copy */}
      <View style={s.copyWrap}>
        <Text style={s.headline}>{item.title}</Text>
        <Text style={s.body}>{item.subtitle}</Text>
      </View>
    </View>
  )
})

// ─── Main Component ─────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete: (action?: string) => void
  deviceId: string | null
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const isLastSlide = currentIndex === SLIDES.length - 1
  const isFirstSlide = currentIndex === 0

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), [])

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    }
  }, [currentIndex])

  const skip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    flatListRef.current?.scrollToIndex({ index: SLIDES.length - 1, animated: true })
  }, [])

  const createAccount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onComplete('register')
  }, [onComplete])

  const login = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onComplete('login')
  }, [onComplete])

  const renderSlide = useCallback(({ item }: { item: Slide }) => (
    <SlideContent item={item} />
  ), [])

  // Show auth buttons on last 3 slides, "Get Started" on first
  const showAuth = currentIndex > 0

  return (
    <View style={s.root}>
      {/* Skip button — top right (hidden on last slide) */}
      {!isLastSlide && (
        <Animated.View entering={FadeIn.delay(500).duration(300)} style={[s.skipWrap, { top: insets.top + 14 }]}>
          <Pressable onPress={skip} hitSlop={12}>
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Swipeable slides — illustration + text only */}
      <View style={s.slidesArea}>
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
          scrollEventThrottle={16}
        />
      </View>

      {/* Fixed bottom — dots + buttons (never scrolls) */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[s.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === currentIndex && s.dotActive]} />
          ))}
        </View>

        {/* Action buttons */}
        {showAuth ? (
          <View style={s.authActions}>
            {/* Primary CTA */}
            <Pressable onPress={createAccount} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <LinearGradient colors={[BRAND, BRAND_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnPrimary}>
                <Text style={s.btnPrimaryLabel}>Create an Account</Text>
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Google */}
            <Pressable onPress={createAccount} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={s.btnSocial}>
                <GoogleLogo />
                <Text style={s.btnSocialLabel}>Continue with Google</Text>
              </View>
            </Pressable>

            {/* Apple */}
            <Pressable onPress={createAccount} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={[s.btnSocial, s.btnApple]}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={[s.btnSocialLabel, s.btnAppleLabel]}>Continue with Apple</Text>
              </View>
            </Pressable>

            {/* Login link */}
            <Text style={s.loginText}>
              Already have an account?{' '}
              <Text style={s.loginLink} onPress={login}>Login</Text>
            </Text>
          </View>
        ) : (
          <View style={s.welcomeActions}>
            <Pressable onPress={goNext} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <LinearGradient colors={[BRAND, BRAND_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnPrimary}>
                <Text style={s.btnPrimaryLabel}>Get Started</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  /* ── Skip ── */
  skipWrap: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
    letterSpacing: 0.1,
  },

  /* ── Slides area (content only, no buttons) ── */
  slidesArea: {
    flex: 1,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
  },

  /* ── Illustration ── */
  illustrationWrap: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: width * 0.65,
    height: '100%',
  },

  /* ── Copy ── */
  copyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0A0A0A',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  body: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 310,
    letterSpacing: 0.1,
  },

  /* ── Fixed bottom area ── */
  bottomArea: {
    paddingHorizontal: 24,
  },

  /* ── Dots ── */
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E2E2',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: BRAND,
  },

  /* ── Welcome actions (Get Started only) ── */
  welcomeActions: {
    gap: 12,
  },

  /* ── Auth actions (full stack) ── */
  authActions: {
    gap: 12,
  },

  /* ── Primary button ── */
  btnPrimary: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  btnPrimaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  /* ── Divider ── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#BFBFBF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Social buttons ── */
  btnSocial: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnSocialLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.1,
  },
  btnApple: {
    backgroundColor: '#0A0A0A',
  },
  btnAppleLabel: {
    color: '#FFFFFF',
  },

  /* ── Login link ── */
  loginText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
    marginTop: 4,
  },
  loginLink: {
    color: BRAND,
    fontWeight: '600',
  },
})
