import { useState, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ArrowLeft,
  ArrowUpDown,
  MapPin,
  Navigation,
  Search,
  Bus,
  Bike,
  Footprints,
  LayoutGrid,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useRoutePlanner } from '@/lib/hooks/useRoutePlanner'
import { RoutePlannerResults, type WalkingEstimate } from '@/components/RoutePlannerResults'

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

const MODE_COLORS: Record<TransportMode, { active: string; bg: string }> = {
  all: { active: c.amber600, bg: 'rgba(245,158,11,0.12)' },
  trotro: { active: c.amber600, bg: 'rgba(245,158,11,0.12)' },
  okada: { active: c.orange500, bg: 'rgba(249,115,22,0.12)' },
  walk: { active: '#16a34a', bg: 'rgba(34,197,94,0.12)' },
}

// Station coordinates for walking estimate
const STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  Circle: { lat: 5.5714, lon: -0.2096 },
  Madina: { lat: 5.6769, lon: -0.1648 },
  Tema: { lat: 5.6698, lon: -0.0166 },
  Kaneshie: { lat: 5.5609, lon: -0.2347 },
  Lapaz: { lat: 5.6055, lon: -0.2464 },
  Achimota: { lat: 5.6133, lon: -0.2271 },
  Legon: { lat: 5.6500, lon: -0.1869 },
  Kasoa: { lat: 5.5345, lon: -0.4164 },
  Dansoman: { lat: 5.5286, lon: -0.2575 },
  Spintex: { lat: 5.6357, lon: -0.1144 },
}

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
  const params = useLocalSearchParams<{ from?: string; to?: string }>()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const [from, setFrom] = useState(params.from || '')
  const [to, setTo] = useState(params.to || '')
  const [searchFrom, setSearchFrom] = useState(params.from || '')
  const [searchTo, setSearchTo] = useState(params.to || '')
  const [activeInput, setActiveInput] = useState<'from' | 'to' | null>(null)
  const [hasSearched, setHasSearched] = useState(!!params.from && !!params.to)
  const [transportMode, setTransportMode] = useState<TransportMode>('all')

  const toRef = useRef<TextInput>(null)
  const transportTypeParam = transportMode === 'all' || transportMode === 'walk' ? undefined : transportMode
  const { plans, isLoading } = useRoutePlanner(searchFrom, searchTo, transportTypeParam)

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
    setSearchFrom(from.trim())
    setSearchTo(to.trim())
    setHasSearched(true)
    setActiveInput(null)
  }

  function swapLocations() {
    setFrom(to)
    setTo(from)
    setSearchFrom('')
    setSearchTo('')
    setHasSearched(false)
  }

  function selectStation(station: string) {
    if (activeInput === 'from') {
      setFrom(station)
      setActiveInput('to')
      toRef.current?.focus()
    } else {
      setTo(station)
      setActiveInput(null)
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={s.backBtn}
          >
            <ArrowLeft size={18} color={t.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Plan a Trip</Text>
        </View>

        {/* From/To Inputs */}
        <View style={s.inputSection}>
          <View style={s.inputRow}>
            <View style={s.timelineCol}>
              <View style={[s.dot, { backgroundColor: c.amber500 }]} />
              <View style={s.line} />
              <View style={[s.dot, { backgroundColor: '#22c55e' }]} />
            </View>
            <View style={s.inputsCol}>
              <View style={s.inputWrapper}>
                <MapPin size={14} color={c.amber500} />
                <TextInput
                  placeholder="From where?"
                  placeholderTextColor={t.textSecondary}
                  value={from}
                  onChangeText={(v) => { setFrom(v); setHasSearched(false) }}
                  onFocus={() => setActiveInput('from')}
                  style={s.input}
                  returnKeyType="next"
                  onSubmitEditing={() => toRef.current?.focus()}
                />
              </View>
              <View style={s.inputWrapper}>
                <Navigation size={14} color="#22c55e" />
                <TextInput
                  ref={toRef}
                  placeholder="To where?"
                  placeholderTextColor={t.textSecondary}
                  value={to}
                  onChangeText={(v) => { setTo(v); setHasSearched(false) }}
                  onFocus={() => setActiveInput('to')}
                  style={s.input}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={swapLocations}
              activeOpacity={0.7}
              style={s.swapBtn}
            >
              <ArrowUpDown size={14} color={t.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            onPress={handleSearch}
            disabled={!from.trim() || !to.trim() || isLoading}
            activeOpacity={0.8}
            style={[
              s.searchBtn,
              from.trim() && to.trim() ? s.searchBtnActive : s.searchBtnDisabled,
            ]}
          >
            <Search size={16} color={from.trim() && to.trim() ? '#fff' : t.textSecondary} />
            <Text style={[
              s.searchBtnText,
              from.trim() && to.trim() ? s.searchBtnTextActive : s.searchBtnTextDisabled,
            ]}>
              Find Routes
            </Text>
          </TouchableOpacity>

          {/* Transport Mode Tabs */}
          {hasSearched && !activeInput && (
            <View style={s.modeTabs}>
              {MODE_TABS.map(({ mode, icon: Icon, label }) => {
                const isActive = transportMode === mode
                const colors = MODE_COLORS[mode]
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setTransportMode(mode)}
                    activeOpacity={0.7}
                    style={[
                      s.modeTab,
                      { backgroundColor: isActive ? colors.bg : (isDark ? c.stone800 : c.stone100) },
                    ]}
                  >
                    <Icon size={14} color={isActive ? colors.active : t.textSecondary} />
                    <Text style={[
                      s.modeTabText,
                      { color: isActive ? colors.active : t.textSecondary },
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Station Suggestions */}
          {activeInput && (
            <View style={s.suggestions}>
              <Text style={s.suggestionsLabel}>Popular stations</Text>
              <View style={s.stationChips}>
                {filteredStations.map((station) => (
                  <TouchableOpacity
                    key={station}
                    onPress={() => selectStation(station)}
                    activeOpacity={0.7}
                    style={s.stationChip}
                  >
                    <Text style={s.stationChipText}>{station}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Results */}
          {hasSearched && !activeInput && (
            <RoutePlannerResults
              plans={transportMode === 'walk' ? [] : plans}
              isLoading={transportMode !== 'walk' && isLoading}
              walkingEstimate={transportMode === 'all' || transportMode === 'walk' ? walkingEstimate : null}
            />
          )}

          {/* Empty state */}
          {!hasSearched && !activeInput && (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Navigation size={28} color={c.amber500} />
              </View>
              <Text style={s.emptyTitle}>Plan your journey</Text>
              <Text style={s.emptyText}>
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

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },

    inputSection: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    timelineCol: {
      alignItems: 'center',
      paddingTop: 14,
      gap: 4,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    line: { width: 2, flex: 1, backgroundColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.4)' },
    inputsCol: { flex: 1, gap: 8 },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? c.stone800 : c.stone100,
    },
    input: {
      flex: 1,
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
      padding: 0,
    },
    swapBtn: {
      alignSelf: 'center',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },

    searchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
    },
    searchBtnActive: { backgroundColor: c.amber500 },
    searchBtnDisabled: { backgroundColor: isDark ? c.stone800 : '#e7e5e4' },
    searchBtnText: { fontSize: 14, fontFamily: font.semibold },
    searchBtnTextActive: { color: '#fff' },
    searchBtnTextDisabled: { color: t.textSecondary },

    modeTabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
    modeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    modeTabText: { fontSize: 12, fontFamily: font.semibold },

    suggestions: { paddingHorizontal: 20, marginTop: 16 },
    suggestionsLabel: { fontSize: 12, fontFamily: font.medium, color: t.textSecondary, marginBottom: 8 },
    stationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stationChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      borderWidth: 1,
      borderColor: t.border,
    },
    stationChipText: { fontSize: 12, fontFamily: font.medium, color: t.text },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 40 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 15, fontFamily: font.semibold, color: t.text },
    emptyText: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, textAlign: 'center' },
  })
}
