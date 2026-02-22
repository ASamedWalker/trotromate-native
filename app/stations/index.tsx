import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, Search, MapPin, Timer, Users, X } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import { c, themed, font } from '@/lib/theme'
import { useStations } from '@/lib/hooks/useStations'
import type { StationWithQueue } from '@/lib/services/stations'

// Public token for map rendering
Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

const TROSKI_ORANGE = '#e88a3a'

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const QUEUE_CONFIG: Record<QueueStatus, { label: string; estimate: string }> = {
  empty: { label: 'Empty', estimate: 'No wait' },
  short: { label: 'Short', estimate: '~5 min' },
  moderate: { label: 'Moderate', estimate: '~15 min' },
  long: { label: 'Long', estimate: '~30 min' },
  very_long: { label: 'Very Long', estimate: '45+ min' },
}

// Known station coordinates (fallback when DB has no lat/lng)
const STATION_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'Circle': { latitude: 5.5560, longitude: -0.2050 },
  'Madina': { latitude: 5.6720, longitude: -0.1700 },
  'Tema Station': { latitude: 5.6690, longitude: -0.0170 },
  'Kaneshie': { latitude: 5.5590, longitude: -0.2310 },
  'Lapaz': { latitude: 5.6080, longitude: -0.2460 },
  'Achimota': { latitude: 5.6140, longitude: -0.2190 },
  'Legon': { latitude: 5.6500, longitude: -0.1860 },
  'Kasoa': { latitude: 5.5340, longitude: -0.4180 },
  'Dansoman': { latitude: 5.5330, longitude: -0.2620 },
  'Spintex': { latitude: 5.6380, longitude: -0.0800 },
  'Nkrumah Circle': { latitude: 5.5560, longitude: -0.2050 },
  '37 Military Hospital': { latitude: 5.5870, longitude: -0.1870 },
  'Osu': { latitude: 5.5560, longitude: -0.1780 },
  'Airport City': { latitude: 5.5960, longitude: -0.1720 },
  'East Legon': { latitude: 5.6350, longitude: -0.1570 },
  'Teshie': { latitude: 5.5830, longitude: -0.1050 },
  'Nungua': { latitude: 5.5920, longitude: -0.0750 },
  'Ashaiman': { latitude: 5.6870, longitude: -0.0310 },
  'Adenta': { latitude: 5.7090, longitude: -0.1590 },
  'Dome': { latitude: 5.6520, longitude: -0.2310 },
}

/* ── Animated Pin ───────────────────────────────────── */

function StationPin({
  station,
  index,
  onPress,
}: {
  station: StationWithQueue
  index: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0.8)).current

  const queueStatus = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  const color = queueStatus ? QUEUE_COLORS[queueStatus] : TROSKI_ORANGE
  const isMajor = station.is_major
  const pinSize = isMajor ? 44 : 34

  useEffect(() => {
    // Staggered drop-in animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start()

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.8,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0.8, 1.8],
    outputRange: [0.5, 0],
  })

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View
        style={{
          width: pinSize,
          height: pinSize + 20,
          alignItems: 'center',
          transform: [{ scale: scaleAnim }],
        }}
      >
        {/* Pulse ring */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 4,
            width: pinSize * 0.7,
            height: pinSize * 0.7,
            borderRadius: pinSize * 0.35,
            borderWidth: 2.5,
            borderColor: color,
            opacity: pulseOpacity,
            transform: [{ scale: pulseAnim }],
            alignSelf: 'center',
          }}
        />
        {/* Pin body */}
        <View style={{
          width: pinSize,
          height: pinSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Teardrop shape using nested views */}
          <View style={{
            width: pinSize * 0.8,
            height: pinSize,
            alignItems: 'center',
          }}>
            {/* Top circle */}
            <View style={{
              width: pinSize * 0.8,
              height: pinSize * 0.8,
              borderRadius: pinSize * 0.4,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                },
                android: { elevation: 6 },
              }),
            }}>
              {/* Inner white circle */}
              <View style={{
                width: pinSize * 0.35,
                height: pinSize * 0.35,
                borderRadius: pinSize * 0.175,
                backgroundColor: '#fff',
                opacity: 0.95,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <View style={{
                  width: pinSize * 0.15,
                  height: pinSize * 0.15,
                  borderRadius: pinSize * 0.075,
                  backgroundColor: color,
                  opacity: 0.6,
                }} />
              </View>
            </View>
            {/* Point of teardrop */}
            <View style={{
              width: 0,
              height: 0,
              borderLeftWidth: pinSize * 0.2,
              borderRightWidth: pinSize * 0.2,
              borderTopWidth: pinSize * 0.35,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
              marginTop: -2,
            }} />
          </View>
        </View>
        {/* Station name label for major stations */}
        {isMajor && (
          <View style={{
            backgroundColor: color,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 4,
            marginTop: -2,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              },
              android: { elevation: 2 },
            }),
          }}>
            <Text style={{
              fontSize: 9,
              fontFamily: font.bold,
              color: '#fff',
              textAlign: 'center',
            }}>{station.name}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  )
}

/* ── Callout ────────────────────────────────────────── */

function StationCallout({ station }: { station: StationWithQueue }) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const queueStatus = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  const queueConfig = queueStatus ? QUEUE_CONFIG[queueStatus] : null
  const queueColor = queueStatus ? QUEUE_COLORS[queueStatus] : undefined
  const reportCount = station.queue_stats?.[0]?.report_count_last_hour ?? 0

  return (
    <View style={{
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 14,
      minWidth: 180,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
        },
        android: { elevation: 8 },
      }),
    }}>
      <Text style={{ fontSize: 15, fontFamily: font.bold, color: t.text }}>
        {station.name}
      </Text>
      <Text style={{ fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 }}>
        {station.location}
      </Text>
      {queueConfig && queueColor && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: queueColor,
          }} />
          <Text style={{ fontSize: 13, fontFamily: font.semibold, color: queueColor }}>
            {queueConfig.label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 }}>
            <Timer size={11} color={t.textSecondary} />
            <Text style={{ fontSize: 11, fontFamily: font.regular, color: t.textSecondary }}>
              {queueConfig.estimate}
            </Text>
          </View>
        </View>
      )}
      {station.is_major && (
        <Text style={{ fontSize: 10, fontFamily: font.medium, color: t.textTertiary, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Major Terminal
        </Text>
      )}
      {reportCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
          <Users size={11} color={t.textTertiary} />
          <Text style={{ fontSize: 11, fontFamily: font.regular, color: t.textTertiary }}>
            {reportCount} reports this hour
          </Text>
        </View>
      )}
    </View>
  )
}

/* ── Main Screen ────────────────────────────────────── */

export default function StationsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const { stations, isLoading } = useStations()
  const [search, setSearch] = useState('')
  const [selectedStation, setSelectedStation] = useState<StationWithQueue | null>(null)
  const cameraRef = useRef<Mapbox.Camera>(null)

  // Resolve coordinates: use DB values or fallback to known coords
  const getCoords = useCallback((station: StationWithQueue) => {
    if (station.latitude && station.longitude) {
      return { latitude: station.latitude, longitude: station.longitude }
    }
    return STATION_COORDINATES[station.name] || null
  }, [])

  const filteredStations = useMemo(() => {
    if (!search) return stations
    const s = search.toLowerCase()
    return stations.filter((st) => st.name.toLowerCase().includes(s))
  }, [stations, search])

  const stationsWithCoords = useMemo(() => {
    return filteredStations
      .map((st) => {
        const coords = getCoords(st)
        if (!coords) return null
        return { ...st, _lat: coords.latitude, _lng: coords.longitude }
      })
      .filter(Boolean) as (StationWithQueue & { _lat: number; _lng: number })[]
  }, [filteredStations, getCoords])

  const handleMarkerPress = useCallback((station: StationWithQueue & { _lat: number; _lng: number }) => {
    setSelectedStation(station)
    cameraRef.current?.setCamera({
      centerCoordinate: [station._lng, station._lat],
      zoomLevel: 14,
      animationDuration: 500,
    })
  }, [])

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerInner}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={s.backBtn}
          >
            <ChevronLeft size={20} color={t.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Station Queues</Text>
            <Text style={s.subtitle}>Live queue status across Accra</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Search size={18} color={c.stone400} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search stations..."
            placeholderTextColor={c.stone400}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={c.stone400} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Map */}
      <View style={s.mapContainer}>
        {isLoading ? (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={TROSKI_ORANGE} />
            <Text style={s.loadingText}>Loading stations...</Text>
          </View>
        ) : (
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL={Mapbox.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
            compassEnabled
            scaleBarEnabled={false}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [-0.187, 5.6037],
                zoomLevel: 12,
              }}
            />

            {stationsWithCoords.map((station, index) => (
              <Mapbox.MarkerView
                key={station.id}
                coordinate={[station._lng, station._lat]}
                anchor={{ x: 0.5, y: 1 }}
              >
                <StationPin
                  station={station}
                  index={index}
                  onPress={() => handleMarkerPress(station)}
                />
              </Mapbox.MarkerView>
            ))}
          </Mapbox.MapView>
        )}
      </View>

      {/* Selected station callout overlay */}
      {selectedStation && (
        <View style={s.calloutOverlay}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setSelectedStation(null)}
            style={s.calloutBackdrop}
          />
          <View style={s.calloutCard}>
            <StationCallout station={selectedStation} />
            <TouchableOpacity
              style={s.calloutClose}
              onPress={() => setSelectedStation(null)}
            >
              <X size={16} color={t.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

/* ── Styles ─────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      backgroundColor: t.card,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      zIndex: 10,
    },
    headerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontFamily: font.semibold,
      color: t.text,
    },
    subtitle: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      borderRadius: 14,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.regular,
      color: t.text,
      padding: 0,
    },
    mapContainer: {
      flex: 1,
    },
    loadingOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    calloutOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    calloutBackdrop: {
      position: 'absolute',
      top: -1000,
      left: 0,
      right: 0,
      bottom: 0,
    },
    calloutCard: {
      marginHorizontal: 20,
      marginBottom: 40,
    },
    calloutClose: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
