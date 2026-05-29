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

const { width, height: screenHeight } = Dimensions.get('window')
const BRAND = '#FF4D1C'

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

  const goToAuth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    flatListRef.current?.scrollToIndex({ index: 2, animated: true })
  }, [])

  const createAccount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onComplete()
    setTimeout(() => router.push('/register/phone' as any), 100)
  }, [onComplete, router])

  const login = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onComplete()
    setTimeout(() => router.push('/auth/phone' as any), 100)
  }, [onComplete, router])

  const renderSlide = useCallback(({ item, index }: { item: Slide; index: number }) => {
    const isWelcome = index <= 1

    const slideHeight = screenHeight

    return (
      <View style={{ width, height: slideHeight, backgroundColor: '#fff' }}>
        {/* Illustration — centered in top half */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
          <Image source={item.image} style={{ width: 240, height: 240 }} resizeMode="contain" />
        </View>

        {/* Copy */}
        <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>
          <Text style={styles.headline}>{item.title}</Text>
          <Text style={styles.body}>{item.subtitle}</Text>
        </View>

        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Buttons */}
        <View style={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: insets.bottom + 16, gap: 12 }}>
          {isWelcome ? (
            <Pressable onPress={goToAuth} style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}>
              <Text style={styles.btnPrimaryLabel}>Get Started</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={createAccount} style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}>
                <Text style={styles.btnPrimaryLabel}>Create an Account</Text>
              </Pressable>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Pressable onPress={createAccount} style={({ pressed }) => [styles.btnSocial, pressed && styles.btnPressed]}>
                <Text style={styles.gIcon}>G</Text>
                <Text style={styles.btnSocialLabel}>Continue with Google</Text>
              </Pressable>

              <Pressable onPress={createAccount} style={({ pressed }) => [styles.btnSocial, styles.btnDark, pressed && styles.btnPressed]}>
                <Text style={styles.aIcon}>{'\uF8FF'}</Text>
                <Text style={[styles.btnSocialLabel, styles.btnDarkLabel]}>Continue with Apple</Text>
              </Pressable>

              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text style={styles.footerLink} onPress={login}>Login</Text>
              </Text>
            </>
          )}
        </View>
      </View>
    )
  }, [currentIndex, insets, goToAuth, createAccount, login])

  return (
    <View style={styles.root}>
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
    </View>
  )
}

// ─── Styles (from scratch) ────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    flex: 1,
  },

  /* ── Illustration ── */
  illustrationArea: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 240,
    height: 240,
  },

  /* ── Copy ── */
  copyArea: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0A0A0A',
    textAlign: 'center',
    lineHeight: 31,
    letterSpacing: -0.8,
  },
  body: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '400',
    color: '#555555',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  /* ── Dots ── */
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E8E8E8',
  },
  dotActive: {
    width: 22,
    backgroundColor: BRAND,
  },

  /* ── Action Buttons ── */
  actionsArea: {
    paddingHorizontal: 26,
    paddingTop: 22,
    gap: 12,
  },

  // Primary
  btnPrimary: {
    height: 56,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,90,31,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 4,
  },
  btnPrimaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Pressed state
  btnPressed: {
    transform: [{ scale: 0.985 }],
  },

  // Or divider
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  orText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#B8B8B8',
  },

  // Social buttons
  btnSocial: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F2F2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnSocialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  btnDark: {
    backgroundColor: '#0A0A0A',
  },
  btnDarkLabel: {
    color: '#FFFFFF',
  },

  // Icons
  gIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  aIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },

  // Footer
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#555555',
    paddingTop: 4,
  },
  footerLink: {
    color: BRAND,
    fontWeight: '600',
  },
})
