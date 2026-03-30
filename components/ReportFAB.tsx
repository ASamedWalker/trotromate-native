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
  useWindowDimensions,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import {
  Megaphone,
  X,
  Users,
  AlertTriangle,
  Star,
  CircleAlert,
  ShieldCheck,
  Ban,
  Banknote,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font, themed } from '@/lib/theme'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { useProfile } from '@/lib/hooks/useRewards'
import { calculateProgress, getNextLevel } from '@/lib/constants/rewards'

const REPORT_OPTIONS = [
  {
    id: 'incident',
    title: 'Heavy Traffic',
    points: '+5',
    icon: CircleAlert,
    iconColor: '#b02500',
    badgeBg: 'rgba(176,37,0,0.1)',
    route: '/report/incident',
  },
  {
    id: 'queue',
    title: 'Police Check',
    points: '+10',
    icon: ShieldCheck,
    iconColor: '#2563eb',
    badgeBg: 'rgba(37,99,235,0.1)',
    route: '/report/queue',
  },
  {
    id: 'accident',
    title: 'Accident',
    points: '+15',
    icon: AlertTriangle,
    iconColor: '#d97706',
    badgeBg: 'rgba(217,119,6,0.1)',
    route: '/report/incident',
  },
  {
    id: 'closure',
    title: 'Road Closure',
    points: '+20',
    icon: Ban,
    iconColor: '#57534e',
    badgeBg: 'rgba(87,83,78,0.1)',
    route: '/report/incident',
  },
  {
    id: 'full',
    title: 'Trotro Full',
    points: '+8',
    icon: Users,
    iconColor: '#7c3aed',
    badgeBg: 'rgba(124,58,237,0.1)',
    route: '/report/queue',
  },
  {
    id: 'fare',
    title: 'Price Change',
    points: '+10',
    icon: Banknote,
    iconColor: '#d97706',
    badgeBg: 'rgba(217,119,6,0.1)',
    route: '/report/fare',
  },
]

export default function ReportFAB() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const { width } = useWindowDimensions()
  const cardSize = (width - 32 - 24 - 24) / 3 // padding + gaps

  const { deviceId } = useDeviceId()
  const { profile } = useProfile(deviceId)

  const [isOpen, setIsOpen] = useState(false)
  const sheetSlide = useRef(new Animated.Value(0)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(sheetSlide, {
        toValue: isOpen ? 1 : 0,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isOpen, overlayOpacity, sheetSlide])

  const sheetTranslate = sheetSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  })

  const handleSelect = (route: string) => {
    setIsOpen(false)
    router.push(route as Href)
  }

  // Level progress
  const currentLevel = profile?.current_level ?? 'passenger'
  const totalPoints = profile?.total_points ?? 0
  const nextLevel = getNextLevel(currentLevel)
  const progress = calculateProgress(totalPoints, currentLevel)

  return (
    <>
      {/* Bottom Sheet Modal */}
      <Modal visible={isOpen} transparent animationType="none">
        <Animated.View style={[s.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)} />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            { transform: [{ translateY: sheetTranslate }] },
          ]}
        >
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>What's the update?</Text>
            <Text style={s.headerSubtitle}>
              Share live info and earn commute points
            </Text>
          </View>

          {/* 3x2 Grid */}
          <View style={s.grid}>
            {REPORT_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleSelect(option.route)}
                  activeOpacity={0.7}
                  style={[s.gridItem, { width: cardSize, height: cardSize }]}
                >
                  {/* Points badge */}
                  <View style={[s.pointsBadge, { backgroundColor: option.badgeBg }]}>
                    <Text style={[s.pointsText, { color: option.iconColor }]}>
                      {option.points}
                    </Text>
                  </View>

                  {/* Icon */}
                  <View style={s.gridIconWrap}>
                    <Icon size={28} color={option.iconColor} />
                  </View>

                  {/* Label */}
                  <Text style={s.gridLabel} numberOfLines={2}>
                    {option.title}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Rewards Progress */}
          {profile && nextLevel && progress && (
            <View style={s.rewardsRow}>
              <View style={s.rewardsIconWrap}>
                <Star size={16} color="#815100" fill="#815100" />
              </View>
              <View style={s.rewardsContent}>
                <View style={s.rewardsTextRow}>
                  <Text style={s.rewardsLabel}>Daily Contributor</Text>
                  <Text style={s.rewardsXp}>
                    {progress.pointsNeeded} XP until {nextLevel.name}
                  </Text>
                </View>
                <View style={s.progressTrack}>
                  <LinearGradient
                    colors={['#815100', '#f8a010']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.progressFill, { width: `${progress.progressPercent}%` as any }]}
                  />
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* FAB Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.85}
        style={s.fab}
      >
        {isOpen ? (
          <X size={26} color="#fff" />
        ) : (
          <Megaphone size={26} color="#fff" />
        )}
      </TouchableOpacity>
    </>
  )
}

const getStyles = (isDark: boolean) => {
  // Stitch M3 tokens
  const surfaceLowest = themed(isDark).sheetBg
  const onSurface = isDark ? '#fafaf9' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'

  return StyleSheet.create({
    fab: {
      position: 'absolute',
      bottom: 90,
      right: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#f95630',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 10,
      shadowColor: 'rgba(249,86,48,0.4)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 16,
      zIndex: 100,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(252,245,242,0.97)',
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      paddingBottom: 44,
      elevation: 20,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0 : 0.12,
      shadowRadius: 40,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: outlineVariant,
    },
    header: {
      paddingHorizontal: 28,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: font.bold,
      color: onSurface,
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 28,
      gap: 12,
    },
    gridItem: {
      borderRadius: 24,
      backgroundColor: surfaceLowest,
      padding: 14,
      justifyContent: 'space-between',
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 3,
    },
    pointsBadge: {
      alignSelf: 'flex-end',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    pointsText: {
      fontSize: 11,
      fontFamily: font.bold,
    },
    gridIconWrap: {
      marginTop: 4,
    },
    gridLabel: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: onSurface,
      lineHeight: 15,
    },
    rewardsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 28,
      marginTop: 24,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(129,81,0,0.08)' : 'rgba(129,81,0,0.05)',
      gap: 12,
    },
    rewardsIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(129,81,0,0.15)' : 'rgba(129,81,0,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardsContent: {
      flex: 1,
    },
    rewardsTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    rewardsLabel: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: onSurface,
    },
    rewardsXp: {
      fontSize: 11,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(129,81,0,0.12)' : 'rgba(129,81,0,0.08)',
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
    },
  })
}
