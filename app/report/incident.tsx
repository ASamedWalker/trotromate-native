import { useState, useMemo, useEffect } from 'react'
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
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import {
  AlertTriangle,
  MapPin,
  Car,
  ShieldCheck,
  Construction,
  Check,
  Ban,
  TriangleAlert,
  Camera,
  ChevronDown,
  Send,
  Search,
  X,
  Navigation,
  MapPinOff,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { font } from '@/lib/theme'
import { useSubmitIncidentReport } from '@/lib/hooks/useReports'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useStoreReview } from '@/lib/hooks/useStoreReview'
import { useStations } from '@/lib/hooks/useStations'

const INCIDENT_TYPES = [
  { id: 'traffic', label: 'Traffic', icon: Car, color: '#815100' },
  { id: 'accident', label: 'Accident', icon: AlertTriangle, color: '#b02500' },
  { id: 'police_checkpoint', label: 'Police', icon: ShieldCheck, color: '#815100' },
  { id: 'road_closure', label: 'Road\nClosure', icon: Ban, color: '#815100' },
  { id: 'flooding', label: 'Hazard', icon: TriangleAlert, color: '#815100' },
  { id: 'breakdown', label: 'Work', icon: Construction, color: '#815100' },
]

export default function IncidentReportScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const { width } = useWindowDimensions()
  const gridSize = (width - 48 - 32) / 3 // px-6 + 2 gaps of 16

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const haptics = useHaptics()
  const { maybePromptReview } = useStoreReview()
  const { submit, isSubmitting } = useSubmitIncidentReport(deviceId)
  const { stations } = useStations()

  const [location, setLocation] = useState('')
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'acquired' | 'denied' | 'error'>('loading')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [locationModalVisible, setLocationModalVisible] = useState(false)
  const [search, setSearch] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  // Grab GPS on mount — this is the primary coordinate source
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          if (!cancelled) setGpsStatus('denied')
          return
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        if (!cancelled) {
          setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          setGpsStatus('acquired')
        }
      } catch {
        if (!cancelled) setGpsStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Find nearest station name as default location label
  const nearestStation = useMemo(() => {
    if (!gpsCoords || !stations.length) return null
    let closest: { name: string; dist: number } | null = null
    for (const st of stations) {
      if (st.latitude == null || st.longitude == null) continue
      const dlat = st.latitude - gpsCoords.latitude
      const dlng = st.longitude - gpsCoords.longitude
      const dist = dlat * dlat + dlng * dlng
      if (!closest || dist < closest.dist) {
        closest = { name: st.name, dist }
      }
    }
    return closest
  }, [gpsCoords, stations])

  // Auto-fill location with nearest station if user hasn't typed anything
  useEffect(() => {
    if (nearestStation && !location) {
      setLocation(nearestStation.name)
    }
  }, [nearestStation]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || q.length < 2) return stations.slice(0, 15)
    return stations.filter((st) => st.name.toLowerCase().includes(q)).slice(0, 15)
  }, [search, stations])

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take photos.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    if (!location.trim() || !selectedType) {
      Alert.alert('Missing Info', 'Please select a location and incident type')
      return
    }

    // GPS is primary coordinate source; station coords are fallback
    const stationMatch = stations.find((st) => st.name === location.trim())
    const lat = gpsCoords?.latitude ?? stationMatch?.latitude
    const lng = gpsCoords?.longitude ?? stationMatch?.longitude

    const result = await submit(
      location.trim(),
      selectedType,
      lat,
      lng,
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

  const canSubmit = location.trim() && selectedType && !isSubmitting

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* GPS Status + Location Pill */}
        <View style={s.locationPillWrap}>
          {gpsStatus === 'loading' && (
            <View style={s.gpsBadge}>
              <ActivityIndicator size={12} color="#815100" />
              <Text style={s.gpsBadgeText}>Getting your location...</Text>
            </View>
          )}
          {gpsStatus === 'acquired' && (
            <View style={[s.gpsBadge, { backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)' }]}>
              <Navigation size={12} color="#22c55e" />
              <Text style={[s.gpsBadgeText, { color: '#16a34a' }]}>Using your live location</Text>
            </View>
          )}
          {(gpsStatus === 'denied' || gpsStatus === 'error') && (
            <View style={[s.gpsBadge, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' }]}>
              <MapPinOff size={12} color="#ef4444" />
              <Text style={[s.gpsBadgeText, { color: '#dc2626' }]}>Location unavailable — select below</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.locationPill}
            activeOpacity={0.7}
            onPress={() => setLocationModalVisible(true)}
          >
            <MapPin size={16} color="#815100" />
            <Text style={s.locationPillText} numberOfLines={1}>
              {location || 'Select location'}
            </Text>
            <ChevronDown size={16} color="#815100" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIconBox}>
            <AlertTriangle size={40} color="#b02500" />
          </View>
          <Text style={s.heroTitle}>What's happening?</Text>
          <Text style={s.heroSubtitle}>
            Help others navigate safely through the city.
          </Text>
        </View>

        {/* Incident Grid 3x2 */}
        <View style={s.grid}>
          {INCIDENT_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = selectedType === type.id
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.7}
                style={[
                  s.gridItem,
                  { width: gridSize, height: gridSize },
                  isSelected && s.gridItemSelected,
                ]}
              >
                <Icon
                  size={28}
                  color={type.id === 'accident' ? '#b02500' : '#815100'}
                />
                <Text style={s.gridLabel}>{type.label}</Text>
                {isSelected && (
                  <View style={s.gridCheck}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Camera Section */}
        {photoUri ? (
          <View style={s.cameraCard}>
            <Image
              source={{ uri: photoUri }}
              style={s.photoPreview}
              contentFit="cover"
            />
            <TouchableOpacity
              style={s.photoRemoveBtn}
              onPress={() => setPhotoUri(null)}
              activeOpacity={0.7}
            >
              <X size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.photoRetakeBtn}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <Camera size={14} color="#fff" />
              <Text style={s.photoRetakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.cameraCard} activeOpacity={0.8} onPress={takePhoto}>
            <View style={s.cameraInner}>
              <View style={s.cameraCircleOuter}>
                <View style={s.cameraCircleInner}>
                  <Camera size={32} color="#fff" />
                </View>
              </View>
              <Text style={s.cameraTitle}>TAP TO PHOTO</Text>
              <Text style={s.cameraBonus}>+20 XP BONUS</Text>
            </View>
          </TouchableOpacity>
        )}
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
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT INCIDENT'}
            </Text>
            <Send size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Location Picker Modal */}
      <Modal visible={locationModalVisible} transparent animationType="slide">
        <Pressable
          style={s.modalOverlay}
          onPress={() => setLocationModalVisible(false)}
        >
          <Pressable style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Location</Text>

            {/* Search */}
            <View style={s.searchBox}>
              <Search size={18} color="#815100" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search locations..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#b2acaa'}
                style={s.searchInput}
              />
            </View>

            <FlatList
              data={filteredStations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 320 }}
              renderItem={({ item: station }) => (
                <TouchableOpacity
                  onPress={() => {
                    setLocation(station.name)
                    setLocationModalVisible(false)
                    setSearch('')
                  }}
                  activeOpacity={0.7}
                  style={s.locRow}
                >
                  <View style={s.locDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.locName}>{station.name}</Text>
                    <Text style={s.locArea}>{station.location}</Text>
                  </View>
                  {location === station.name && (
                    <Check size={18} color="#815100" />
                  )}
                </TouchableOpacity>
              )}
            />

            {/* Custom location */}
            {search.trim() && !filteredStations.some((st: { name: string }) => st.name.toLowerCase() === search.trim().toLowerCase()) && (
              <TouchableOpacity
                onPress={() => {
                  setLocation(search.trim())
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
      paddingTop: 8,
    },

    // Location pill
    locationPillWrap: {
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 24,
      gap: 8,
    },
    gpsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(129,81,0,0.08)' : 'rgba(129,81,0,0.05)',
    },
    gpsBadgeText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: surfaceLow,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    locationPillText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
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
      backgroundColor: isDark ? 'rgba(176,37,0,0.12)' : 'rgba(176,37,0,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(176,37,0,0.15)' : 'rgba(176,37,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
    },

    // Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 24,
      gap: 16,
      marginBottom: 32,
    },
    gridItem: {
      borderRadius: 20,
      backgroundColor: surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    gridItemSelected: {
      borderWidth: 2,
      borderColor: '#815100',
      backgroundColor: isDark ? 'rgba(129,81,0,0.12)' : 'rgba(129,81,0,0.06)',
    },
    gridLabel: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: onSurface,
      textAlign: 'center',
      lineHeight: 16,
    },
    gridCheck: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Camera
    cameraCard: {
      marginHorizontal: 24,
      height: 220,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(129,81,0,0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(129,81,0,0.1)',
    },
    cameraInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraCircleOuter: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(129,81,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    cameraCircleInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(129,81,0,0.15)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(129,81,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: isDark ? 'rgba(255,255,255,0.7)' : '#815100',
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    cameraBonus: {
      fontSize: 11,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginTop: 6,
      letterSpacing: 1,
    },
    photoPreview: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
    },
    photoRemoveBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRetakeBtn: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    photoRetakeText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: '#fff',
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

    // Location modal
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
    locRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: outlineVariant,
    },
    locDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#b02500',
    },
    locName: {
      fontSize: 15,
      fontFamily: font.medium,
      color: onSurface,
    },
    locArea: {
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
