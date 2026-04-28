import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { TrendingUp, Users, AlertTriangle, Camera, TrainFront } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const REPORT_TYPES = [
  {
    id: 'fare',
    title: 'Report Fare',
    description: 'Share the fare you paid on a route',
    icon: TrendingUp,
    color: c.amber500,
    bgColor: c.amber500,
    lightBg: c.amber50,
    points: 10,
    route: '/report/fare',
  },
  {
    id: 'queue',
    title: 'Queue Status',
    description: 'Report wait times at trotro stations',
    icon: Users,
    color: c.violet500,
    bgColor: c.violet500,
    lightBg: c.violet50,
    points: 5,
    route: '/report/queue',
  },
  {
    id: 'incident',
    title: 'Incident Report',
    description: 'Report traffic, accidents, or police checks',
    icon: AlertTriangle,
    color: c.red500,
    bgColor: c.red500,
    lightBg: '#fef2f2',
    points: 15,
    route: '/report/incident',
  },
  {
    id: 'photo',
    title: 'Trotro Tales',
    description: 'Share photos from your journey',
    icon: Camera,
    color: c.pink500,
    bgColor: c.pink500,
    lightBg: '#fdf2f8',
    points: 15,
    route: '/report/photo',
  },
  {
    id: 'train',
    title: 'Report Train',
    description: 'Report schedules, crowding, or fares',
    icon: TrainFront,
    color: '#0ea5e9',
    bgColor: '#0ea5e9',
    lightBg: '#f0f9ff',
    points: 10,
    route: '/report/train',
  },
]

export default function ReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = styles(isDark)
  const { profile } = useApp()

  return (
    <SafeAreaView style={s.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={[s.headerTitle, { textAlign: 'center' }]}>Contribute</Text>
          <Text style={[s.headerSub, { textAlign: 'center' }]}>Help fellow commuters and earn points</Text>
        </Animated.View>

        <View style={s.cardsContainer}>
          {REPORT_TYPES.map((type, index) => {
            const Icon = type.icon
            return (
              <Animated.View key={type.id} entering={FadeInDown.delay(100 + index * 80).duration(400)}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(type.route as Href) }}
                style={s.card}
              >
                <View style={s.cardRow}>
                  <View
                    style={[
                      s.iconBox,
                      {
                        backgroundColor: type.bgColor,
                        shadowColor: type.color,
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                      },
                    ]}
                  >
                    <Icon size={28} color={c.white} />
                  </View>

                  <View style={s.cardContent}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle}>{type.title}</Text>
                      <View style={[s.pointsBadge, { backgroundColor: isDark ? c.stone800 : type.lightBg }]}>
                        <Text style={[s.pointsText, { color: type.color }]}>+{type.points} pts</Text>
                      </View>
                    </View>
                    <Text style={s.cardDescription}>{type.description}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              </Animated.View>
            )
          })}
        </View>

        {/* Stats Banner */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={s.statsContainer}>
          <View style={s.statsBanner}>
            <Text style={s.statsTitle}>Your Contribution Stats</Text>
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile?.total_reports ?? 0}</Text>
                <Text style={s.statLabel}>Reports</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile?.total_points ?? 0}</Text>
                <Text style={s.statLabel}>Points</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile?.current_streak ?? 0}</Text>
                <Text style={s.statLabel}>Day Streak</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, marginBottom: 8, color: t.text },
    headerSub: { fontSize: 16, color: t.textSecondary },
    cardsContainer: { paddingHorizontal: 20, paddingTop: 16 },
    card: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: t.card,
      marginBottom: 16,
    },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
    iconBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: { flex: 1, marginLeft: 16 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 18, fontFamily: font.semibold, color: t.text },
    pointsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    pointsText: { fontSize: 12, fontFamily: font.semibold },
    cardDescription: { fontSize: 14, marginTop: 4, color: t.textSecondary },
    statsContainer: { marginHorizontal: 20, marginTop: 8, marginBottom: 20 },
    statsBanner: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(120, 53, 15, 0.3)' : c.amber50,
    },
    statsTitle: {
      fontSize: 18,
      fontFamily: font.semibold,
      marginBottom: 12,
      color: isDark ? c.amber400 : c.amber700,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 24, fontFamily: font.bold, color: t.text },
    statLabel: { fontSize: 12, color: t.textSecondary },
  })
}
