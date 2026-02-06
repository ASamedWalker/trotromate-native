import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Search, MapPin, TrendingUp, Clock, Heart } from 'lucide-react-native'

interface Route {
  id: string
  from: string
  to: string
  fare: number
  lastUpdated: string
  reportCount: number
}

// Mock data - will be replaced with Supabase query
const MOCK_ROUTES: Route[] = [
  { id: '1', from: 'Circle', to: 'Madina', fare: 5.0, lastUpdated: '2h ago', reportCount: 45 },
  { id: '2', from: 'Tema Station', to: 'Accra Mall', fare: 4.0, lastUpdated: '1h ago', reportCount: 32 },
  { id: '3', from: 'Kaneshie', to: 'Lapaz', fare: 3.5, lastUpdated: '30m ago', reportCount: 28 },
  { id: '4', from: 'Osu', to: 'Airport', fare: 6.0, lastUpdated: '3h ago', reportCount: 19 },
  { id: '5', from: 'Achimota', to: 'Legon', fare: 4.5, lastUpdated: '1h ago', reportCount: 37 },
  { id: '6', from: 'Nima', to: 'Kwame Nkrumah Circle', fare: 3.0, lastUpdated: '45m ago', reportCount: 22 },
]

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const [searchQuery, setSearchQuery] = useState('')
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      let filtered = MOCK_ROUTES

      // Apply search params if present
      if (params.from || params.to) {
        filtered = MOCK_ROUTES.filter((route) => {
          const matchFrom = !params.from || route.from.toLowerCase().includes(params.from.toLowerCase())
          const matchTo = !params.to || route.to.toLowerCase().includes(params.to.toLowerCase())
          return matchFrom && matchTo
        })
      }

      setRoutes(filtered)
      setIsLoading(false)
    }, 500)
  }, [params.from, params.to])

  // Filter by search query
  const filteredRoutes = routes.filter((route) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      route.from.toLowerCase().includes(query) ||
      route.to.toLowerCase().includes(query)
    )
  })

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const renderRoute = ({ item }: { item: Route }) => {
    const isFavorite = favorites.includes(item.id)

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/routes/${item.id}`)}
        className={`flex-row items-center p-4 rounded-2xl mb-3 ${isDark ? 'bg-stone-900' : 'bg-white'}`}
      >
        <View className="w-12 h-12 rounded-xl bg-amber-100 items-center justify-center mr-3">
          <MapPin size={24} color="#f59e0b" />
        </View>

        <View className="flex-1">
          <Text className={`font-semibold text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            {item.from} → {item.to}
          </Text>
          <View className="flex-row items-center mt-1">
            <Clock size={12} color={isDark ? '#a8a29e' : '#78716c'} />
            <Text className={`text-xs ml-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              {item.lastUpdated}
            </Text>
            <Text className={`text-xs ml-3 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              {item.reportCount} reports
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-amber-500 font-bold text-lg">
            ₵{item.fare.toFixed(2)}
          </Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(item.id)}
            className="mt-1"
          >
            <Heart
              size={18}
              color={isFavorite ? '#ef4444' : isDark ? '#57534e' : '#a8a29e'}
              fill={isFavorite ? '#ef4444' : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`}>
      {/* Header */}
      <View className="px-5 pt-12 pb-4">
        <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
          Routes
        </Text>

        {/* Search Input */}
        <View className={`flex-row items-center rounded-2xl px-4 py-3 ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
          <Search size={20} color={isDark ? '#a8a29e' : '#78716c'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search routes..."
            placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
            className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
          />
        </View>

        {/* Active filters */}
        {(params.from || params.to) && (
          <View className="flex-row items-center mt-3">
            <TrendingUp size={14} color="#f59e0b" />
            <Text className={`text-sm ml-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              Showing: {params.from || 'Any'} → {params.to || 'Any'}
            </Text>
          </View>
        )}
      </View>

      {/* Routes List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text className={`mt-3 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
            Finding routes...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          renderItem={renderRoute}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MapPin size={48} color={isDark ? '#57534e' : '#a8a29e'} />
              <Text className={`text-lg font-semibold mt-4 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                No routes found
              </Text>
              <Text className={`text-sm mt-1 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                Try a different search
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
