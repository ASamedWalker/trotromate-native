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
    title: 'Fare',
    subtitle: '+10 pts',
    icon: TrendingUp,
    color: c.amber500,
    route: '/report/fare',
  },
  {
    id: 'okada',
    title: 'Okada',
    subtitle: '+10 pts',
    icon: Bike,
    color: c.orange500,
    route: '/report/fare?transport_type=okada',
  },
  {
    id: 'queue',
    title: 'Queue',
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
    title: 'Tale',
    subtitle: '+8 pts',
    icon: Camera,
    color: c.pink500,
    route: '/report/photo',
  },
  {
    id: 'train',
    title: 'Train',
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
  const sheetSlide = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(sheetSlide, {
        toValue: isOpen ? 1 : 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isOpen])

  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  })

  const sheetTranslate = sheetSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  const handleSelect = (route: string) => {
    setIsOpen(false)
    router.push(route as Href)
  }

  return (
    <>
      {/* Bottom Sheet Modal */}
      <Modal visible={isOpen} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setIsOpen(false)}>
          <Animated.View
            style={[
              s.sheet,
              { transform: [{ translateY: sheetTranslate }] },
            ]}
          >
            <Pressable>
              {/* Handle bar */}
              <View style={s.handleRow}>
                <View style={s.handle} />
              </View>
              <Text style={s.sheetTitle}>Report</Text>

              {/* 3x2 Grid */}
              <View style={s.grid}>
                {REPORT_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleSelect(option.route)}
                      activeOpacity={0.7}
                      style={s.gridItem}
                    >
                      <View style={[s.gridIcon, { backgroundColor: `${option.color}18` }]}>
                        <Icon size={22} color={option.color} />
                      </View>
                      <Text style={s.gridLabel}>{option.title}</Text>
                      <Text style={[s.gridPts, { color: option.color }]}>{option.subtitle}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Pressable>
          </Animated.View>
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
      bottom: 90,
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
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: 40,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? c.stone600 : c.stone300,
    },
    sheetTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
    },
    gridItem: {
      width: '33.33%',
      alignItems: 'center',
      paddingVertical: 14,
    },
    gridIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    gridLabel: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.text,
    },
    gridPts: {
      fontSize: 11,
      fontFamily: font.medium,
      marginTop: 2,
    },
  })
}
