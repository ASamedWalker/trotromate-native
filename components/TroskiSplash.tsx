import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { c } from '@/lib/theme'

interface TroskiSplashProps {
  onFinish: () => void
}

function BouncingDot({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    )
    bounce.start()
    return () => bounce.stop()
  }, [delay, translateY])

  return (
    <Animated.View
      style={[styles.dot, { transform: [{ translateY }] }]}
    />
  )
}

export default function TroskiSplash({ onFinish }: TroskiSplashProps) {
  const opacity = useRef(new Animated.Value(1)).current
  const logoScale = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    // Bounce the logo in
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start()

    // After 2 seconds, fade out
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onFinish())
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Logo image — rounded with white ring like PWA */}
      <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
        <Animated.Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoImage}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>TROSKI</Text>
      <Text style={styles.tagline}>Know Your Fare</Text>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        <BouncingDot delay={0} />
        <BouncingDot delay={150} />
        <BouncingDot delay={300} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.amber500,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoWrap: {
    width: 112,
    height: 112,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 38,
    fontFamily: 'Poppins_900Black',
    color: c.white,
    letterSpacing: 6,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
})
