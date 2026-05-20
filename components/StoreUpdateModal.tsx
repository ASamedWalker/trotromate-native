import { useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { Download } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useStoreUpdate } from '@/lib/hooks/useStoreUpdate'

const appIcon = require('@/assets/images/logo.png')

export default function StoreUpdateModal() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { isUpdateAvailable, storeVersion, currentVersion, dismiss, openStore } = useStoreUpdate()
  const scale = useRef(new Animated.Value(0.85)).current

  useEffect(() => {
    if (isUpdateAvailable) {
      scale.setValue(0.85)
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }).start()
    }
  }, [isUpdateAvailable, scale])

  if (!isUpdateAvailable) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Image source={appIcon} style={s.icon} contentFit="contain" />

          <Text style={s.title}>New Version Available</Text>

          <Text style={s.versionText}>
            Troski v{storeVersion} is ready
          </Text>

          <Text style={s.description}>
            Get the latest features, improvements, and bug fixes for a better experience.
          </Text>

          <TouchableOpacity
            onPress={openStore}
            activeOpacity={0.8}
            style={s.updateButton}
          >
            <Download size={18} color={c.white} />
            <Text style={s.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={dismiss}
            activeOpacity={0.6}
            style={s.laterButton}
          >
            <Text style={s.laterText}>Remind Me Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  )
}

function getStyles(isDark: boolean) {
  const t = themed(isDark)
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      width: '100%',
      backgroundColor: t.card,
      borderRadius: 28,
      padding: 32,
      alignItems: 'center',
      shadowColor: c.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    icon: {
      width: 72,
      height: 72,
      borderRadius: 18,
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontFamily: font.bold,
      color: t.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    versionText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: c.amber500,
      textAlign: 'center',
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      fontFamily: font.regular,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    updateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      backgroundColor: c.amber500,
      paddingVertical: 16,
      borderRadius: 16,
    },
    updateButtonText: {
      color: c.white,
      fontSize: 16,
      fontFamily: font.semibold,
    },
    laterButton: {
      marginTop: 16,
      paddingVertical: 8,
    },
    laterText: {
      color: t.textSecondary,
      fontSize: 14,
      fontFamily: font.medium,
    },
  })
}
