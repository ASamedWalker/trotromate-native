import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Users, MapPin, Check, Clock } from 'lucide-react-native'

const QUEUE_LEVELS = [
  { id: 'empty', label: 'Empty', emoji: '😊', description: 'No queue, board immediately', color: '#10b981' },
  { id: 'short', label: 'Short', emoji: '🙂', description: '1-2 trotros waiting', color: '#f59e0b' },
  { id: 'moderate', label: 'Moderate', emoji: '😐', description: '3-5 trotros, ~15 min wait', color: '#f97316' },
  { id: 'long', label: 'Long', emoji: '😫', description: '5+ trotros, 30+ min wait', color: '#ef4444' },
]

export default function QueueReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const [station, setStation] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!station.trim() || !selectedLevel) {
      Alert.alert('Missing Info', 'Please select a station and queue level')
      return
    }

    setIsSubmitting(true)

    // TODO: Submit to Supabase
    setTimeout(() => {
      setIsSubmitting(false)
      Alert.alert(
        'Thank You!',
        'Your queue report has been submitted. +5 points earned!',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }, 1000)
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`} edges={['bottom']}>
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View className="bg-violet-500 p-5 rounded-3xl mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center mr-3">
              <Users size={24} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold">Queue Status</Text>
              <Text className="text-white/80 text-sm">Report wait times at stations</Text>
            </View>
            <View className="bg-white/20 px-3 py-1.5 rounded-full">
              <Text className="text-white text-xs font-semibold">+5 pts</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View className={`p-5 rounded-3xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
          {/* Station */}
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
            Station
          </Text>
          <View className={`flex-row items-center rounded-2xl px-4 py-3.5 mb-6 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
            <MapPin size={20} color="#8b5cf6" />
            <TextInput
              value={station}
              onChangeText={setStation}
              placeholder="e.g. Circle Station"
              placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
              className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
            />
          </View>

          {/* Queue Level */}
          <Text className={`text-sm font-medium mb-3 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
            How's the queue?
          </Text>
          <View className="gap-3 mb-6">
            {QUEUE_LEVELS.map((level) => {
              const isSelected = selectedLevel === level.id
              return (
                <TouchableOpacity
                  key={level.id}
                  onPress={() => setSelectedLevel(level.id)}
                  activeOpacity={0.7}
                  className={`flex-row items-center p-4 rounded-2xl border-2 ${
                    isSelected
                      ? 'border-violet-500'
                      : isDark ? 'border-stone-800 bg-stone-800' : 'border-stone-100 bg-stone-50'
                  }`}
                  style={isSelected ? { backgroundColor: isDark ? '#2e1065' : '#f5f3ff' } : undefined}
                >
                  <Text className="text-2xl mr-3">{level.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                      {level.label}
                    </Text>
                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                      {level.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-violet-500 items-center justify-center">
                      <Check size={14} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
            className={`flex-row items-center justify-center py-4 rounded-2xl ${
              isSubmitting ? 'bg-stone-400' : 'bg-violet-500'
            }`}
          >
            <Clock size={20} color="#ffffff" />
            <Text className="ml-2 text-white font-semibold text-base">
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
