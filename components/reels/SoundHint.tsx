import { useEffect, useRef } from 'react'
import { Text, Animated, StyleSheet } from 'react-native'
import { font } from '@/lib/theme'

/** "Tap 🔈 for sound" pill shown ~3s next to the sound button, then fades. */
export default function SoundHint({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ])
    anim.start(({ finished }) => { if (finished) onDone() })
    return () => anim.stop()
  }, [opacity, onDone])

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.flatten([styles.pill, { opacity }])}>
      <Text style={styles.text}>Tap 🔈 for sound</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 50,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontFamily: font.semibold,
  },
})
