import { useLocalSearchParams } from 'expo-router'
import {
  View,
  Text,
  ScrollView,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, Clock, TrendingUp, Users } from 'lucide-react-native'

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Mock data - will come from Supabase
  const route = {
    from: 'Circle',
    to: 'Madina',
    fare: 5.0,
    lastUpdated: '2h ago',
    reportCount: 45,
    avgWait: '15 min',
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`} edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Route Header */}
        <View className={`mx-5 mt-4 p-5 rounded-3xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
          <View className="flex-row items-center mb-4">
            <View className="w-12 h-12 rounded-xl bg-amber-500 items-center justify-center mr-3">
              <MapPin size={24} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className={`text-xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {route.from} → {route.to}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                Route #{id}
              </Text>
            </View>
          </View>

          {/* Current Fare */}
          <View className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-stone-800' : 'bg-amber-50'}`}>
            <Text className={`text-sm mb-1 ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
              Current Fare
            </Text>
            <Text className="text-3xl font-bold text-amber-500">
              ₵{route.fare.toFixed(2)}
            </Text>
            <View className="flex-row items-center mt-2">
              <Clock size={14} color={isDark ? '#a8a29e' : '#78716c'} />
              <Text className={`text-xs ml-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                Updated {route.lastUpdated}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className={`flex-1 p-4 rounded-2xl ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <View className="flex-row items-center mb-2">
                <TrendingUp size={16} color="#f59e0b" />
                <Text className={`ml-2 text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Reports</Text>
              </View>
              <Text className={`text-xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {route.reportCount}
              </Text>
            </View>
            <View className={`flex-1 p-4 rounded-2xl ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <View className="flex-row items-center mb-2">
                <Users size={16} color="#8b5cf6" />
                <Text className={`ml-2 text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Avg Wait</Text>
              </View>
              <Text className={`text-xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {route.avgWait}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Reports */}
        <View className="px-5 mt-6 mb-8">
          <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            Recent Reports
          </Text>
          <View className={`p-5 rounded-2xl items-center ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            <TrendingUp size={32} color={isDark ? '#57534e' : '#a8a29e'} />
            <Text className={`mt-3 font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              No recent reports yet
            </Text>
            <Text className={`text-sm mt-1 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
              Be the first to report!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
