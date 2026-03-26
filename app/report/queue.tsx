import { useState, useMemo } from 'react'
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
import { Users, MapPin, Check, Clock, Bus, X } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSubmitQueueReport } from '@/lib/hooks/useReports'
import { useStations } from '@/lib/hooks/useStations'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useStoreReview } from '@/lib/hooks/useStoreReview'

const QUEUE_LEVELS = [
  { id: 'empty', label: 'Empty', emoji: '😊', description: 'No queue, board immediately', color: c.emerald500 },
  { id: 'short', label: 'Short', emoji: '🙂', description: '1-2 trotros waiting', color: c.amber500 },
  { id: 'moderate', label: 'Moderate', emoji: '😐', description: '3-5 trotros, ~15 min wait', color: '#f97316' },
  { id: 'long', label: 'Long', emoji: '😫', description: '5+ trotros, 30+ min wait', color: c.red500 },
]

const VEHICLE_COUNTS = [
  { label: '0', value: 0 },
  { label: '1-2', value: 2 },
  { label: '3-5', value: 4 },
  { label: '5-10', value: 8 },
  { label: '10+', value: 12 },
]

const WAIT_TIMES = [
  { label: '< 5 min', value: 3 },
  { label: '5-10', value: 8 },
  { label: '10-20', value: 15 },
  { label: '20-30', value: 25 },
  { label: '30+', value: 40 },
]

export default function QueueReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const haptics = useHaptics()
  const { maybePromptReview } = useStoreReview()
  const { submit, isSubmitting } = useSubmitQueueReport(deviceId)
  const { stations } = useStations()

  const [stationQuery, setStationQuery] = useState('')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedStationName, setSelectedStationName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [selectedVehicleCount, setSelectedVehicleCount] = useState<number | null>(null)
  const [selectedWaitTime, setSelectedWaitTime] = useState<number | null>(null)

  // Filter stations for autocomplete
  const filteredStations = useMemo(() => {
    if (!stationQuery.trim() || stationQuery.length < 2) return []
    const q = stationQuery.toLowerCase()
    return stations
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 5)
  }, [stationQuery, stations])

  const handleStationSelect = (station: { id: string; name: string }) => {
    setSelectedStationId(station.id)
    setSelectedStationName(station.name)
    setStationQuery(station.name)
    setShowSuggestions(false)
    haptics.light()
  }

  const handleClearStation = () => {
    setSelectedStationId(null)
    setSelectedStationName('')
    setStationQuery('')
    setShowSuggestions(false)
  }

  const handleSubmit = async () => {
    const name = selectedStationName || stationQuery.trim()
    if (!name || !selectedLevel) {
      Alert.alert('Missing Info', 'Please select a station and queue level')
      return
    }

    const result = await submit(name, selectedLevel, selectedStationId ?? undefined, selectedVehicleCount ?? undefined, selectedWaitTime ?? undefined)
    if (result) {
      haptics.success()
      await refreshProfile()
      setLastReward(result)
      await maybePromptReview()
      router.back()
    } else {
      Alert.alert('Error', 'Failed to submit report. Please try again.')
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
          {/* Station with autocomplete */}
          <Text style={s.label}>Station</Text>
          <View style={s.inputBox}>
            <MapPin size={20} color={c.violet500} />
            <TextInput
              value={stationQuery}
              onChangeText={(text) => {
                setStationQuery(text)
                setShowSuggestions(true)
                if (selectedStationId) {
                  setSelectedStationId(null)
                  setSelectedStationName('')
                }
              }}
              placeholder="Search stations..."
              placeholderTextColor={t.textSecondary}
              style={s.input}
            />
            {stationQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearStation}>
                <X size={16} color={t.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Station suggestions dropdown */}
          {showSuggestions && filteredStations.length > 0 && !selectedStationId && (
            <View style={s.suggestions}>
              {filteredStations.map((station) => (
                <TouchableOpacity
                  key={station.id}
                  style={s.suggestionRow}
                  onPress={() => handleStationSelect(station)}
                  activeOpacity={0.7}
                >
                  <Bus size={14} color={c.amber500} />
                  <Text style={s.suggestionText} numberOfLines={1}>
                    {station.name}
                  </Text>
                  {station.location ? (
                    <Text style={s.suggestionLocation} numberOfLines={1}>
                      {station.location}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected station badge */}
          {selectedStationId && (
            <View style={s.selectedBadge}>
              <Check size={12} color={c.emerald500} />
              <Text style={s.selectedBadgeText}>
                Linked to {selectedStationName}
              </Text>
            </View>
          )}

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

          {/* Vehicle count picker */}
          <Text style={s.label}>Vehicles waiting (optional)</Text>
          <View style={s.vehicleRow}>
            {VEHICLE_COUNTS.map((vc) => {
              const isSelected = selectedVehicleCount === vc.value
              return (
                <TouchableOpacity
                  key={vc.value}
                  onPress={() => {
                    setSelectedVehicleCount(isSelected ? null : vc.value)
                    haptics.light()
                  }}
                  activeOpacity={0.7}
                  style={[
                    s.vehicleBtn,
                    isSelected ? s.vehicleBtnSelected : s.vehicleBtnDefault,
                  ]}
                >
                  <Text style={[
                    s.vehicleBtnText,
                    { color: isSelected ? c.white : t.textSecondary },
                  ]}>
                    {vc.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Wait time picker */}
          <Text style={s.label}>How long did you wait? (optional)</Text>
          <View style={s.vehicleRow}>
            {WAIT_TIMES.map((wt) => {
              const isSelected = selectedWaitTime === wt.value
              return (
                <TouchableOpacity
                  key={wt.value}
                  onPress={() => {
                    setSelectedWaitTime(isSelected ? null : wt.value)
                    haptics.light()
                  }}
                  activeOpacity={0.7}
                  style={[
                    s.vehicleBtn,
                    isSelected ? s.vehicleBtnSelected : s.vehicleBtnDefault,
                  ]}
                >
                  <Text style={[
                    s.vehicleBtnText,
                    { color: isSelected ? c.white : t.textSecondary },
                  ]}>
                    {wt.label}
                  </Text>
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
      marginBottom: 8,
      backgroundColor: t.cardAlt,
    },
    input: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text },
    suggestions: {
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: t.cardAlt,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? c.stone700 : c.stone200,
    },
    suggestionText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
      flexShrink: 1,
    },
    suggestionLocation: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginLeft: 'auto',
    },
    selectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    selectedBadgeText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: c.emerald500,
    },
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
    vehicleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    vehicleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
    },
    vehicleBtnSelected: {
      backgroundColor: c.amber500,
      borderColor: c.amber500,
    },
    vehicleBtnDefault: {
      borderColor: isDark ? c.stone700 : c.stone200,
      backgroundColor: isDark ? c.stone800 : c.stone50,
    },
    vehicleBtnText: {
      fontSize: 13,
      fontFamily: font.semibold,
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
