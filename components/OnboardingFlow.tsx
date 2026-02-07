import { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StyleSheet,
  type ViewToken,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { MapPin, Coins, Camera, Trophy, Zap, ChevronRight } from 'lucide-react-native'
import { c } from '@/lib/theme'

const { width } = Dimensions.get('window')

interface OnboardingSlide {
  id: string
  title: string
  subtitle: string
  description: string
  icon: typeof MapPin
  gradientColors: [string, string, string]
  accentColor: string
  features: string[]
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to\nTroski',
    subtitle: 'Your trotro companion',
    description:
      'Never get cheated on fares again. Know the right price before you board.',
    icon: MapPin,
    gradientColors: ['#f59e0b', '#f97316', '#ef4444'],
    accentColor: '#fbbf24',
    features: ['Real-time fares', 'Community-verified'],
  },
  {
    id: 'fares',
    title: 'Know Your\nFare',
    subtitle: 'Real-time prices',
    description:
      'Check accurate fares for any route. Community-verified prices updated daily.',
    icon: Coins,
    gradientColors: ['#10b981', '#14b8a6', '#06b6d4'],
    accentColor: '#34d399',
    features: ['Real-time', 'Updated daily'],
  },
  {
    id: 'tales',
    title: 'Trotro\nTales',
    subtitle: 'Share your journey',
    description:
      "Post photos, check queues, and see what's happening across Accra right now.",
    icon: Camera,
    gradientColors: ['#ec4899', '#f43f5e', '#ef4444'],
    accentColor: '#f472b6',
    features: ['Share photos', 'Community feed'],
  },
  {
    id: 'rewards',
    title: 'Earn\nRewards',
    subtitle: 'Level up as you contribute',
    description:
      'Report fares, share tales, and earn points. Unlock badges and climb the leaderboard.',
    icon: Trophy,
    gradientColors: ['#8b5cf6', '#a855f7', '#d946ef'],
    accentColor: '#a78bfa',
    features: ['Earn points', 'Unlock badges'],
  },
  {
    id: 'activity',
    title: 'Stay\nUpdated',
    subtitle: 'Never miss out',
    description:
      'Get alerts for fare changes, traffic updates, and community reports on your routes.',
    icon: Zap,
    gradientColors: ['#3b82f6', '#6366f1', '#8b5cf6'],
    accentColor: '#60a5fa',
    features: ['Live updates', 'Route alerts'],
  },
]

interface OnboardingFlowProps {
  onComplete: () => void
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index)
      }
    }
  ).current

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    } else {
      onComplete()
    }
  }

  const isLast = currentIndex === SLIDES.length - 1
  const currentSlide = SLIDES[currentIndex]

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    const Icon = item.icon
    return (
      <LinearGradient
        colors={item.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.slide, { width }]}
      >
        {/* Floating orbs for depth */}
        <View style={[styles.orb, styles.orbTopRight, { backgroundColor: `${item.accentColor}30` }]} />
        <View style={[styles.orb, styles.orbBottomLeft, { backgroundColor: `${item.accentColor}20` }]} />

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Icon size={52} color={c.white} strokeWidth={1.5} />
        </View>

        {/* Title — large, multi-line, Poppins ExtraBold */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Subtitle — accent-colored */}
        <Text style={[styles.subtitle, { color: item.accentColor }]}>{item.subtitle}</Text>

        {/* Description */}
        <Text style={styles.description}>{item.description}</Text>

        {/* Feature badges */}
        <View style={styles.featureRow}>
          {item.features.map((f) => (
            <View key={f} style={styles.featureBadge}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
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

      {/* Bottom controls - overlaid on the gradient */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                i === currentIndex
                  ? styles.dotActive
                  : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next/Get Started button */}
        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={styles.nextBtn}
        >
          <Text style={[styles.nextText, { color: currentSlide.gradientColors[0] }]}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
          {!isLast && <ChevronRight size={20} color={currentSlide.gradientColors[0]} />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.5,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Poppins_800ExtraBold',
    color: c.white,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 16,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 28,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  featureBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: c.white,
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: c.white,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  nextText: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.5,
  },
})
