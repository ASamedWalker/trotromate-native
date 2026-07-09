import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Clock } from 'lucide-react-native'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

/**
 * Honest dead-end for features that are not live yet but whose routes exist
 * (deep links, stale entry points). Replaces mock flows — a user must never
 * walk through a fake version of a real-money feature.
 */
export default function ComingSoonScreen({ title, message }: { title: string; message: string }) {
  const router = useRouter()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF3EE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Clock size={28} color={BRAND} />
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#111', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as never) }}
        style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: BRAND }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
