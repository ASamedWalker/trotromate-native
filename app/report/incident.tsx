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
import {
  AlertTriangle,
  MapPin,
  Car,
  Shield,
  Construction,
  Check,
  ChevronRight,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSubmitIncidentReport } from '@/lib/hooks/useReports'
import { useApp } from '@/lib/contexts/AppContext'

const LOCATIONS = [
  { name: 'Circle', area: 'Accra' },
  { name: 'Madina', area: 'Accra' },
  { name: 'Lapaz', area: 'Accra' },
  { name: 'Achimota', area: 'Accra' },
  { name: 'Kaneshie', area: 'Accra' },
  { name: 'Tema Station', area: 'Accra' },
  { name: 'Nkrumah Circle', area: 'Accra' },
  { name: '37 Station', area: 'Accra' },
  { name: 'Kasoa', area: 'Central' },
  { name: 'Tema', area: 'Greater Accra' },
  { name: 'Ashaiman', area: 'Greater Accra' },
  { name: 'Spintex', area: 'Accra' },
  { name: 'East Legon', area: 'Accra' },
  { name: 'Dansoman', area: 'Accra' },
  { name: 'Teshie', area: 'Accra' },
]

const INCIDENT_TYPES = [
  {
    id: 'traffic',
    label: 'Heavy Traffic',
    emoji: '🚗',
    description: 'Go slow, cars plenty',
    color: '#f97316',
    Icon: Car,
  },
  {
    id: 'accident',
    label: 'Accident',
    emoji: '⚠️',
    description: 'Crash or breakdown',
    color: c.red500,
    Icon: AlertTriangle,
  },
  {
    id: 'police',
    label: 'Police Checkpoint',
    emoji: '👮',
    description: 'Officers checking vehicles',
    color: '#3b82f6',
    Icon: Shield,
  },
  {
    id: 'roadwork',
    label: 'Road Work',
    emoji: '🚧',
    description: 'Construction or repairs',
    color: c.amber500,
    Icon: Construction,
  },
]

export default function IncidentReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const { submit, isSubmitting } = useSubmitIncidentReport(deviceId)

  const [step, setStep] = useState(1)
  const [location, setLocation] = useState('')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const filteredLocations = LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.area.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectLocation = (name: string) => {
    setLocation(name)
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!location.trim() || !selectedType) {
      Alert.alert('Missing Info', 'Please select a location and incident type')
      return
    }

    const result = await submit(location.trim(), selectedType)
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
              <AlertTriangle size={24} color={c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Incident Report</Text>
              <Text style={s.headerSub}>Report traffic issues nearby</Text>
            </View>
            <View style={s.pointsBadge}>
              <Text style={s.pointsText}>+15 pts</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={s.progressRow}>
            <View style={[s.progressDot, s.progressDotActive]} />
            <View style={[s.progressLine, step >= 2 && s.progressLineActive]} />
            <View style={[s.progressDot, step >= 2 && s.progressDotActive]} />
          </View>
          <Text style={s.stepText}>Step {step} of 2</Text>
        </View>

        {step === 1 ? (
          /* Step 1: Location */
          <View style={s.formCard}>
            <Text style={s.label}>Where is the incident?</Text>
            <View style={s.inputBox}>
              <MapPin size={20} color={c.red500} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search locations..."
                placeholderTextColor={t.textSecondary}
                style={s.input}
              />
            </View>

            <View style={{ gap: 8 }}>
              {filteredLocations.map((loc) => (
                <TouchableOpacity
                  key={loc.name}
                  onPress={() => handleSelectLocation(loc.name)}
                  activeOpacity={0.7}
                  style={s.locationBtn}
                >
                  <View style={s.locationDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.locationName}>{loc.name}</Text>
                    <Text style={s.locationArea}>{loc.area}</Text>
                  </View>
                  <ChevronRight size={18} color={t.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom location */}
            <TouchableOpacity
              onPress={() => {
                if (search.trim()) {
                  handleSelectLocation(search.trim())
                } else {
                  Alert.alert('Enter Location', 'Type a location name in the search box above')
                }
              }}
              activeOpacity={0.7}
              style={s.customBtn}
            >
              <MapPin size={18} color={c.red500} />
              <Text style={s.customBtnText}>
                {search.trim() ? `Use "${search.trim()}"` : 'Enter custom location'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Step 2: Incident Type */
          <View style={s.formCard}>
            <View style={s.selectedLocationRow}>
              <MapPin size={16} color={c.red500} />
              <Text style={s.selectedLocationText}>{location}</Text>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={s.changeText}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 16 }]}>What happened?</Text>
            <View style={{ gap: 12, marginBottom: 24 }}>
              {INCIDENT_TYPES.map((type) => {
                const isSelected = selectedType === type.id
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setSelectedType(type.id)}
                    activeOpacity={0.7}
                    style={[
                      s.typeBtn,
                      isSelected ? { borderColor: type.color } : s.typeBtnDefault,
                      isSelected && { backgroundColor: isDark ? `${type.color}15` : `${type.color}10` },
                    ]}
                  >
                    <Text style={s.typeEmoji}>{type.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.typeLabel}>{type.label}</Text>
                      <Text style={s.typeDesc}>{type.description}</Text>
                    </View>
                    {isSelected && (
                      <View style={[s.checkCircle, { backgroundColor: type.color }]}>
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
              disabled={isSubmitting || !selectedType}
              activeOpacity={0.8}
              style={[s.submitBtn, (isSubmitting || !selectedType) && s.submitBtnDisabled]}
            >
              <AlertTriangle size={20} color={c.white} />
              <Text style={s.submitText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
      backgroundColor: c.red500,
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
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    progressDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    progressDotActive: { backgroundColor: c.white },
    progressLine: {
      height: 2,
      width: 60,
      backgroundColor: 'rgba(255,255,255,0.3)',
      marginHorizontal: 8,
    },
    progressLineActive: { backgroundColor: c.white },
    stepText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
    },
    formCard: { padding: 20, borderRadius: 24, backgroundColor: t.card },
    label: {
      fontSize: 14,
      fontFamily: font.medium,
      marginBottom: 12,
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
    locationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      backgroundColor: t.cardAlt,
    },
    locationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.red500,
      marginRight: 12,
    },
    locationName: { fontFamily: font.medium, color: t.text },
    locationArea: { fontSize: 12, color: t.textSecondary, marginTop: 1 },
    customBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
      marginTop: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: isDark ? c.stone700 : c.stone300,
    },
    customBtnText: {
      marginLeft: 8,
      fontFamily: font.medium,
      color: c.red500,
    },
    selectedLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.cardAlt,
    },
    selectedLocationText: {
      flex: 1,
      marginLeft: 8,
      fontFamily: font.medium,
      color: t.text,
    },
    changeText: { color: c.red500, fontSize: 13, fontFamily: font.medium },
    typeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
    },
    typeBtnDefault: {
      borderColor: isDark ? c.stone800 : c.stone100,
      backgroundColor: isDark ? c.stone800 : c.stone50,
    },
    typeEmoji: { fontSize: 24, marginRight: 12 },
    typeLabel: { fontFamily: font.semibold, color: t.text },
    typeDesc: { fontSize: 12, marginTop: 2, color: t.textSecondary },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: c.red500,
    },
    submitBtnDisabled: { backgroundColor: c.stone400 },
    submitText: { marginLeft: 8, color: c.white, fontFamily: font.semibold, fontSize: 16 },
  })
}
