import { useMemo, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Search, MapPin, Bus, ChevronRight, Navigation } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { useLocation } from '@/lib/hooks/useLocation'
import { formatDistance } from '@/lib/utils/distance'
import { timeAgo } from '@/lib/utils/time'
import { fetchTerminals, type Terminal } from '@/lib/services/terminals'
import { QUEUE_META } from '@/lib/services/queueStatus'

const BRAND = '#FF4D1C'

export default function TerminalsScreen() {
  const router = useRouter()
  const { location, isPermissionGranted, requestPermission } = useLocation()
  const [query, setQuery] = useState('')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['terminals', location?.latitude ?? null, location?.longitude ?? null],
    queryFn: () => fetchTerminals(location ? { latitude: location.latitude, longitude: location.longitude } : null, Date.now()),
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    const terminals = data ?? []
    const q = query.trim().toLowerCase()
    if (!q) return terminals
    return terminals.filter((t) => t.name.toLowerCase().includes(q) || (t.city || '').toLowerCase().includes(q))
  }, [data, query])

  // Tap a terminal → open the route planner with this terminal as the origin
  const openTerminal = (t: Terminal) => {
    Haptics.selectionAsync()
    router.push({ pathname: '/routes/search', params: { from: t.name } } as never)
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Terminals</Text>
          <Text style={s.subtitle}>{isPermissionGranted ? 'Nearest first' : 'Bus stations & lorry parks'}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Search size={18} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Where would you like to go?"
          placeholderTextColor="#9CA3AF"
          style={s.searchInput}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} colors={[BRAND]} />}
      >
        {/* Location prompt — distance needs GPS */}
        {!isPermissionGranted && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => requestPermission()} style={s.locPrompt}>
            <Navigation size={16} color={BRAND} />
            <Text style={s.locPromptText}>Turn on location to sort terminals by distance</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={s.center}><ActivityIndicator color={BRAND} /></View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Bus size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>{query ? 'No terminals match' : 'No terminals yet'}</Text>
            <Text style={s.emptySub}>{query ? 'Try a different name.' : 'Terminals appear here as routes are mapped.'}</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text style={s.sectionLabel}>{isPermissionGranted ? 'Nearby Terminals' : 'All Terminals'}</Text>
            {filtered.map((t) => {
              const meta = t.queueStatus ? QUEUE_META[t.queueStatus] : null
              const fresh = t.queueAgeMins != null && t.queueAgeMins <= 120
              return (
                <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={() => openTerminal(t)} style={s.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.terminalName} numberOfLines={1}>{t.name}</Text>
                    <View style={s.metaRow}>
                      <Text style={s.metaText}>
                        {t.routeCount > 0 ? `${t.routeCount} route${t.routeCount === 1 ? '' : 's'}` : 'Major station'}
                      </Text>
                      {t.city && (<><View style={s.dot} /><Text style={s.metaText}>{t.city}</Text></>)}
                      {meta && fresh && (
                        <>
                          <View style={s.dot} />
                          <Text style={[s.metaText, { color: meta.color, fontFamily: font.semibold }]}>{meta.label} queue</Text>
                        </>
                      )}
                    </View>
                    {meta && fresh && (
                      <Text style={s.queueAge}>Queue reported {timeAgo(new Date(Date.now() - t.queueAgeMins! * 60000).toISOString())}</Text>
                    )}
                  </View>

                  <View style={s.cardRight}>
                    {t.distanceKm != null && (
                      <View style={s.distancePill}>
                        <MapPin size={11} color={BRAND} />
                        <Text style={s.distanceText}>{formatDistance(t.distanceKm)}</Text>
                      </View>
                    )}
                    <ChevronRight size={18} color="#D1D5DB" />
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  title: { fontFamily: font.bold, fontSize: 22, color: '#111', letterSpacing: -0.5 },
  subtitle: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', marginTop: 1 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, height: 48, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: '#111' },

  locPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: '#FFF0EB', borderWidth: 1, borderColor: 'rgba(255,77,28,0.2)' },
  locPromptText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: '#9A3412' },

  sectionLabel: { fontFamily: font.bold, fontSize: 13, color: '#6B7280', letterSpacing: 0.3, marginTop: 4, marginBottom: 2 },

  center: { paddingVertical: 60, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  terminalName: { fontFamily: font.bold, fontSize: 16, color: '#111' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF' },
  queueAge: { fontFamily: font.regular, fontSize: 11, color: '#B0B0B0', marginTop: 3 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB' },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF0EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  distanceText: { fontFamily: font.bold, fontSize: 11, color: BRAND },
})
