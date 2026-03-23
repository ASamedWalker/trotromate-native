import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
  type ViewToken,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Bell,
  BellRing,
  ChevronRight,
  Check,
  X,
  Zap,
  Coins,
  Camera,
  Trophy,
  MapPin,
} from 'lucide-react-native'
import * as Notifications from 'expo-notifications'
import { c } from '@/lib/theme'

const { width } = Dimensions.get('window')

interface OnboardingSlide {
  id: string
  title: string
  subtitle: string
  description: string
  gradientColors: [string, string, string]
  accentColor: string
  isNotificationSlide?: boolean
}

// Animated bell that rocks back and forth
function AnimatedBellIcon({ granted, denied }: { granted: boolean; denied: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (granted || denied) return
    const ring = Animated.sequence([
      Animated.timing(rotation, { toValue: -8, duration: 75, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 8, duration: 75, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: -8, duration: 75, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 8, duration: 75, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 0, duration: 75, useNativeDriver: true }),
    ])
    const animation = Animated.loop(
      Animated.sequence([ring, Animated.delay(2500)])
    )
    animation.start()
    return () => animation.stop()
  }, [rotation, granted, denied])

  const spin = rotation.interpolate({
    inputRange: [-10, 10],
    outputRange: ['-10deg', '10deg'],
  })

  if (granted) return <Check size={48} color={c.white} strokeWidth={2} />
  if (denied) return <X size={48} color={c.white} strokeWidth={2} />

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <BellRing size={48} color={c.white} strokeWidth={1.5} />
    </Animated.View>
  )
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Troski',
    subtitle: 'Your trotro companion',
    description:
      'Fares, queues, train times, and community reports — all in one place. Let\u2019s go!',
    gradientColors: ['#f59e0b', '#f97316', '#ef4444'],
    accentColor: '#fbbf24',
  },
  {
    id: 'notifications',
    title: 'Stay in the Loop',
    subtitle: 'One last thing',
    description:
      'Get alerts when fares change or traffic builds up on your routes.',
    gradientColors: ['#3b82f6', '#6366f1', '#8b5cf6'],
    accentColor: '#60a5fa',
    isNotificationSlide: true,
  },
]

const FEATURES = [
  { label: 'Fares', icon: Coins, color: '#fbbf24' },
  { label: 'Tales', icon: Camera, color: '#f472b6' },
  { label: 'Rewards', icon: Trophy, color: '#a78bfa' },
  { label: 'Live updates', icon: Zap, color: '#38bdf8' },
]

const ALERT_EXAMPLES = [
  {
    title: 'Fare changes',
    subtitle: 'Know when prices change',
    icon: Zap,
    gradientColors: ['#f59e0b', '#f97316'] as [string, string],
  },
  {
    title: 'Traffic alerts',
    subtitle: 'Avoid delays on your route',
    icon: MapPin,
    gradientColors: ['#ef4444', '#f43f5e'] as [string, string],
  },
]

interface OnboardingFlowProps {
  onComplete: () => void
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [notifStatus, setNotifStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')
  const flatListRef = useRef<FlatList>(null)

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index)
      }
    }
  ).current

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const goNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    } else {
      onComplete()
    }
  }, [currentIndex, onComplete])

  const handleEnableNotifications = useCallback(async () => {
    setNotifStatus('loading')
    try {
      const { status } = await Notifications.requestPermissionsAsync()
      setNotifStatus(status === 'granted' ? 'granted' : 'denied')
    } catch {
      setNotifStatus('denied')
    }
  }, [])

  const currentSlide = SLIDES[currentIndex]
  const isNotifSlide = currentSlide.isNotificationSlide

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    return (
      <LinearGradient
        colors={['#0c0a09', '#0c0a09']}
        style={[styles.slide, { width }]}
      >
        {/* Background gradient overlay */}
        <LinearGradient
          colors={[
            `${item.gradientColors[0]}30`,
            `${item.gradientColors[1]}20`,
            `${item.gradientColors[2]}30`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Floating orbs */}
        <View style={[styles.orb, styles.orbTopRight, { backgroundColor: `${item.accentColor}40` }]} />
        <View style={[styles.orb, styles.orbBottomLeft, { backgroundColor: `${item.accentColor}20` }]} />

        {/* Icon with glow */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconGlow, { shadowColor: item.gradientColors[0] }]}>
            <LinearGradient
              colors={item.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBox}
            >
              {/* Inner shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'transparent', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {item.id === 'welcome' ? (
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <AnimatedBellIcon
                  granted={notifStatus === 'granted'}
                  denied={notifStatus === 'denied'}
                />
              )}
            </LinearGradient>
          </View>
        </View>

        {/* Subtitle (above title, small uppercase) */}
        <Text style={[styles.subtitleLabel, { color: item.accentColor }]}>
          {item.subtitle}
        </Text>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{item.description}</Text>

        {/* Welcome slide: colored feature pills */}
        {item.id === 'welcome' && (
          <View style={styles.featureRow}>
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <View key={f.label} style={styles.featureBadge}>
                  <Icon size={16} color={f.color} strokeWidth={2} />
                  <Text style={styles.featureText}>{f.label}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Notification slide: example alert cards */}
        {item.id === 'notifications' && (
          <View style={styles.alertCardsContainer}>
            {ALERT_EXAMPLES.map((alert) => {
              const Icon = alert.icon
              return (
                <View key={alert.title} style={styles.alertCard}>
                  <LinearGradient
                    colors={alert.gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.alertIconBox}
                  >
                    <Icon size={20} color={c.white} strokeWidth={2} />
                  </LinearGradient>
                  <View style={styles.alertTextContainer}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </LinearGradient>
    )
  }

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity onPress={onComplete} style={styles.skipBtn} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        {isNotifSlide ? (
          <View style={styles.notifButtonsContainer}>
            {notifStatus === 'idle' || notifStatus === 'loading' ? (
              <>
                <TouchableOpacity
                  onPress={handleEnableNotifications}
                  disabled={notifStatus === 'loading'}
                  activeOpacity={0.85}
                  style={styles.gradientBtnWrap}
                >
                  <LinearGradient
                    colors={currentSlide.gradientColors}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.gradientBtn}
                  >
                    {notifStatus === 'loading' ? (
                      <ActivityIndicator color={c.white} size="small" />
                    ) : (
                      <>
                        <Bell size={20} color={c.white} strokeWidth={2} />
                        <Text style={styles.gradientBtnText}>Enable Notifications</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goNext}
                  activeOpacity={0.7}
                  style={styles.maybeLaterBtn}
                >
                  <Text style={styles.maybeLaterText}>Maybe Later</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={goNext}
                activeOpacity={0.85}
                style={styles.gradientBtnWrap}
              >
                <LinearGradient
                  colors={
                    notifStatus === 'granted'
                      ? ['#10b981', '#22c55e']
                      : currentSlide.gradientColors
                  }
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gradientBtn}
                >
                  {notifStatus === 'granted' && (
                    <Check size={20} color={c.white} strokeWidth={2.5} />
                  )}
                  <Text style={styles.gradientBtnText}>Let&apos;s Go!</Text>
                  {notifStatus !== 'granted' && (
                    <ChevronRight size={20} color={c.white} strokeWidth={2} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={goNext}
            activeOpacity={0.85}
            style={styles.gradientBtnWrap}
          >
            <LinearGradient
              colors={currentSlide.gradientColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.gradientBtnText}>Continue</Text>
              <ChevronRight size={20} color={c.white} strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0a09',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.5,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTopRight: {
    width: 200,
    height: 200,
    top: -40,
    right: -60,
  },
  orbBottomLeft: {
    width: 300,
    height: 300,
    bottom: -80,
    left: -100,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  iconGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 72,
    height: 72,
  },
  subtitleLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Poppins_800ExtraBold',
    color: c.white,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 320,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.9)',
  },
  alertCardsContainer: {
    width: '100%',
    gap: 8,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  alertIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: c.white,
  },
  alertSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: c.white,
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  gradientBtnWrap: {
    width: '100%',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 8,
  },
  gradientBtnText: {
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
    color: c.white,
    letterSpacing: 0.3,
  },
  notifButtonsContainer: {
    width: '100%',
    gap: 8,
  },
  maybeLaterBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  maybeLaterText: {
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.4)',
  },
})
