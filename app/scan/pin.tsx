import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Delete } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function WalletPinScreen() {
  const router = useRouter()
  const [pin, setPin] = useState('')

  const press = (k: string) => {
    if (k === '') return
    Haptics.selectionAsync()
    if (k === 'del') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const next = pin + k
    setPin(next)
    if (next.length === 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Any 6-digit PIN succeeds for now -> processing -> receipt
      setTimeout(() => router.replace('/booking/processing' as never), 160)
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: 24 }}>
        {/* Title + PIN boxes */}
        <View style={{ alignItems: 'center', paddingTop: 48 }}>
          <Text style={s.title}>Enter your Troski PIN</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 34 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[s.box, i < pin.length && s.boxFilled]}>
                {i < pin.length && <View style={s.dotFill} />}
              </View>
            ))}
          </View>
        </View>

        {/* Keypad */}
        <View style={s.keypad}>
          {KEYS.map((k, i) => (
            <View key={i} style={s.keyWrap}>
              {k !== '' && (
                <TouchableOpacity activeOpacity={0.6} onPress={() => press(k)} style={s.keyBtn}>
                  {k === 'del' ? <Delete size={24} color="#111" /> : <Text style={s.keyText}>{k}</Text>}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  title: { fontFamily: font.bold, fontSize: 20, color: '#111' },
  box: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  boxFilled: { backgroundColor: '#FFF0EB' },
  dotFill: { width: 13, height: 13, borderRadius: 7, backgroundColor: BRAND },

  keypad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 36 },
  keyWrap: { width: '33.33%', paddingHorizontal: 8, paddingVertical: 6 },
  keyBtn: { height: 62, borderRadius: 16, backgroundColor: '#F7F7F6', justifyContent: 'center', alignItems: 'center' },
  keyText: { fontFamily: font.semibold, fontSize: 26, color: '#111' },
})
