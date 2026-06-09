import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  X, MapPin, ChevronRight, Navigation,
  Clock, CircleDot, ArrowUpDown,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import * as Haptics from 'expo-haptics'
import { useRoutePlanner } from '@/lib/hooks/useRoutePlanner'
import { RoutePlannerResults, type WalkingEstimate } from '@/components/RoutePlannerResults'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { useLocation } from '@/lib/hooks/useLocation'

const BRAND = '#FF4D1C'

/* ── Services ── */

const SERVICES = [
  { id: 'bus', label: 'Bus', image: require('@/assets/images/home/bus_icon_bg_removed.png'), mode: 'trotro' as const },
  { id: 'okada', label: 'Okada', image: require('@/assets/images/home/okada_icon_bg_removed.png'), mode: 'okada' as const },
  { id: 'train', label: 'Train', image: require('@/assets/images/home/train_bg_removed.png'), mode: 'train' as const },
  { id: 'pragya', label: 'Pragya', image: require('@/assets/images/home/Pragya_icon_bg_removed.png'), mode: 'pragya' as const },
  { id: 'courier', label: 'Courier', image: require('@/assets/images/home/van_bg_removed.png'), mode: 'all' as const },
]

/* ── Build deduplicated station list from real data ── */

function buildStationList(): { name: string; lat: number; lon: number }[] {
  const seen = new Map<string, { lat: number; lon: number }>()
  for (const [name, coords] of Object.entries(FALLBACK_STATION_COORDS)) {
    const key = `${coords.latitude.toFixed(3)}_${coords.longitude.toFixed(3)}`
    if (!seen.has(key)) {
      seen.set(key, { lat: coords.latitude, lon: coords.longitude })
      // Use the shortest name for each unique location (avoids aliases)
      const existing = [...seen.entries()].find(([k]) => k === key)
      if (existing) {
        const currentName = [...Object.entries(FALLBACK_STATION_COORDS)]
          .find(([, c]) => `${c.latitude.toFixed(3)}_${c.longitude.toFixed(3)}` === key)?.[0]
        if (currentName && currentName.length < name.length) continue
      }
    }
  }

  // Simpler approach: just take unique primary names (no "Station", "Terminal" suffixes when base exists)
  const primaryStations: { name: string; lat: number; lon: number }[] = []
  const addedCoords = new Set<string>()

  for (const [name, coords] of Object.entries(FALLBACK_STATION_COORDS)) {
    const coordKey = `${coords.latitude.toFixed(3)}_${coords.longitude.toFixed(3)}`
    if (addedCoords.has(coordKey)) continue
    addedCoords.add(coordKey)
    primaryStations.push({ name, lat: coords.latitude, lon: coords.longitude })
  }

  return primaryStations
}

const ALL_STATIONS = buildStationList()

// Station coords for route planner
const STATION_COORDS: Record<string, { lat: number; lon: number }> =
  Object.fromEntries(
    Object.entries(FALLBACK_STATION_COORDS).map(([name, c]) => [
      name, { lat: c.latitude, lon: c.longitude },
    ])
  )

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

type TransportMode = 'all' | 'trotro' | 'okada' | 'pragya' | 'train' | 'walk'

/* ── Component ── */

export default function PlanTripScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    from?: string; to?: string
    picked_target?: 'from' | 'to'; picked_label?: string
  }>()

  const fromRef = useRef<TextInput>(null)
  const toRef = useRef<TextInput>(null)
  const { location } = useLocation()

  const [from, setFrom] = useState(params.from || '')
  const [to, setTo] = useState(params.to || '')
  const [activeInput, setActiveInput] = useState<'from' | 'to'>('from')
  const [selectedService, setSelectedService] = useState<string>('bus')
  // Default mode matches the default 'bus' pill so results are filtered to it
  // from the start (was 'all', which left the Bus pill highlighted but unfiltered).
  const [transportMode, setTransportMode] = useState<TransportMode>('trotro')

  // Route search
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null)

  const transportTypeParam = transportMode === 'all' || transportMode === 'walk' ? undefined : transportMode
  const { plans, isLoading } = useRoutePlanner(searchFrom, searchTo, transportTypeParam)

  // Handle pick-location return
  useEffect(() => {
    if (!params.picked_target || !params.picked_label) return
    if (params.picked_target === 'from') setFrom(params.picked_label)
    else setTo(params.picked_label)
    router.setParams({ picked_target: undefined, picked_label: undefined })
  }, [params.picked_target, params.picked_label])

  // Auto-search when both fields filled — 1.2s debounce
  const canSearch = from.trim().length > 1 && to.trim().length > 1
  useEffect(() => {
    if (canSearch && !hasSearched) {
      const t = setTimeout(() => {
        setSearchFrom(from.trim())
        setSearchTo(to.trim())
        setHasSearched(true)
        setSelectedPlanIndex(null)
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [from, to, canSearch])

  useEffect(() => { setHasSearched(false) }, [from, to])
  useEffect(() => { if (plans.length > 0 && selectedPlanIndex === null) setSelectedPlanIndex(0) }, [plans])

  // Auto-focus from input on mount
  useEffect(() => {
    const t = setTimeout(() => fromRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  const walkingEstimate = useMemo<WalkingEstimate | null>(() => {
    const f = from.trim(), t2 = to.trim()
    if (!f || !t2) return null
    const fc = STATION_COORDS[f], tc = STATION_COORDS[t2]
    if (!fc || !tc) return null
    const dist = haversineKm(fc.lat, fc.lon, tc.lat, tc.lon)
    if (dist > 10) return null
    return { distance_km: dist, duration_mins: Math.round(dist / 5 * 60), from: f, to: t2 }
  }, [from, to])

  // Debounced query — wait 400ms after user stops typing
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const activeQuery = activeInput === 'from' ? from : to

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(activeQuery), 400)
    return () => clearTimeout(t)
  }, [activeQuery])

  // Smart suggestions — sorted by distance from user
  const suggestions = useMemo(() => {
    let filtered = ALL_STATIONS

    if (debouncedQuery.length > 0) {
      const q = debouncedQuery.toLowerCase()
      filtered = ALL_STATIONS.filter(s => s.name.toLowerCase().includes(q))
    }

    if (location) {
      filtered = [...filtered].sort((a, b) => {
        const distA = haversineKm(location.latitude, location.longitude, a.lat, a.lon)
        const distB = haversineKm(location.latitude, location.longitude, b.lat, b.lon)
        return distA - distB
      })
    }

    return filtered.slice(0, 15).map(s => ({
      ...s,
      distance: location ? formatDistance(haversineKm(location.latitude, location.longitude, s.lat, s.lon)) : undefined,
    }))
  }, [activeInput, from, to, location])

  const selectStation = useCallback((station: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (activeInput === 'from') {
      setFrom(station)
      setActiveInput('to')
      toRef.current?.focus()
    } else {
      setTo(station)
    }
  }, [activeInput])

  const selectService = (id: string, mode: TransportMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedService(id)
    setTransportMode(mode === 'all' ? 'all' : mode)
    // Don't reset hasSearched — useRoutePlanner re-queries on the new mode
    // (it's in the query key), so results update in place. Clearing hasSearched
    // hid the results with nothing to bring them back (pill change doesn't
    // re-trigger the from/to auto-search effect).
    setSelectedPlanIndex(null)
  }

  const showingResults = hasSearched && canSearch

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 28, color: '#000', letterSpacing: -0.8 }}>
              Plan a Trip
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}
            >
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Service Pills ── */}
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
          >
            {SERVICES.map((svc) => {
              const isActive = selectedService === svc.id
              return (
                <TouchableOpacity
                  key={svc.id}
                  onPress={() => selectService(svc.id, svc.mode)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 100,
                    backgroundColor: isActive ? '#FFF0EB' : '#F3F4F6',
                    borderWidth: isActive ? 1.5 : 0,
                    borderColor: isActive ? BRAND : 'transparent',
                  }}
                >
                  <Image source={svc.image} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: isActive ? BRAND : '#6B7280' }}>{svc.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* ── From / To connected input (Your Trip style) ── */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', overflow: 'hidden' }}>
            {/* From */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 54,
              backgroundColor: activeInput === 'from' ? '#F9FAFB' : 'transparent',
            }}>
              <MapPin size={18} color="#10B981" style={{ marginRight: 10 }} />
              <TextInput
                ref={fromRef}
                placeholder="From where?"
                placeholderTextColor="#9CA3AF"
                value={from}
                onChangeText={setFrom}
                onFocus={() => setActiveInput('from')}
                style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: '#000', padding: 0 }}
                returnKeyType="next"
                onSubmitEditing={() => toRef.current?.focus()}
              />
              {from.length > 0 && (
                <TouchableOpacity onPress={() => setFrom('')} hitSlop={8}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Divider + swap */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#F0F0F0' }} />
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); const f = from; setFrom(to); setTo(f) }}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 }}
                hitSlop={6}
              >
                <ArrowUpDown size={15} color="#374151" strokeWidth={2.5} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 1, backgroundColor: '#F0F0F0' }} />
            </View>

            {/* To */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 54,
              backgroundColor: activeInput === 'to' ? '#F9FAFB' : 'transparent',
            }}>
              <CircleDot size={18} color="#EF4444" style={{ marginRight: 10 }} />
              <TextInput
                ref={toRef}
                placeholder="To where?"
                placeholderTextColor="#9CA3AF"
                value={to}
                onChangeText={setTo}
                onFocus={() => setActiveInput('to')}
                style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: '#000', padding: 0 }}
                returnKeyType="done"
              />
              {to.length > 0 && (
                <TouchableOpacity onPress={() => setTo('')} hitSlop={8}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Pickup pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: 14 }}
          >
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fromRef.current?.focus(); setActiveInput('from') }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 100, backgroundColor: '#F3F4F6',
              }}
            >
              <MapPin size={14} color="#6B7280" />
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#374151' }}>Edit pickup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 100, backgroundColor: '#F3F4F6',
              }}
            >
              <Clock size={14} color="#6B7280" />
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#374151' }}>Leave now</Text>
              <ChevronRight size={12} color="#9CA3AF" style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Smart Suggestions (real stations) ── */}
          {!showingResults && (
            <View style={{ paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#9CA3AF', marginBottom: 10 }}>
                {(activeInput === 'from' ? from : to).length > 0 ? 'Results' : 'Nearby stations'}
              </Text>
              {suggestions.map((station, i) => (
                <TouchableOpacity
                  key={`${station.name}-${i}`}
                  onPress={() => selectStation(station.name)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14,
                    borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: '#FFF0EB',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <MapPin size={18} color={BRAND} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000' }}>{station.name}</Text>
                  </View>
                  {station.distance && (
                    <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#D1D5DB' }}>{station.distance}</Text>
                  )}
                </TouchableOpacity>
              ))}

              {suggestions.length === 0 && (activeInput === 'from' ? from : to).length > 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 16, color: '#9CA3AF' }}>
                    No stations found
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Route Results ── */}
          {showingResults && (
            <RoutePlannerResults
              plans={transportMode === 'walk' ? [] : plans}
              isLoading={transportMode !== 'walk' && isLoading}
              walkingEstimate={transportMode === 'all' || transportMode === 'walk' ? walkingEstimate : null}
              selectedPlanIndex={selectedPlanIndex}
              onSelectPlan={(index) => {
                setSelectedPlanIndex(index)
                const plan = plans[index]
                if (!plan) return
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                router.push({
                  pathname: '/routes/detail',
                  params: {
                    from: plan.legs[0]?.from || from,
                    to: plan.legs[plan.legs.length - 1]?.to || to,
                    fare: String(plan.total_fare),
                    duration: String(plan.total_duration_mins),
                    transport_type: plan.legs[0]?.transport_type || 'trotro',
                    route_id: plan.legs[0]?.route_id || '',
                    type: plan.type,
                  },
                } as any)
              }}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
