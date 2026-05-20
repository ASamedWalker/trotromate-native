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
  useWindowDimensions,
  Modal,
  Pressable,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Users,
  MapPin,
  Check,
  Bus,
  X,
  Minus,
  Plus,
  Send,
  Search,
  ChevronDown,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font } from '@/lib/theme'
import { useSubmitQueueReport } from '@/lib/hooks/useReports'
import { useStations } from '@/lib/hooks/useStations'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useStoreReview } from '@/lib/hooks/useStoreReview'

const QUEUE_LEVELS = [
  { id: 'empty', label: 'Empty', emoji: '😊' },
  { id: 'short', label: 'Short', emoji: '🙂' },
  { id: 'moderate', label: 'Moderate', emoji: '😐' },
  { id: 'long', label: 'Long', emoji: '😫' },
]

export default function QueueReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { width } = useWindowDimensions()
  const levelWidth = (width - 48 - 36) / 4 // px-6 + 3 gaps of 12

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const haptics = useHaptics()
  const { maybePromptReview } = useStoreReview()
  const { submit, isSubmitting } = useSubmitQueueReport(deviceId)
  const { stations } = useStations()

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedStationName, setSelectedStationName] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [locationModalVisible, setLocationModalVisible] = useState(false)
  const [search, setSearch] = useState('')

  const filteredStations = useMemo(() => {
    if (!search.trim() || search.length < 2) return stations.slice(0, 15)
    const q = search.toLowerCase()
    return stations.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 15)
  }, [search, stations])

  const handleStationSelect = (station: { id: string; name: string }) => {
    setSelectedStationId(station.id)
    setSelectedStationName(station.name)
    setLocationModalVisible(false)
    setSearch('')
    haptics.light()
  }

  const handleSubmit = async () => {
    const name = selectedStationName
    if (!name || !selectedLevel) {
      Alert.alert('Missing Info', 'Please select a station and queue level')
      return
    }

    const result = await submit(
      name,
      selectedLevel,
      selectedStationId ?? undefined,
      vehicleCount > 0 ? vehicleCount : undefined,
      undefined
    )
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

  const canSubmit = selectedStationName && selectedLevel && !isSubmitting

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Close button */}
      <TouchableOpacity onPress={() => { haptics.light(); router.back() }} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.closeBtn}>
        <X size={20} color={isDark ? '#fafaf9' : '#44403c'} />
      </TouchableOpacity>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Location Pill */}
        <View style={s.locationPillWrap}>
          <TouchableOpacity
            style={s.locationPill}
            activeOpacity={0.7}
            onPress={() => setLocationModalVisible(true)}
          >
            <MapPin size={14} color="#815100" />
            <Text style={s.locationPillText} numberOfLines={1}>
              {selectedStationName || 'Select station'}
            </Text>
            <ChevronDown size={14} color="#815100" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIconBox}>
            <Users size={36} color="#6b21a8" />
          </View>
          <Text style={s.heroLabel}>COMMUNITY CONTRIBUTION</Text>
          <Text style={s.heroTitle}>How's the queue?</Text>
        </View>

        {/* Queue Level Grid 2x2 or 4x1 */}
        <View style={s.levelGrid}>
          {QUEUE_LEVELS.map((level) => {
            const isSelected = selectedLevel === level.id
            return (
              <TouchableOpacity
                key={level.id}
                onPress={() => {
                  setSelectedLevel(level.id)
                  haptics.light()
                }}
                activeOpacity={0.7}
                style={[
                  s.levelCard,
                  { width: levelWidth },
                  isSelected && s.levelCardSelected,
                ]}
              >
                <Text style={s.levelEmoji}>{level.emoji}</Text>
                <Text style={[
                  s.levelLabel,
                  isSelected && s.levelLabelSelected,
                ]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Counter Section */}
        <View style={s.counterCard}>
          <Text style={s.counterTitle}>Buses in the yard</Text>
          <Text style={s.counterSubtitle}>
            Approximate count of available vehicles
          </Text>
          <View style={s.counterRow}>
            <TouchableOpacity
              onPress={() => {
                if (vehicleCount > 0) {
                  setVehicleCount(vehicleCount - 1)
                  haptics.light()
                }
              }}
              activeOpacity={0.7}
              style={s.counterBtnMinus}
            >
              <Minus size={24} color="#815100" />
            </TouchableOpacity>
            <Text style={s.counterValue}>
              {vehicleCount.toString().padStart(2, '0')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setVehicleCount(vehicleCount + 1)
                haptics.light()
              }}
              activeOpacity={0.7}
              style={s.counterBtnPlus}
            >
              <Plus size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Submit */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          style={{ borderRadius: 16, overflow: 'hidden', opacity: canSubmit ? 1 : 0.4 }}
        >
          <LinearGradient
            colors={['#815100', '#f8a010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.submitBtn}
          >
            <Text style={s.submitText}>
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
            </Text>
            <Send size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Station Picker Modal */}
      <Modal visible={locationModalVisible} transparent animationType="slide">
        <Pressable
          style={s.modalOverlay}
          onPress={() => setLocationModalVisible(false)}
        >
          <Pressable style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Station</Text>

            <View style={s.searchBox}>
              <Search size={18} color="#815100" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search stations..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#b2acaa'}
                style={s.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color={isDark ? 'rgba(255,255,255,0.4)' : '#b2acaa'} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredStations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 320 }}
              renderItem={({ item: station }) => (
                <TouchableOpacity
                  onPress={() => handleStationSelect(station)}
                  activeOpacity={0.7}
                  style={s.stationRow}
                >
                  <Bus size={14} color="#815100" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.stationName} numberOfLines={1}>
                      {station.name}
                    </Text>
                    {station.location ? (
                      <Text style={s.stationLocation} numberOfLines={1}>
                        {station.location}
                      </Text>
                    ) : null}
                  </View>
                  {selectedStationId === station.id && (
                    <Check size={18} color="#815100" />
                  )}
                </TouchableOpacity>
              )}
            />

            {search.trim() && !filteredStations.some(s => s.name.toLowerCase() === search.trim().toLowerCase()) && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedStationId(null)
                  setSelectedStationName(search.trim())
                  setLocationModalVisible(false)
                  setSearch('')
                }}
                activeOpacity={0.7}
                style={s.customLocBtn}
              >
                <MapPin size={16} color="#815100" />
                <Text style={s.customLocText}>Use "{search.trim()}"</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#0c0a09' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const surfaceHighest = isDark ? 'rgba(255,255,255,0.08)' : '#e3dbd8'
  const onSurface = isDark ? '#fafaf9' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: surface,
    },
    closeBtn: {
      position: 'absolute',
      top: 48,
      right: 16,
      zIndex: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
      paddingTop: 8,
    },

    // Location pill
    locationPillWrap: {
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e8e1de',
    },
    locationPillText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      maxWidth: 220,
    },

    // Hero
    hero: {
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    heroIconBox: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(107,33,168,0.15)' : 'rgba(255,201,105,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroLabel: {
      fontSize: 12,
      fontFamily: font.bold,
      color: '#815100',
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    heroTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
    },

    // Queue level grid
    levelGrid: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 32,
    },
    levelCard: {
      alignItems: 'center',
      paddingVertical: 20,
      borderRadius: 20,
      backgroundColor: surfaceLow,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    levelCardSelected: {
      backgroundColor: surfaceLowest,
      borderColor: isDark ? '#f8a010' : '#f8a010',
      shadowColor: 'rgba(248,160,16,0.2)',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 4,
    },
    levelEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    levelLabel: {
      fontSize: 11,
      fontFamily: font.bold,
      color: onSurfaceVariant,
      textTransform: 'uppercase',
    },
    levelLabelSelected: {
      color: '#815100',
    },

    // Counter
    counterCard: {
      marginHorizontal: 24,
      padding: 32,
      borderRadius: 32,
      backgroundColor: surfaceLow,
      alignItems: 'center',
      marginBottom: 32,
    },
    counterTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: onSurface,
    },
    counterSubtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
      marginBottom: 24,
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 32,
    },
    counterBtnMinus: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: surfaceHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterBtnPlus: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: 'rgba(129,81,0,0.2)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 6,
    },
    counterValue: {
      fontSize: 48,
      fontFamily: font.extrabold,
      color: onSurface,
    },

    // Bottom bar
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      backgroundColor: isDark ? 'rgba(12,10,9,0.85)' : 'rgba(252,245,242,0.85)',
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
    },
    submitBtn: {
      height: 64,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    submitText: {
      fontFamily: font.extrabold,
      fontSize: 17,
      color: '#fff',
      letterSpacing: 3,
      textTransform: 'uppercase',
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: isDark ? '#1c1c1e' : surfaceLowest,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: outlineVariant,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: onSurface,
      marginBottom: 16,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: surfaceLow,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.regular,
      color: onSurface,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: outlineVariant,
    },
    stationName: {
      fontSize: 15,
      fontFamily: font.medium,
      color: onSurface,
    },
    stationLocation: {
      fontSize: 12,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 1,
    },
    customLocBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: outlineVariant,
    },
    customLocText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: '#815100',
    },
  })
}
