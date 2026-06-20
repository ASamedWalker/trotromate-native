import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, MapPin, Navigation, Check } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { c, themed, font } from '@/lib/theme'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'

// Public Mapbox token — same one used in app/_layout.tsx
const MAPBOX_TOKEN =
  'pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg'

// Accra center — fallback when no GPS available
const ACCRA_CENTER: [number, number] = [-0.186964, 5.603717]

// Snap radius — if center is within this many meters of a known station,
// prefer the station name over Mapbox reverse geocode
const STATION_SNAP_METERS = 300

type PickTarget = 'from' | 'to'

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function findNearestStation(
  lat: number,
  lng: number
): { name: string; meters: number } | null {
  let best: { name: string; meters: number } | null = null
  for (const [name, coords] of Object.entries(FALLBACK_STATION_COORDS)) {
    const d = distanceMeters(lat, lng, coords.latitude, coords.longitude)
    if (!best || d < best.meters) {
      best = { name, meters: d }
    }
  }
  if (best && best.meters <= STATION_SNAP_METERS) return best
  return null
}

export default function PickLocationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ target?: PickTarget }>()
  const target: PickTarget = params.target === 'to' ? 'to' : 'from'
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])

  const cameraRef = useRef<Mapbox.Camera>(null)
  const requestIdRef = useRef(0)

  const [placeLabel, setPlaceLabel] = useState<string>('Move the map to pick a spot')
  const [currentCoord, setCurrentCoord] = useState<[number, number] | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [initialCenter, setInitialCenter] = useState<[number, number]>(ACCRA_CENTER)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Try to center on user's current location on mount
  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync()
        if (status !== 'granted') {
          setHasInitialized(true)
          return
        }
        const loc = await Location.getLastKnownPositionAsync({})
        if (loc) {
          setInitialCenter([loc.coords.longitude, loc.coords.latitude])
        }
      } catch {
        // Fall through to Accra center
      } finally {
        setHasInitialized(true)
      }
    })()
  }, [])

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    const rid = ++requestIdRef.current
    setIsGeocoding(true)

    // First: try snapping to a known Troski station
    const snap = findNearestStation(lat, lng)
    if (snap) {
      if (rid === requestIdRef.current) {
        setPlaceLabel(`Near ${snap.name}`)
        setIsGeocoding(false)
      }
      return
    }

    // Otherwise: Mapbox Geocoding v6 reverse lookup
    try {
      const url =
        `https://api.mapbox.com/search/geocode/v6/reverse` +
        `?longitude=${lng}&latitude=${lat}` +
        `&access_token=${MAPBOX_TOKEN}&limit=1&language=en`
      const res = await fetch(url)
      const data = await res.json()
      if (rid !== requestIdRef.current) return // stale response
      const feature = data?.features?.[0]
      const label =
        feature?.properties?.place_formatted ||
        feature?.properties?.full_address ||
        feature?.properties?.name ||
        'Unknown area'
      setPlaceLabel(label)
    } catch {
      if (rid === requestIdRef.current) {
        setPlaceLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    } finally {
      if (rid === requestIdRef.current) setIsGeocoding(false)
    }
  }, [])

  const handleMapIdle = useCallback(
    (state: Mapbox.MapState) => {
      const center = state.properties.center
      const lng = center[0]
      const lat = center[1]
      if (typeof lng !== 'number' || typeof lat !== 'number') return
      setCurrentCoord([lng, lat])
      reverseGeocode(lng, lat)
    },
    [reverseGeocode]
  )

  const recenterToUser = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync()
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      let perm = status
      if (perm !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync()
        perm = req.status
      }
      if (perm !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      cameraRef.current?.setCamera({
        centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
        zoomLevel: 15,
        animationDuration: 600,
      })
    } catch {
      // Silent
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (!currentCoord) return
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    const [lng, lat] = currentCoord
    router.replace({
      pathname: '/routes/search',
      params: {
        picked_target: target,
        picked_label: placeLabel.replace(/^Near /, ''),
        picked_lat: String(lat),
        picked_lng: String(lng),
      },
    })
  }, [currentCoord, placeLabel, router, target])

  if (!hasInitialized) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={s.container}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
        compassEnabled={false}
        logoEnabled={false}
        attributionPosition={{ bottom: 96, right: 8 }}
        onMapIdle={handleMapIdle}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 14,
          }}
        />
        <Mapbox.UserLocation visible={true} />
      </Mapbox.MapView>

      {/* Fixed center crosshair — sits above the map, does not move */}
      <View pointerEvents="none" style={s.crosshairWrap}>
        <View style={s.pinShadow} />
        <MapPin size={44} color={c.amber500} fill={c.amber500} strokeWidth={1.5} />
      </View>

      {/* Header with back button */}
      <SafeAreaView style={s.headerSafe} pointerEvents="box-none">
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={s.backBtn}
          >
            <ArrowLeft size={20} color={t.text} />
          </TouchableOpacity>
          <View style={s.titlePill}>
            <Text style={s.titleText}>
              Pick {target === 'from' ? 'start' : 'destination'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Current location button (floating, above the confirm card) */}
      <TouchableOpacity
        onPress={recenterToUser}
        activeOpacity={0.8}
        style={s.locateBtn}
      >
        <Navigation size={20} color={c.amber500} />
      </TouchableOpacity>

      {/* Bottom floating card with place label + confirm button */}
      <SafeAreaView edges={['bottom']} style={s.bottomSafe} pointerEvents="box-none">
        <View style={s.bottomCard}>
          <View style={s.labelRow}>
            <MapPin size={16} color={c.amber500} />
            <Text style={s.labelText} numberOfLines={2}>
              {isGeocoding ? 'Finding location…' : placeLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!currentCoord || isGeocoding}
            activeOpacity={0.85}
            style={[
              s.confirmBtn,
              (!currentCoord || isGeocoding) && s.confirmBtnDisabled,
            ]}
          >
            <Check size={18} color="#fff" strokeWidth={2.75} />
            <Text style={s.confirmText}>
              Set as {target === 'from' ? 'start' : 'destination'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    headerSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(28,25,23,0.92)' : 'rgba(255,255,255,0.96)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
    titlePill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(28,25,23,0.92)' : 'rgba(255,255,255,0.96)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
    titleText: { fontSize: 14, fontFamily: font.bold, color: t.text },

    crosshairWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      // Nudge pin up a bit so the tip (not the body) marks the exact center
      marginTop: -22,
    },
    pinShadow: {
      position: 'absolute',
      bottom: -8,
      width: 10,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    locateBtn: {
      position: 'absolute',
      right: 16,
      bottom: 180,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(28,25,23,0.96)' : '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },

    bottomSafe: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    bottomCard: {
      margin: 16,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(28,25,23,0.96)' : '#fff',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
    },
    labelText: { flex: 1, fontSize: 14, fontFamily: font.semibold, color: t.text },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.amber500,
      paddingVertical: 14,
      borderRadius: 14,
    },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmText: { color: '#fff', fontSize: 14, fontFamily: font.bold, letterSpacing: 0.2 },
  })
}
