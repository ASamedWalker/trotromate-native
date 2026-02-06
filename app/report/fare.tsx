import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Coins, MapPin, Navigation, Check } from 'lucide-react-native'

export default function FareReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fare, setFare] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!from.trim() || !to.trim() || !fare.trim()) {
      Alert.alert('Missing Info', 'Please fill in all fields')
      return
    }

    const fareValue = parseFloat(fare)
    if (isNaN(fareValue) || fareValue <= 0) {
      Alert.alert('Invalid Fare', 'Please enter a valid fare amount')
      return
    }

    setIsSubmitting(true)

    // TODO: Submit to Supabase
    setTimeout(() => {
      setIsSubmitting(false)
      Alert.alert(
        'Thank You!',
        'Your fare report has been submitted. +10 points earned!',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }, 1000)
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <View className="bg-amber-500 p-5 rounded-3xl mb-6">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center mr-3">
                <Coins size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold">Report a Fare</Text>
                <Text className="text-white/80 text-sm">Help others know the current price</Text>
              </View>
              <View className="bg-white/20 px-3 py-1.5 rounded-full">
                <Text className="text-white text-xs font-semibold">+10 pts</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View className={`p-5 rounded-3xl ${isDark ? 'bg-stone-900' : 'bg-white'}`}>
            {/* From */}
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
              From
            </Text>
            <View className={`flex-row items-center rounded-2xl px-4 py-3.5 mb-4 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <MapPin size={20} color="#f59e0b" />
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="e.g. Circle"
                placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
                className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              />
            </View>

            {/* To */}
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
              To
            </Text>
            <View className={`flex-row items-center rounded-2xl px-4 py-3.5 mb-4 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <Navigation size={20} color="#10b981" />
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="e.g. Madina"
                placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
                className={`flex-1 ml-3 text-base ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              />
            </View>

            {/* Fare */}
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
              Fare (GH₵)
            </Text>
            <View className={`flex-row items-center rounded-2xl px-4 py-3.5 mb-6 ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <Text className="text-amber-500 font-bold text-lg">₵</Text>
              <TextInput
                value={fare}
                onChangeText={setFare}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={isDark ? '#a8a29e' : '#78716c'}
                className={`flex-1 ml-3 text-xl font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              />
            </View>

            {/* Quick Fares */}
            <Text className={`text-xs mb-3 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              Quick select:
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {['2.00', '3.00', '3.50', '4.00', '5.00', '6.00', '7.00', '8.00'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setFare(amount)}
                  className={`px-4 py-2 rounded-xl ${
                    fare === amount
                      ? 'bg-amber-500'
                      : isDark ? 'bg-stone-800' : 'bg-stone-100'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    fare === amount
                      ? 'text-white'
                      : isDark ? 'text-stone-300' : 'text-stone-600'
                  }`}>
                    ₵{amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center py-4 rounded-2xl ${
                isSubmitting ? 'bg-stone-400' : 'bg-amber-500'
              }`}
            >
              <Check size={20} color="#ffffff" />
              <Text className="ml-2 text-white font-semibold text-base">
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
