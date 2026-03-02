import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native'
import { useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useAppUpdate } from '@/lib/hooks/useAppUpdate'

export default function AppUpdateBanner() {
  const { isUpdateAvailable, isDownloading, isRestarting, error, downloadAndRestart } = useAppUpdate()
  const slideAnim = useRef(new Animated.Value(-100)).current

  useEffect(() => {
    if (isUpdateAvailable) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }).start()
    }
  }, [isUpdateAvailable, slideAnim])

  if (!isUpdateAvailable) return null

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isRestarting ? 'Restarting...' : isDownloading ? 'Downloading update...' : 'New version available'}
          </Text>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {isDownloading || isRestarting
                ? 'Please wait a moment'
                : 'Tap update for the latest features'}
            </Text>
          )}
        </View>
        {isDownloading || isRestarting ? (
          <ActivityIndicator color={c.white} size="small" />
        ) : (
          <TouchableOpacity
            onPress={downloadAndRestart}
            style={styles.button}
            activeOpacity={0.8}
          >
            <Download size={14} color={c.amber900} />
            <Text style={styles.buttonText}>Update</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: c.amber600,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: c.white,
    fontSize: 15,
    fontFamily: font.semibold,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 2,
  },
  error: {
    color: '#fecaca',
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonText: {
    color: c.amber900,
    fontSize: 13,
    fontFamily: font.semibold,
  },
})
