import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Trophy, Star, Flame, Target, Medal, ChevronRight } from 'lucide-react-native'

// Levels definition
const LEVELS = [
  { name: 'Passenger', minPoints: 0, icon: '🚶', color: '#78716c' },
  { name: 'Regular', minPoints: 50, icon: '🚌', color: '#3b82f6' },
  { name: 'Local Expert', minPoints: 200, icon: '📍', color: '#8b5cf6' },
  { name: 'Troski Legend', minPoints: 500, icon: '🏆', color: '#f59e0b' },
]

export default function RewardsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Mock user stats - will come from context/API
  const userStats = {
    points: 0,
    level: 'Passenger',
    streak: 0,
    totalReports: 0,
    rank: '--',
  }

  const currentLevelIndex = LEVELS.findIndex((l) => l.name === userStats.level)
  const nextLevel = LEVELS[currentLevelIndex + 1]
  const progressToNext = nextLevel
    ? Math.min((userStats.points / nextLevel.minPoints) * 100, 100)
    : 100

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-12 pb-4">
          <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            Rewards
          </Text>
        </View>

        {/* Profile Card */}
        <View className="px-5 mb-6">
          <View className={`p-5 rounded-3xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-amber-500 items-center justify-center">
                <Text className="text-3xl">{LEVELS[currentLevelIndex]?.icon || '🚶'}</Text>
              </View>
              <View className="ml-4 flex-1">
                <Text className={`text-xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                  {userStats.level}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  {userStats.points} total points
                </Text>
              </View>
            </View>

            {/* Progress to next level */}
            {nextLevel && (
              <View>
                <View className="flex-row justify-between mb-2">
                  <Text className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    Progress to {nextLevel.name}
                  </Text>
                  <Text className={`text-xs font-medium ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                    {userStats.points}/{nextLevel.minPoints}
                  </Text>
                </View>
                <View className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-stone-800' : 'bg-stone-200'}`}>
                  <View
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${progressToNext}%` }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-5 mb-6">
          <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            Your Stats
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View className={`flex-1 min-w-[45%] p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
              <View className="flex-row items-center mb-2">
                <Star size={18} color="#f59e0b" />
                <Text className={`ml-2 text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  Points
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {userStats.points}
              </Text>
            </View>

            <View className={`flex-1 min-w-[45%] p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
              <View className="flex-row items-center mb-2">
                <Flame size={18} color="#ef4444" />
                <Text className={`ml-2 text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  Streak
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {userStats.streak} days
              </Text>
            </View>

            <View className={`flex-1 min-w-[45%] p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
              <View className="flex-row items-center mb-2">
                <Target size={18} color="#8b5cf6" />
                <Text className={`ml-2 text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  Reports
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                {userStats.totalReports}
              </Text>
            </View>

            <View className={`flex-1 min-w-[45%] p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
              <View className="flex-row items-center mb-2">
                <Medal size={18} color="#10b981" />
                <Text className={`ml-2 text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  Rank
                </Text>
              </View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                #{userStats.rank}
              </Text>
            </View>
          </View>
        </View>

        {/* Leaderboard Preview */}
        <View className="px-5 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`text-lg font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
              Weekly Leaderboard
            </Text>
            <TouchableOpacity className="flex-row items-center">
              <Text className="text-amber-500 text-sm font-medium">See all</Text>
              <ChevronRight size={16} color="#f59e0b" />
            </TouchableOpacity>
          </View>

          <View className={`p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            {/* Podium */}
            <View className="flex-row items-end justify-center py-4">
              {/* 2nd Place */}
              <View className="items-center mx-2">
                <View className="w-12 h-12 rounded-full bg-stone-300 items-center justify-center mb-2">
                  <Text className="text-xl">🥈</Text>
                </View>
                <View className={`w-16 h-20 rounded-t-lg ${isDark ? 'bg-stone-700' : 'bg-stone-200'} items-center justify-center`}>
                  <Text className={`text-xs font-medium ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                    --
                  </Text>
                </View>
              </View>

              {/* 1st Place */}
              <View className="items-center mx-2">
                <View className="w-14 h-14 rounded-full bg-amber-400 items-center justify-center mb-2">
                  <Text className="text-2xl">🥇</Text>
                </View>
                <View className={`w-16 h-28 rounded-t-lg bg-amber-500 items-center justify-center`}>
                  <Text className="text-xs font-medium text-white">
                    --
                  </Text>
                </View>
              </View>

              {/* 3rd Place */}
              <View className="items-center mx-2">
                <View className="w-12 h-12 rounded-full bg-amber-700 items-center justify-center mb-2">
                  <Text className="text-xl">🥉</Text>
                </View>
                <View className={`w-16 h-16 rounded-t-lg ${isDark ? 'bg-amber-900/50' : 'bg-amber-100'} items-center justify-center`}>
                  <Text className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    --
                  </Text>
                </View>
              </View>
            </View>

            <Text className={`text-center text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              Start contributing to see the leaderboard!
            </Text>
          </View>
        </View>

        {/* How to Earn */}
        <View className="px-5 mb-8">
          <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            How to Earn Points
          </Text>
          <View className={`p-4 rounded-2xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            {[
              { action: 'Report a fare', points: '+10 pts' },
              { action: 'Report queue status', points: '+5 pts' },
              { action: 'Report incident', points: '+15 pts' },
              { action: 'Daily check-in', points: '+2 pts' },
              { action: '7-day streak bonus', points: '+10 pts' },
            ].map((item, index) => (
              <View
                key={index}
                className={`flex-row justify-between py-3 ${
                  index < 4 ? `border-b ${isDark ? 'border-stone-800' : 'border-stone-100'}` : ''
                }`}
              >
                <Text className={isDark ? 'text-stone-300' : 'text-stone-700'}>
                  {item.action}
                </Text>
                <Text className="text-amber-500 font-semibold">{item.points}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
