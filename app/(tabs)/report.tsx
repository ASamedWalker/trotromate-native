import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
} from 'react-native'
import { useRouter } from 'expo-router'
import { TrendingUp, Users, AlertTriangle, Camera } from 'lucide-react-native'

const REPORT_TYPES = [
  {
    id: 'fare',
    title: 'Report Fare',
    description: 'Share the fare you paid on a route',
    icon: TrendingUp,
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    lightBg: 'bg-amber-50',
    points: 10,
    route: '/report/fare',
  },
  {
    id: 'queue',
    title: 'Queue Status',
    description: 'Report wait times at trotro stations',
    icon: Users,
    color: '#8b5cf6',
    bgColor: 'bg-violet-500',
    lightBg: 'bg-violet-50',
    points: 5,
    route: '/report/queue',
  },
  {
    id: 'incident',
    title: 'Incident Report',
    description: 'Report traffic, accidents, or police checks',
    icon: AlertTriangle,
    color: '#ef4444',
    bgColor: 'bg-red-500',
    lightBg: 'bg-red-50',
    points: 15,
    route: '/report/incident',
  },
  {
    id: 'photo',
    title: 'Trotro Tales',
    description: 'Share photos from your journey',
    icon: Camera,
    color: '#ec4899',
    bgColor: 'bg-pink-500',
    lightBg: 'bg-pink-50',
    points: 15,
    route: '/report/photo',
  },
]

export default function ReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`}>
      <View className="px-5 pt-12 pb-4">
        <Text className={`text-2xl font-bold mb-2 ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
          Contribute
        </Text>
        <Text className={`text-base ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
          Help fellow commuters and earn points
        </Text>
      </View>

      <View className="px-5 py-4 space-y-4">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon
          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.7}
              onPress={() => router.push(type.route as any)}
              className={`p-5 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}
              style={{ marginBottom: 16 }}
            >
              <View className="flex-row items-start">
                <View
                  className={`w-14 h-14 rounded-2xl items-center justify-center ${type.bgColor}`}
                  style={{ shadowColor: type.color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
                >
                  <Icon size={28} color="#ffffff" />
                </View>

                <View className="flex-1 ml-4">
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-lg font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                      {type.title}
                    </Text>
                    <View className={`px-2.5 py-1 rounded-full ${isDark ? 'bg-stone-800' : type.lightBg}`}>
                      <Text style={{ color: type.color }} className="text-xs font-semibold">
                        +{type.points} pts
                      </Text>
                    </View>
                  </View>
                  <Text className={`text-sm mt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    {type.description}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Stats Banner */}
      <View className="mx-5 mt-4">
        <View className={`p-5 rounded-2xl ${isDark ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
          <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            Your Contribution Stats
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                0
              </Text>
              <Text className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                Reports
              </Text>
            </View>
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                0
              </Text>
              <Text className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                Points
              </Text>
            </View>
            <View className="items-center">
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                0
              </Text>
              <Text className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                Day Streak
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
