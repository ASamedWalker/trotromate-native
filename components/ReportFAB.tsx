import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Plus, X, TrendingUp, Users, AlertTriangle, Camera, TrainFront, Bike } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'

const REPORT_OPTIONS = [
  {
    id: 'fare',
    title: 'Report Fare',
    subtitle: '+10 pts',
    icon: TrendingUp,
    color: c.amber500,
    route: '/report/fare',
  },
  {
    id: 'okada',
    title: 'Okada Fare',
    subtitle: '+10 pts',
    icon: Bike,
    color: c.orange500,
    route: '/report/fare?transport_type=okada',
  },
  {
    id: 'queue',
    title: 'Queue Status',
    subtitle: '+5 pts',
    icon: Users,
    color: c.violet500,
    route: '/report/queue',
  },
  {
    id: 'incident',
    title: 'Incident',
    subtitle: '+15 pts',
    icon: AlertTriangle,
    color: c.red500,
    route: '/report/incident',
  },
  {
    id: 'photo',
    title: 'Trotro Tale',
    subtitle: 'Share photo',
    icon: Camera,
    color: c.pink500,
    route: '/report/photo',
  },
  {
    id: 'train',
    title: 'Train Report',
    subtitle: '+10 pts',
    icon: TrainFront,
    color: '#0ea5e9',
    route: '/report/train',
  },
]

export default function ReportFAB() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const [isOpen, setIsOpen] = useState(false)
  const rotation = useRef(new Animated.Value(0)).current
  const optionsOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(optionsOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isOpen])

  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  })

  const handleSelect = (route: string) => {
    setIsOpen(false)
    router.push(route as Href)
  }

  return (
    <>
      {/* Overlay Modal */}
      <Modal visible={isOpen} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setIsOpen(false)}>
          <View style={s.menuContainer}>
            {REPORT_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleSelect(option.route)}
                  activeOpacity={0.8}
                  style={s.menuItem}
                >
                  <View style={s.menuRow}>
                    <View style={[s.menuIcon, { backgroundColor: option.color }]}>
                      <Icon size={20} color={c.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.menuTitle}>{option.title}</Text>
                    </View>
                    <Text style={[s.menuPts, { color: option.color }]}>{option.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </Pressable>
      </Modal>

      {/* FAB Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.85}
        style={s.fab}
      >
        <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
          {isOpen ? (
            <X size={26} color={c.white} />
          ) : (
            <Plus size={26} color={c.white} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      bottom: 16,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: c.amber500,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      zIndex: 100,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
      paddingBottom: 150,
      paddingHorizontal: 20,
    },
    menuContainer: {
      backgroundColor: t.card,
      borderRadius: 24,
      padding: 8,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    menuTitle: { fontFamily: font.semibold, fontSize: 16, color: t.text },
    menuPts: { fontSize: 13, fontFamily: font.semibold },
  })
}
