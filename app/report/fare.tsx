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
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Coins, MapPin, Navigation, Check } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSubmitFareReport } from '@/lib/hooks/useReports'
import { useApp } from '@/lib/contexts/AppContext'

export default function FareReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const { submit, isSubmitting } = useSubmitFareReport(deviceId)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fare, setFare] = useState('')

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

    const result = await submit(from.trim(), to.trim(), fareValue)
    if (result) {
      await refreshProfile()
      setLastReward(result)
      router.back()
    } else {
      Alert.alert('Error', 'Failed to submit report. Please try again.')
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <View style={s.headerCard}>
            <View style={s.headerRow}>
              <View style={s.headerIcon}>
                <Coins size={24} color={c.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle}>Report a Fare</Text>
                <Text style={s.headerSub}>Help others know the current price</Text>
              </View>
              <View style={s.pointsBadge}>
                <Text style={s.pointsText}>+10 pts</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={s.formCard}>
            {/* From */}
            <Text style={s.label}>From</Text>
            <View style={s.inputBox}>
              <MapPin size={20} color={c.amber500} />
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="e.g. Circle"
                placeholderTextColor={t.textSecondary}
                style={s.input}
              />
            </View>

            {/* To */}
            <Text style={s.label}>To</Text>
            <View style={s.inputBox}>
              <Navigation size={20} color={c.emerald500} />
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="e.g. Madina"
                placeholderTextColor={t.textSecondary}
                style={s.input}
              />
            </View>

            {/* Fare */}
            <Text style={s.label}>Fare (GH₵)</Text>
            <View style={[s.inputBox, { marginBottom: 24 }]}>
              <Text style={s.cediSign}>₵</Text>
              <TextInput
                value={fare}
                onChangeText={setFare}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={t.textSecondary}
                style={s.fareInput}
              />
            </View>

            {/* Quick Fares */}
            <Text style={s.quickLabel}>Quick select:</Text>
            <View style={s.quickGrid}>
              {['2.00', '3.00', '3.50', '4.00', '5.00', '6.00', '7.00', '8.00'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setFare(amount)}
                  style={[
                    s.quickBtn,
                    fare === amount ? s.quickBtnActive : s.quickBtnInactive,
                  ]}
                >
                  <Text
                    style={[
                      s.quickBtnText,
                      fare === amount ? s.quickBtnTextActive : s.quickBtnTextInactive,
                    ]}
                  >
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
              style={[s.submitBtn, isSubmitting && s.submitBtnDisabled]}
            >
              <Check size={20} color={c.white} />
              <Text style={s.submitText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
    headerCard: {
      backgroundColor: c.amber500,
      padding: 20,
      borderRadius: 24,
      marginBottom: 24,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { color: c.white, fontSize: 18, fontFamily: font.bold },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
    pointsBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    pointsText: { color: c.white, fontSize: 12, fontFamily: font.semibold },
    formCard: { padding: 20, borderRadius: 24, backgroundColor: t.card },
    label: {
      fontSize: 14,
      fontFamily: font.medium,
      marginBottom: 8,
      color: isDark ? c.stone300 : c.stone600,
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
      backgroundColor: t.cardAlt,
    },
    input: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text },
    cediSign: { color: c.amber500, fontFamily: font.bold, fontSize: 18 },
    fareInput: { flex: 1, marginLeft: 12, fontSize: 20, fontFamily: font.semibold, color: t.text },
    quickLabel: { fontSize: 12, marginBottom: 12, color: t.textSecondary },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    quickBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    quickBtnActive: { backgroundColor: c.amber500 },
    quickBtnInactive: { backgroundColor: t.cardAlt },
    quickBtnText: { fontSize: 14, fontFamily: font.medium },
    quickBtnTextActive: { color: c.white },
    quickBtnTextInactive: { color: isDark ? c.stone300 : c.stone600 },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: c.amber500,
    },
    submitBtnDisabled: { backgroundColor: c.stone400 },
    submitText: { marginLeft: 8, color: c.white, fontFamily: font.semibold, fontSize: 16 },
  })
}
