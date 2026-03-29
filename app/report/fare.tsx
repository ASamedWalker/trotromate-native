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
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  MapPin,
  Navigation,
  Check,
  Bus,
  Bike,
  Globe,
  Send,
  Minus,
  Plus,
  Banknote,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font } from '@/lib/theme'
import { useSubmitFareReport } from '@/lib/hooks/useReports'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useStoreReview } from '@/lib/hooks/useStoreReview'
import { detectRegionOrNull, REGIONS } from '@/lib/config/regions'
import type { TransportType } from '@/lib/types'

export default function FareReportScreen() {
  const router = useRouter()
  const { transport_type: urlTransportType } = useLocalSearchParams<{ transport_type?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const haptics = useHaptics()
  const { maybePromptReview } = useStoreReview()
  const { submit, isSubmitting } = useSubmitFareReport(deviceId)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fare, setFare] = useState('')
  const [transportType, setTransportType] = useState<TransportType>(
    urlTransportType === 'okada' ? 'okada' : 'trotro'
  )
  const isOkada = transportType === 'okada'

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [showRegionPicker, setShowRegionPicker] = useState(false)

  const autoRegion = from.trim().length >= 2 ? detectRegionOrNull(from.trim()) : null
  const activeRegion = selectedRegion ?? autoRegion
  const activeRegionLabel = activeRegion
    ? REGIONS.find(r => r.key === activeRegion)?.label ?? null
    : null

  const adjustFare = (delta: number) => {
    haptics.light()
    const current = parseFloat(fare) || 0
    const next = Math.max(0, current + delta)
    setFare(next % 1 === 0 ? next.toFixed(0) : next.toFixed(2))
  }

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

    const { reward, errorMsg } = await submit(from.trim(), to.trim(), fareValue, transportType, activeRegion ?? undefined)
    if (reward) {
      haptics.success()
      await refreshProfile()
      setLastReward(reward)
      await maybePromptReview()
      router.back()
    } else {
      Alert.alert('Error', `Failed to submit report. ${errorMsg || 'Please try again.'}`)
    }
  }

  const canSubmit = from.trim() && to.trim() && fare.trim() && parseFloat(fare) > 0 && !isSubmitting

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Reward Header */}
          <View style={s.rewardHeader}>
            <View style={s.rewardIcon}>
              <Banknote size={32} color="#815100" />
            </View>
            <Text style={s.rewardText}>Earn +10 XP</Text>
          </View>

          {/* Step 1: Location */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Where are you?</Text>

            <View style={s.locationCard}>
              <MapPin size={18} color="#815100" />
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="From — e.g. Circle"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#b2acaa'}
                style={s.locationInput}
              />
            </View>

            {/* Region chip */}
            <TouchableOpacity
              style={[s.regionChip, activeRegion && s.regionChipActive]}
              onPress={() => setShowRegionPicker(!showRegionPicker)}
              activeOpacity={0.7}
            >
              <Globe size={12} color={activeRegion ? '#22c55e' : '#b2acaa'} />
              <Text style={[s.regionChipText, activeRegion && s.regionChipTextActive]}>
                {activeRegionLabel ?? 'Select region'}
              </Text>
              {autoRegion && !selectedRegion && (
                <Text style={s.regionAutoTag}>auto</Text>
              )}
            </TouchableOpacity>
            {showRegionPicker && (
              <View style={s.regionGrid}>
                {REGIONS.filter(r => r.key !== 'all').map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[s.regionOption, activeRegion === r.key && s.regionOptionActive]}
                    onPress={() => { setSelectedRegion(r.key); setShowRegionPicker(false) }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.regionOptionText, activeRegion === r.key && s.regionOptionTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.locationCard}>
              <Navigation size={18} color="#22c55e" />
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="To — e.g. Madina"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#b2acaa'}
                style={s.locationInput}
              />
            </View>
          </View>

          {/* Step 2: Fare Amount */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>How much?</Text>

            {/* Fare display with +/- */}
            <View style={s.fareCard}>
              <TouchableOpacity
                onPress={() => adjustFare(-0.5)}
                activeOpacity={0.7}
                style={s.fareBtn}
              >
                <Minus size={24} color="#815100" />
              </TouchableOpacity>

              <View style={s.fareInputWrap}>
                <Text style={s.fareCedi}>₵</Text>
                <TextInput
                  value={fare}
                  onChangeText={setFare}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#b2acaa'}
                  keyboardType="decimal-pad"
                  style={s.fareInput}
                />
              </View>

              <TouchableOpacity
                onPress={() => adjustFare(0.5)}
                activeOpacity={0.7}
                style={s.fareBtnPlus}
              >
                <Plus size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Quick amounts */}
            <View style={s.quickRow}>
              {['2.00', '3.50', '5.00', '7.00', '10.00'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => { haptics.light(); setFare(amount) }}
                  activeOpacity={0.7}
                  style={[s.quickBtn, fare === amount && s.quickBtnActive]}
                >
                  <Text style={[s.quickBtnText, fare === amount && s.quickBtnTextActive]}>
                    ₵{amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 3: Vehicle Type */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Vehicle Type?</Text>
            <View style={s.vehicleRow}>
              <TouchableOpacity
                onPress={() => setTransportType('trotro')}
                activeOpacity={0.7}
                style={[s.vehicleCard, !isOkada && s.vehicleCardSelected]}
              >
                <View style={[s.vehicleIcon, { backgroundColor: !isOkada ? '#f8a010' : (isDark ? 'rgba(255,255,255,0.06)' : '#e3dbd8') }]}>
                  <Bus size={22} color={!isOkada ? '#4a2c00' : (isDark ? 'rgba(255,255,255,0.4)' : '#5f5b59')} />
                </View>
                <Text style={[s.vehicleLabel, !isOkada && s.vehicleLabelSelected]}>Trotro</Text>
                {!isOkada && (
                  <View style={s.vehicleCheck}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTransportType('okada')}
                activeOpacity={0.7}
                style={[s.vehicleCard, isOkada && s.vehicleCardSelected]}
              >
                <View style={[s.vehicleIcon, { backgroundColor: isOkada ? '#f8a010' : (isDark ? 'rgba(255,255,255,0.06)' : '#e3dbd8') }]}>
                  <Bike size={22} color={isOkada ? '#4a2c00' : (isDark ? 'rgba(255,255,255,0.4)' : '#5f5b59')} />
                </View>
                <Text style={[s.vehicleLabel, isOkada && s.vehicleLabelSelected]}>Okada</Text>
                {isOkada && (
                  <View style={s.vehicleCheck}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT FARE'}
            </Text>
            <Send size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    scroll: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
    },

    // Reward header
    rewardHeader: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    rewardIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(255,201,105,0.15)' : '#ffc969',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: 'rgba(129,81,0,0.1)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 4,
    },
    rewardText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
      letterSpacing: 1,
    },

    // Sections
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 24,
      fontFamily: font.bold,
      color: onSurface,
      marginBottom: 16,
    },

    // Location
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: surfaceLow,
      marginBottom: 12,
    },
    locationInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.medium,
      color: onSurface,
    },

    // Region
    regionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : surfaceLow,
      marginBottom: 12,
    },
    regionChipActive: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
    },
    regionChipText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    regionChipTextActive: {
      color: '#22c55e',
    },
    regionAutoTag: {
      fontSize: 9,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : surfaceHighest,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      marginLeft: 2,
    },
    regionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    regionOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : surfaceLow,
    },
    regionOptionActive: {
      backgroundColor: '#22c55e',
    },
    regionOptionText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    regionOptionTextActive: {
      color: '#fff',
    },

    // Fare
    fareCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    fareBtn: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: surfaceHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fareBtnPlus: {
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
    fareInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 20,
      borderRadius: 20,
      backgroundColor: surfaceLowest,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    fareCedi: {
      fontSize: 32,
      fontFamily: font.extrabold,
      color: '#815100',
    },
    fareInput: {
      fontSize: 48,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -2,
      textAlign: 'center',
      minWidth: 80,
      padding: 0,
    },

    // Quick amounts
    quickRow: {
      flexDirection: 'row',
      gap: 8,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: surfaceHighest,
      alignItems: 'center',
    },
    quickBtnActive: {
      backgroundColor: '#815100',
    },
    quickBtnText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: '#815100',
    },
    quickBtnTextActive: {
      color: '#fff',
    },

    // Vehicle type
    vehicleRow: {
      flexDirection: 'row',
      gap: 16,
    },
    vehicleCard: {
      flex: 1,
      padding: 24,
      borderRadius: 20,
      backgroundColor: surfaceLow,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    vehicleCardSelected: {
      backgroundColor: surfaceLowest,
      borderColor: '#815100',
      shadowColor: 'rgba(129,81,0,0.05)',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 2,
    },
    vehicleIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    vehicleLabel: {
      fontSize: 15,
      fontFamily: font.bold,
      color: onSurfaceVariant,
    },
    vehicleLabelSelected: {
      color: onSurface,
    },
    vehicleCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
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
      height: 56,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    submitText: {
      fontFamily: font.extrabold,
      fontSize: 16,
      color: '#fff',
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
  })
}
