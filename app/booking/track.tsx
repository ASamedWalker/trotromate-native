import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { X, Bus, MapPin } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import TrackingMap from '@/components/TrackingMap'
import { fetchVehiclePositions, type VehiclePosition } from '@/lib/services/vehicle-positions'
import { useRealtimeVehicle } from '@/lib/hooks/useRealtimeVehicle'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { haversineKm } from '@/lib/utils/distance'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const POLL_MS = 6000 // bus upserts every ~10s; poll a touch faster

function coordFor(name?: string): { lat: number; lng: number } | null {
  if (!name) return null
  const n = name.toLowerCase()
  const key = Object.keys(FALLBACK_STATION_COORDS).find(
    (k) => k.toLowerCase() === n || k.toLowerCase().includes(n) || n.includes(k.toLowerCase()),
  )
  const c = key ? FALLBACK_STATION_COORDS[key] : null
  return c ? { lat: c.latitude, lng: c.longitude } : null
}

/**
 * Live bus tracking for a booked passenger — see the real Troski bus on the route
 * move toward your drop-off, with a live ETA. Reads vehicle_positions (the bus
 * upserts every ~10s via Troski Pro) + the van's realtime broadcast for instant
 * updates. Honest "waiting" state until a bus starts the route.
 */
export default function TrackBusScreen() {
  const router = useRouter()
  const { route_id, to } = useLocalSearchParams<{ route_id?: string; to?: string }>()
  const [bus, setBus] = useState<VehiclePosition | null>(null)
  const [loading, setLoading] = useState(true)

  // Fast poll vehicle_positions for the booked route.
  useEffect(() => {
    if (!route_id) { setLoading(false); return }
    let active = true
    const tick = async () => {
      const list = await fetchVehiclePositions(route_id)
      if (!active) return
      setBus(list.find((v) => !v.isStale) ?? list[0] ?? null)
      setLoading(false)
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { active = false; clearInterval(id) }
  }, [route_id])

  // Instant 10s broadcast for the matched van (overrides the poll position).
  const rt = useRealtimeVehicle(bus?.vanId ?? null)

  const pos = rt.position
    ? { lat: rt.position.lat, lng: rt.position.lng, heading: rt.position.heading }
    : bus ? { lat: bus.latitude, lng: bus.longitude, heading: bus.heading } : null
  const plate = rt.position?.plateNumber ?? bus?.plateNumber ?? null

  const dropoff = coordFor(to)
  const distKm = pos && dropoff ? haversineKm(pos.lat, pos.lng, dropoff.lat, dropoff.lng) : null
  const etaMins = (() => {
    if (distKm == null) return null
    const ms = rt.position?.speed ?? bus?.speed ?? null
    const kmh = Math.max(8, (ms ?? 5.5) * 3.6) // floor ~8km/h for stop-go traffic
    return Math.max(1, Math.round((distKm / kmh) * 60))
  })()
  const status: 'waiting' | 'en_route' | 'arriving' =
    !pos ? 'waiting' : (distKm != null && distKm < 0.5 ? 'arriving' : 'en_route')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} style={s.closeBtn} hitSlop={8}>
          <X size={20} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Track your bus</Text>
        <View style={{ width: 36 }} />
      </View>

      <TrackingMap
        vehiclePosition={pos}
        dropoffCoord={dropoff ?? undefined}
        etaMins={etaMins}
        plateNumber={plate ?? undefined}
        status={status}
        height="56%"
      />

      <View style={s.sheet}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={BRAND} />
            <Text style={s.muted}>Finding your bus…</Text>
          </View>
        ) : !bus ? (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
            <View style={s.iconWrap}><Bus size={26} color="#9CA3AF" /></View>
            <Text style={s.title}>No bus on this route yet</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>We'll show your Troski bus live the moment one starts the route.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.iconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}><Bus size={24} color="#16A34A" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{plate}</Text>
                <Text style={s.muted}>{status === 'arriving' ? 'Arriving now' : 'On the way'}{bus.isStale ? ' · last seen a while ago' : ''}</Text>
              </View>
              <View style={s.livePill}>
                <View style={[s.dot, { backgroundColor: bus.isStale ? '#9CA3AF' : '#22C55E' }]} />
                <Text style={[s.livePillText, { color: bus.isStale ? '#9CA3AF' : '#16A34A' }]}>{bus.isStale ? 'Stale' : 'Live'}</Text>
              </View>
            </View>

            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statVal}>{etaMins != null ? `~${etaMins} min` : '—'}</Text>
                <Text style={s.statLabel}>To {to || 'your stop'}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statVal}>{distKm != null ? `${distKm.toFixed(1)} km` : '—'}</Text>
                <Text style={s.statLabel}>Away</Text>
              </View>
            </View>

            <View style={s.hintRow}>
              <MapPin size={14} color="#9CA3AF" />
              <Text style={s.hint}>Updates live as the bus moves. Trotros leave when full.</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: '#0A0A0A' },
  sheet: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 18, color: '#0A0A0A', letterSpacing: -0.3 },
  muted: { fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.10)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  livePillText: { fontFamily: font.bold, fontSize: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 16, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  statVal: { fontFamily: font.extrabold, fontSize: 22, color: '#0A0A0A', letterSpacing: -0.5 },
  statLabel: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  hint: { fontFamily: font.medium, fontSize: 12.5, color: '#9CA3AF' },
})
