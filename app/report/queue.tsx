import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Users, MapPin, Check, Clock } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSubmitQueueReport } from '@/lib/hooks/useReports'
import { useApp } from '@/lib/contexts/AppContext'

const QUEUE_LEVELS = [
  { id: 'empty', label: 'Empty', emoji: '😊', description: 'No queue, board immediately', color: c.emerald500 },
  { id: 'short', label: 'Short', emoji: '🙂', description: '1-2 trotros waiting', color: c.amber500 },
  { id: 'moderate', label: 'Moderate', emoji: '😐', description: '3-5 trotros, ~15 min wait', color: '#f97316' },
  { id: 'long', label: 'Long', emoji: '😫', description: '5+ trotros, 30+ min wait', color: c.red500 },
]

export default function QueueReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const { submit, isSubmitting } = useSubmitQueueReport(deviceId)

  const [station, setStation] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!station.trim() || !selectedLevel) {
      Alert.alert('Missing Info', 'Please select a station and queue level')
      return
    }

    const result = await submit(station.trim(), selectedLevel)
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
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={s.headerCard}>
          <View style={s.headerRow}>
            <View style={s.headerIcon}>
              <Users size={24} color={c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Queue Status</Text>
              <Text style={s.headerSub}>Report wait times at stations</Text>
            </View>
            <View style={s.pointsBadge}>
              <Text style={s.pointsText}>+5 pts</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={s.formCard}>
          {/* Station */}
          <Text style={s.label}>Station</Text>
          <View style={s.inputBox}>
            <MapPin size={20} color={c.violet500} />
            <TextInput
              value={station}
              onChangeText={setStation}
              placeholder="e.g. Circle Station"
              placeholderTextColor={t.textSecondary}
              style={s.input}
            />
          </View>

          {/* Queue Level */}
          <Text style={s.label}>How's the queue?</Text>
          <View style={{ gap: 12, marginBottom: 24 }}>
            {QUEUE_LEVELS.map((level) => {
              const isSelected = selectedLevel === level.id
              return (
                <TouchableOpacity
                  key={level.id}
                  onPress={() => setSelectedLevel(level.id)}
                  activeOpacity={0.7}
                  style={[
                    s.levelBtn,
                    isSelected ? s.levelBtnSelected : s.levelBtnDefault,
                    isSelected && { backgroundColor: isDark ? c.violet900 : c.violet50 },
                  ]}
                >
                  <Text style={s.levelEmoji}>{level.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.levelLabel}>{level.label}</Text>
                    <Text style={s.levelDesc}>{level.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={s.checkCircle}>
                      <Check size={14} color={c.white} />
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
            style={[s.submitBtn, isSubmitting && s.submitBtnDisabled]}
          >
            <Clock size={20} color={c.white} />
            <Text style={s.submitText}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
    headerCard: {
      backgroundColor: c.violet500,
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
      marginBottom: 24,
      backgroundColor: t.cardAlt,
    },
    input: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text },
    levelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
    },
    levelBtnSelected: { borderColor: c.violet500 },
    levelBtnDefault: {
      borderColor: isDark ? c.stone800 : c.stone100,
      backgroundColor: isDark ? c.stone800 : c.stone50,
    },
    levelEmoji: { fontSize: 24, marginRight: 12 },
    levelLabel: { fontFamily: font.semibold, color: t.text },
    levelDesc: { fontSize: 12, marginTop: 2, color: t.textSecondary },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.violet500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: c.violet500,
    },
    submitBtnDisabled: { backgroundColor: c.stone400 },
    submitText: { marginLeft: 8, color: c.white, fontFamily: font.semibold, fontSize: 16 },
  })
}
