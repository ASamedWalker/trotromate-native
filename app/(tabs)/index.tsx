import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  useColorScheme,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Search, Navigation, CircleDot, ChevronRight, TrendingUp } from 'lucide-react-native'

const POPULAR_ROUTES = [
  { id: '1', from: 'Circle', to: 'Madina', fare: 5.0 },
  { id: '2', from: 'Tema Station', to: 'Accra Mall', fare: 4.0 },
  { id: '3', from: 'Kaneshie', to: 'Lapaz', fare: 3.5 },
  { id: '4', from: 'Osu', to: 'Airport', fare: 6.0 },
]

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const handleSearch = () => {
    if (from.trim() || to.trim()) {
      router.push({
        pathname: '/routes',
        params: { from: from.trim(), to: to.trim() },
      })
    } else {
      router.push('/routes')
    }
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View className="bg-amber-500 pb-6 pt-12 px-5" style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <Text className="text-2xl font-bold text-white mb-4">Where to?</Text>

          <View className={`rounded-3xl p-4 ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            <View className={`flex-row items-center rounded-2xl px-4 py-3 mb-3 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <CircleDot size={20} color="#f59e0b" />
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="From where?"
                placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
                className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              />
            </View>

            <View className={`flex-row items-center rounded-2xl px-4 py-3 mb-4 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <Navigation size={20} color="#10b981" />
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="To where?"
                placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
                className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              />
            </View>

            <TouchableOpacity
              onPress={handleSearch}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center py-4 rounded-2xl ${isDark ? 'bg-white' : 'bg-stone-900'}`}
            >
              <Search size={20} color={isDark ? '#1c1917' : '#ffffff'} />
              <Text className={`ml-2 font-semibold text-base ${isDark ? 'text-stone-900' : 'text-white'}`}>
                Find Route
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 py-6">
          {/* Popular Routes */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-lg font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                Popular Routes
              </Text>
              <TouchableOpacity onPress={() => router.push('/routes')} className="flex-row items-center">
                <Text className="text-amber-500 font-medium text-sm">See all</Text>
                <ChevronRight size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>

            {POPULAR_ROUTES.map((route) => (
              <TouchableOpacity
                key={route.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/routes/${route.id}`)}
                className={`flex-row items-center p-4 rounded-2xl mb-3 ${isDark ? 'bg-stone-900' : 'bg-white'}`}
              >
                <View className="w-10 h-10 rounded-xl bg-amber-100 items-center justify-center mr-3">
                  <TrendingUp size={20} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <Text className={`font-medium ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                    {route.from} → {route.to}
                  </Text>
                  <Text className={`text-sm mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    Popular route
                  </Text>
                </View>
                <Text className="text-amber-500 font-bold text-base">₵{route.fare.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contribute */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-lg font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                Contribute
              </Text>
              <View className="bg-amber-100 px-2.5 py-1 rounded-full">
                <Text className="text-amber-700 text-xs font-medium">Earn points</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/report/fare')}
                activeOpacity={0.7}
                className={`flex-1 p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}
              >
                <View className="w-11 h-11 rounded-xl bg-amber-500 items-center justify-center mb-3">
                  <TrendingUp size={22} color="#ffffff" />
                </View>
                <Text className={`font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>Report Fare</Text>
                <Text className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Share what you paid</Text>
                <Text className="text-amber-500 text-xs font-medium mt-2">+10 pts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/report/queue')}
                activeOpacity={0.7}
                className={`flex-1 p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}
              >
                <View className="w-11 h-11 rounded-xl bg-violet-500 items-center justify-center mb-3">
                  <Navigation size={22} color="#ffffff" />
                </View>
                <Text className={`font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>Queue Status</Text>
                <Text className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Report wait times</Text>
                <Text className="text-violet-500 text-xs font-medium mt-2">+5 pts</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
