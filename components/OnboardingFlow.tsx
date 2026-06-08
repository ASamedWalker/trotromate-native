import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  Dimensions,
  FlatList,
  StyleSheet,
  Image,
  Linking,
  type ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const { width, height: SCREEN_H } = Dimensions.get('window')
const BRAND = '#FF4D1C'
const BRAND_DEEP = '#E94817'
const TERMS_URL = 'https://troski.app/terms'
const PRIVACY_URL = 'https://troski.app/privacy'

// ─── Slides (3 benefit slides — Material "Top User Benefits", one per card.
//     Brand intro lives on the splash; carousel leads straight with value.) ──

interface Slide {
  id: string
  image: any
  title: string
  subtitle: string
}

const SLIDES: Slide[] = [
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

// ─── Slide content (illustration + text only — no buttons) ──

const SlideContent = React.memo(function SlideContent({ item }: { item: Slide }) {
  const insets = useSafeAreaInsets()
  // Illustration sized so a two-line title + full body still clears the
  // fixed bottom button block (slides overflow visibly otherwise — the body
  // text was rendering under the pagination dots / auth buttons).
  const illustrationHeight = SCREEN_H * 0.30

  return (
    <View style={[s.slideContent, { width }]}>
      {/* Illustration */}
      <View style={[s.illustrationWrap, { height: illustrationHeight, marginTop: insets.top + 8 }]}>
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
  const [agreed, setAgreed] = useState(false)

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

  // International pattern: let users see every value prop, then sign up.
  // Auth appears ONLY on the final slide; all earlier slides advance with a
  // single primary button. "Skip" (top-right) jumps straight here for users
  // who just want to sign up immediately.
  const showAuth = isLastSlide

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

      {/* Floating bottom — dots + buttons. Overlays the full-screen pager;
          box-none lets swipes pass through everywhere except the buttons. */}
      <Animated.View
        pointerEvents="box-none"
        entering={FadeInUp.delay(300).duration(400)}
        style={[s.bottomArea, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Dots */}
        <View pointerEvents="none" style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === currentIndex && s.dotActive]} />
          ))}
        </View>

        {/* Action buttons */}
        {showAuth ? (
          <View style={s.authActions}>
            {/* Primary CTA — phone-first sign-up, gated on consent.
                Greyed out until the consent box is checked. */}
            <Pressable onPress={createAccount} disabled={!agreed} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <LinearGradient colors={agreed ? [BRAND, BRAND_DEEP] : ['#D9D9D9', '#CFCFCF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnPrimary}>
                <Text style={[s.btnPrimaryLabel, !agreed && { color: '#8A8A8A' }]}>Create an Account</Text>
              </LinearGradient>
            </Pressable>

            {/* Login link */}
            <Text style={s.loginText}>
              Already have an account?{' '}
              <Text style={s.loginLink} onPress={login}>Login</Text>
            </Text>

            {/* Consent — active clickwrap checkbox (enforceable; gates the CTA) */}
            <Pressable onPress={() => setAgreed(v => !v)} style={s.consentRow} hitSlop={6}>
              <View style={[s.checkbox, agreed && s.checkboxOn]}>
                {agreed && <Text style={s.checkboxTick}>✓</Text>}
              </View>
              <Text style={s.consentText}>
                I agree to the{' '}
                <Text style={s.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
                {' '}and{' '}
                <Text style={s.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.welcomeActions}>
            <Pressable onPress={goNext} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }]}>
              <LinearGradient colors={[BRAND, BRAND_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnPrimary}>
                <Text style={s.btnPrimaryLabel}>{isFirstSlide ? 'Get Started' : 'Continue'}</Text>
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

  /* ── Slides area — fills the whole screen so swipes work anywhere ── */
  slidesArea: {
    ...StyleSheet.absoluteFillObject,
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
    paddingTop: 16,
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

  /* ── Floating bottom area (overlays the pager) ── */
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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

  /* ── Consent (clickwrap) ── */
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#9A9A9A',
  },
  consentLink: {
    color: '#5A5A5A',
    fontWeight: '600',
  },
})
