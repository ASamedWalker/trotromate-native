import { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ArrowUpDown,
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
  Bus,
  Bike,
  Footprints,
  LayoutGrid,
  X,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useRoutePlanner } from '@/lib/hooks/useRoutePlanner'
import { RoutePlannerResults, type WalkingEstimate } from '@/components/RoutePlannerResults'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import * as Haptics from 'expo-haptics'

const BRAND = '#FF4D1C'

// Lazy-load map
const RoutePlanMap = lazy(() =>
  import('@/components/RoutePlanMap').then(mod => ({ default: mod.RoutePlanMap }))
)

const POPULAR_STATIONS = [
  'Circle', 'Madina', 'Tema', 'Kaneshie', 'Lapaz',
  'Achimota', 'Legon', 'Kasoa', 'Dansoman', 'Spintex',
  'Nima', 'Osu', 'Labadi', 'Teshie', 'Ashaiman',
]

type TransportMode = 'all' | 'trotro' | 'okada' | 'walk'

const MODE_TABS: { mode: TransportMode; icon: typeof Bus; label: string }[] = [
  { mode: 'all', icon: LayoutGrid, label: 'Best' },
  { mode: 'trotro', icon: Bus, label: 'Trotro' },
  { mode: 'okada', icon: Bike, label: 'Okada' },
  { mode: 'walk', icon: Footprints, label: 'Walk' },
]

// Build station coords
export const STATION_COORDS: Record<string, { lat: number; lon: number }> =
  Object.fromEntries(
    Object.entries(FALLBACK_STATION_COORDS).map(([name, c]) => [
      name,
      { lat: c.latitude, lon: c.longitude },
    ])
  )

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function RoutePlannerScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    from?: string
    to?: string
    picked_target?: 'from' | 'to'
    picked_label?: string
    picked_lat?: string
    picked_lng?: string
  }>()

  const [from, setFrom] = useState(params.from || '')
  const [to, setTo] = useState(params.to || '')
  const [searchFrom, setSearchFrom] = useState(params.from || '')
  const [searchTo, setSearchTo] = useState(params.to || '')
  const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null)
  const [hasSearched, setHasSearched] = useState(!!params.from && !!params.to)
  const [transportMode, setTransportMode] = useState<TransportMode>('all')
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null)

  // Handle returned location from pick-location
  useEffect(() => {
    if (!params.picked_target || !params.picked_label) return
    if (params.picked_target === 'from') setFrom(params.picked_label)
    else setTo(params.picked_label)
    setHasSearched(false)
    router.setParams({
      picked_target: undefined, picked_label: undefined,
      picked_lat: undefined, picked_lng: undefined,
    })
  }, [params.picked_target, params.picked_label, params.picked_lat, params.picked_lng, router])

  // Auto-search when both fields pre-filled from search screen
  useEffect(() => {
    if (params.from && params.to && !hasSearched) {
      setSearchFrom(params.from)
      setSearchTo(params.to)
      setHasSearched(true)
    }
  }, [])

  const toRef = useRef<TextInput>(null)
  const transportTypeParam = transportMode === 'all' || transportMode === 'walk' ? undefined : transportMode
  const { plans, isLoading } = useRoutePlanner(searchFrom, searchTo, transportTypeParam)

  useEffect(() => {
    if (plans.length > 0 && selectedPlanIndex === null) setSelectedPlanIndex(0)
  }, [plans])

  const walkingEstimate = useMemo<WalkingEstimate | null>(() => {
    const f = from.trim()
    const t2 = to.trim()
    if (!f || !t2) return null
    const fc = STATION_COORDS[f]
    const tc = STATION_COORDS[t2]
    if (!fc || !tc) return null
    const dist = haversineKm(fc.lat, fc.lon, tc.lat, tc.lon)
    if (dist > 10) return null
    return { distance_km: dist, duration_mins: Math.round(dist / 5 * 60), from: f, to: t2 }
  }, [from, to])

  const filteredStations = POPULAR_STATIONS.filter((station) => {
    const query = activeInput === 'from' ? from : to
    if (!query) return true
    return station.toLowerCase().includes(query.toLowerCase())
  })

  function handleSearch() {
    if (!from.trim() || !to.trim()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSearchFrom(from.trim())
    setSearchTo(to.trim())
    setHasSearched(true)
    setActiveInput(null)
    setSelectedPlanIndex(null)
  }

  function swapLocations() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFrom(to); setTo(from)
    setSearchFrom(''); setSearchTo('')
    setHasSearched(false); setSelectedPlanIndex(null)
  }

  function selectStation(station: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (activeInput === 'from') {
      setFrom(station); setActiveInput('to'); toRef.current?.focus()
    } else {
      setTo(station); setActiveInput(null)
    }
  }

  const canSearch = from.trim() && to.trim()

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
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── From/To Inputs ── */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {/* Timeline dots */}
            <View style={{ alignItems: 'center', paddingTop: 18 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: BRAND }} />
              <View style={{ width: 2, flex: 1, backgroundColor: 'rgba(255,77,28,0.2)', marginVertical: 4 }} />
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e' }} />
            </View>

            {/* Inputs */}
            <View style={{ flex: 1, gap: 10 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#FFFFFF', borderRadius: 12,
                paddingHorizontal: 14, height: 48,
                borderWidth: activeInput === 'from' ? 2 : 1,
                borderColor: activeInput === 'from' ? BRAND : '#E5E7EB',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              }}>
                <MapPin size={16} color={BRAND} />
                <TextInput
                  placeholder="From where?"
                  placeholderTextColor="#9CA3AF"
                  value={from}
                  onChangeText={(v) => { setFrom(v); setHasSearched(false) }}
                  onFocus={() => setActiveInput('from')}
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: '#000', padding: 0 }}
                  returnKeyType="next"
                  onSubmitEditing={() => toRef.current?.focus()}
                />
                <TouchableOpacity
                  onPress={() => router.push('/routes/pick-location?target=from')}
                  hitSlop={10}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF0EB', justifyContent: 'center', alignItems: 'center' }}
                >
                  <MapIcon size={14} color={BRAND} />
                </TouchableOpacity>
              </View>

              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#FFFFFF', borderRadius: 12,
                paddingHorizontal: 14, height: 48,
                borderWidth: activeInput === 'to' ? 2 : 1,
                borderColor: activeInput === 'to' ? '#22c55e' : '#E5E7EB',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              }}>
                <Navigation size={16} color="#22c55e" />
                <TextInput
                  ref={toRef}
                  placeholder="To where?"
                  placeholderTextColor="#9CA3AF"
                  value={to}
                  onChangeText={(v) => { setTo(v); setHasSearched(false) }}
                  onFocus={() => setActiveInput('to')}
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: '#000', padding: 0 }}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  onPress={() => router.push('/routes/pick-location?target=to')}
                  hitSlop={10}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}
                >
                  <MapIcon size={14} color="#22c55e" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Swap button */}
            <TouchableOpacity
              onPress={swapLocations}
              activeOpacity={0.7}
              style={{
                alignSelf: 'center',
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <ArrowUpDown size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Find Routes button */}
          <TouchableOpacity
            onPress={handleSearch}
            disabled={!canSearch || isLoading}
            activeOpacity={0.85}
            style={{ marginTop: 14 }}
          >
            <View style={{
              height: 48, borderRadius: 12,
              backgroundColor: canSearch ? BRAND : '#E5E7EB',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Search size={18} color={canSearch ? '#fff' : '#9CA3AF'} />
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: canSearch ? '#fff' : '#9CA3AF' }}>
                Find Routes
              </Text>
            </View>
          </TouchableOpacity>

          {/* Transport mode tabs */}
          {hasSearched && !activeInput && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 14 }}>
              {MODE_TABS.map(({ mode, icon: Icon, label }) => {
                const isActive = transportMode === mode
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTransportMode(mode) }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 16, paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: isActive ? (mode === 'walk' ? '#ECFDF5' : '#FFF0EB') : '#F3F4F6',
                      borderWidth: isActive ? 1.5 : 0,
                      borderColor: isActive ? (mode === 'walk' ? '#22c55e' : BRAND) : 'transparent',
                    }}
                  >
                    <Icon size={16} color={isActive ? (mode === 'walk' ? '#22c55e' : BRAND) : '#9CA3AF'} />
                    <Text style={{
                      fontFamily: font.bold, fontSize: 14,
                      color: isActive ? (mode === 'walk' ? '#22c55e' : BRAND) : '#9CA3AF',
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Station suggestions */}
          {activeInput && (
            <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#9CA3AF', marginBottom: 12 }}>Popular stations</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {filteredStations.map((station) => (
                  <TouchableOpacity
                    key={station}
                    onPress={() => selectStation(station)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 100,
                      backgroundColor: '#F3F4F6',
                      borderWidth: 1, borderColor: '#E5E7EB',
                    }}
                  >
                    <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#000' }}>{station}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Route Map */}
          {hasSearched && !activeInput && (
            <Suspense fallback={<View style={{ height: 50 }} />}>
              <RoutePlanMap
                plans={transportMode === 'walk' ? [] : plans}
                selectedPlanIndex={selectedPlanIndex}
                from={from}
                to={to}
                stationCoords={STATION_COORDS}
              />
            </Suspense>
          )}

          {/* Results */}
          {hasSearched && !activeInput && (
            <RoutePlannerResults
              plans={transportMode === 'walk' ? [] : plans}
              isLoading={transportMode !== 'walk' && isLoading}
              walkingEstimate={transportMode === 'all' || transportMode === 'walk' ? walkingEstimate : null}
              selectedPlanIndex={selectedPlanIndex}
              onSelectPlan={setSelectedPlanIndex}
            />
          )}

          {/* Empty state */}
          {!hasSearched && !activeInput && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: '#FFF0EB',
                justifyContent: 'center', alignItems: 'center',
                marginBottom: 16,
              }}>
                <Navigation size={32} color={BRAND} />
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#000', marginBottom: 8 }}>Plan your journey</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 16, color: '#9CA3AF', textAlign: 'center', lineHeight: 24 }}>
                Enter your start and end points to find the best route, including transfers
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
