import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, Search, Timer, Users, X } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import { c, themed, font } from '@/lib/theme'
import { useStations } from '@/lib/hooks/useStations'
import { getStationCoords } from '@/lib/utils/station-coords'
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

// Display name: "37 Military Hospital" → "37 Station", others append "Station"
function stationLabel(name: string): string {
  if (name === '37 Military Hospital') return '37 Station'
  if (name.endsWith('Station')) return name
  return `${name} Station`
}

function getStationColor(station: StationWithQueue): string {
  const queueStatus = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  return queueStatus ? QUEUE_COLORS[queueStatus] : TROSKI_ORANGE
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
        {stationLabel(station.name)}
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

  // Resolve coordinates: use DB values or fallback to curated list
  const getCoords = useCallback((station: StationWithQueue) => {
    return getStationCoords(station)
  }, [])

  const filteredStations = useMemo(() => {
    if (!search) return stations
    const q = search.toLowerCase()
    return stations.filter((st) => st.name.toLowerCase().includes(q))
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

  // Build GeoJSON for native Mapbox rendering (no React Native views on map = no iOS crashes)
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stationsWithCoords.map((station) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [station._lng, station._lat],
      },
      properties: {
        id: station.id,
        name: station.name,
        label: stationLabel(station.name),
        isMajor: station.is_major ? 1 : 0,
        color: getStationColor(station),
      },
    })),
  }), [stationsWithCoords])

  // Handle tap on a station marker (native ShapeSource press)
  const handleShapePress = useCallback((event: any) => {
    const feature = event?.features?.[0]
    if (!feature?.properties?.id) return

    const stationId = feature.properties.id
    const station = stationsWithCoords.find((s) => s.id === stationId)
    if (!station) return

    setSelectedStation(station)
    cameraRef.current?.setCamera({
      centerCoordinate: [station._lng, station._lat],
      zoomLevel: 14,
      animationDuration: 500,
    })
  }, [stationsWithCoords])

  // Auto-zoom to fit filtered stations when search changes
  useEffect(() => {
    if (!stationsWithCoords.length) return

    if (stationsWithCoords.length === 1) {
      const st = stationsWithCoords[0]
      cameraRef.current?.setCamera({
        centerCoordinate: [st._lng, st._lat],
        zoomLevel: 15,
        animationDuration: 600,
      })
    } else if (search && stationsWithCoords.length <= 5) {
      const lats = stationsWithCoords.map((s) => s._lat)
      const lngs = stationsWithCoords.map((s) => s._lng)
      const ne: [number, number] = [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005]
      const sw: [number, number] = [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005]
      cameraRef.current?.fitBounds(ne, sw, 60, 600)
    } else if (!search) {
      cameraRef.current?.setCamera({
        centerCoordinate: [-0.187, 5.6037],
        zoomLevel: 12,
        animationDuration: 400,
      })
    }
  }, [stationsWithCoords, search])

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
            onPress={() => setSelectedStation(null)}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [-0.187, 5.6037],
                zoomLevel: 12,
              }}
            />

            {/* Native text labels — no RN views = no iOS crashes */}
            <Mapbox.ShapeSource
              id="stations"
              shape={geojson}
              onPress={handleShapePress}
            >
              <Mapbox.SymbolLayer
                id="stationLabels"
                style={{
                  textField: ['get', 'label'],
                  textSize: ['case', ['==', ['get', 'isMajor'], 1], 14, 12],
                  textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  textAnchor: 'center',
                  textColor: ['get', 'color'],
                  textHaloColor: '#ffffff',
                  textHaloWidth: 2,
                  textAllowOverlap: true,
                  textPadding: 4,
                }}
              />
            </Mapbox.ShapeSource>
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
