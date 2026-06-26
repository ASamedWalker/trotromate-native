import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { X, Bus, MapPin, BellRing } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import TrackingMap from '@/components/TrackingMap'
import { fetchVehiclePositions, type VehiclePosition } from '@/lib/services/vehicle-positions'
import { useRealtimeVehicle } from '@/lib/hooks/useRealtimeVehicle'
import { fetchRoadLine } from '@/lib/services/directions'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { haversineKm } from '@/lib/utils/distance'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'
const POLL_MS = 6000 // bus upserts every ~10s; poll a touch faster
const BUS_ICON = require('@/assets/images/home/bus_icon_bg_removed.png')

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
  const { route_id, to, van } = useLocalSearchParams<{ route_id?: string; to?: string; van?: string }>()
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

  // Live broadcast (gps:van:{vanId}, ~10s). Subscribe to the matched van, or a
  // van passed explicitly (e.g. a specific assigned bus). Broadcast wins when fresh.
  const rt = useRealtimeVehicle(van ?? bus?.vanId ?? null)

  const pos = rt.position
    ? { lat: rt.position.lat, lng: rt.position.lng, heading: rt.position.heading }
    : bus ? { lat: bus.latitude, lng: bus.longitude, heading: bus.heading } : null
  const plate = rt.position?.plateNumber ?? bus?.plateNumber ?? null
  const hasLive = !!rt.position || !!bus
  const isStale = !rt.position && !!bus && bus.isStale

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

  // ── Data Saver: skip the map (tiles = the data cost) — alerts carry it. Most
  // riders guard their bundle, so the notification angle is the primary channel.
  const [dataSaver, setDataSaver] = useState(false)
  const [alertsOn, setAlertsOn] = useState(true)

  // ── Corridor line — road-following path from the bus to the drop-off, so the
  // marker rides the actual lane. Refetch only when the bus has moved enough
  // (>150m) to keep Directions calls sparse. ──
  const [routeLine, setRouteLine] = useState<[number, number][]>([])
  const lineFrom = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (dataSaver || !pos || !dropoff) return
    const moved = !lineFrom.current || haversineKm(lineFrom.current.lat, lineFrom.current.lng, pos.lat, pos.lng) > 0.15
    if (!moved && routeLine.length) return
    lineFrom.current = { lat: pos.lat, lng: pos.lng }
    let active = true
    fetchRoadLine([pos.lng, pos.lat], [dropoff.lng, dropoff.lat]).then((line) => { if (active) setRouteLine(line) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.lat, pos?.lng, dropoff?.lat, dropoff?.lng, dataSaver])

  // Ensure OS notification permission when the rider opts into alerts (don't rely
  // on the global push pref, which they may have left off).
  useEffect(() => {
    if (!alertsOn) return
    Notifications.getPermissionsAsync()
      .then(({ granted }) => { if (!granted) return Notifications.requestPermissionsAsync() })
      .catch(() => {})
  }, [alertsOn])

  // Proximity alerts — fire a local notification once as the bus crosses 10 min /
  // 5 min / arriving, so the rider can lock their phone and still know when to move.
  const fired = useRef({ t10: false, t5: false, arrive: false })
  useEffect(() => {
    if (!alertsOn || etaMins == null || !plate) return
    const notify = (title: string, body: string) =>
      Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null }).catch(() => {})
    if (status === 'arriving' && !fired.current.arrive) {
      fired.current.arrive = true
      notify('🚌 Your bus is arriving', `${plate} is almost at ${to || 'your stop'} — get ready.`)
    } else if (etaMins <= 5 && !fired.current.t5) {
      fired.current.t5 = true
      notify('🚌 Bus ~5 min away', `${plate} is about ${distKm?.toFixed(1)} km from ${to || 'your stop'}.`)
    } else if (etaMins <= 10 && !fired.current.t10) {
      fired.current.t10 = true
      notify('🚌 Bus ~10 min away', `${plate} is on the way to ${to || 'your stop'}.`)
    }
  }, [etaMins, distKm, status, alertsOn, plate, to])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} style={s.closeBtn} hitSlop={8}>
          <X size={20} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Track your bus</Text>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setDataSaver((v) => !v) }}
          style={[s.saverChip, dataSaver && { backgroundColor: 'rgba(255,77,28,0.12)' }]}
          hitSlop={6}
        >
          <Text style={[s.saverText, dataSaver && { color: BRAND }]}>Saver</Text>
        </TouchableOpacity>
      </View>

      {dataSaver ? (
        // Data-saver — no map tiles. Big ETA + alerts carry the update.
        <View style={s.saverHero}>
          <View style={[s.iconWrap, { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34,197,94,0.12)' }]}>
            <Image source={BUS_ICON} style={{ width: 38, height: 38 }} resizeMode="contain" />
          </View>
          <Text style={s.saverEta}>{etaMins != null ? `~${etaMins} min` : hasLive ? 'On the way' : '—'}</Text>
          <Text style={s.muted}>{hasLive ? `${plate} · ${distKm != null ? `${distKm.toFixed(1)} km away` : 'en route'}` : van ? 'Connecting…' : 'Waiting for a bus on this route'}</Text>
          <View style={s.saverAlertNote}><BellRing size={14} color="#16A34A" /><Text style={s.saverAlertText}>Map off · we'll alert you as the bus nears</Text></View>
        </View>
      ) : (
        <TrackingMap
          vehiclePosition={pos}
          dropoffCoord={dropoff ?? undefined}
          routeLine={routeLine}
          etaMins={etaMins}
          plateNumber={plate ?? undefined}
          status={status}
          height="56%"
        />
      )}

      <View style={s.sheet}>
        {loading && !hasLive && !van ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={BRAND} />
            <Text style={s.muted}>Finding your bus…</Text>
          </View>
        ) : !hasLive ? (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
            <View style={s.iconWrap}><Bus size={26} color="#9CA3AF" /></View>
            <Text style={s.title}>{van ? 'Connecting to your bus…' : 'No bus on this route yet'}</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>We'll show your Troski bus live the moment one starts the route.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.iconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <Image source={BUS_ICON} style={{ width: 30, height: 30 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{plate}</Text>
                <Text style={s.muted}>{status === 'arriving' ? 'Arriving now' : 'On the way'}{isStale ? ' · last seen a while ago' : ''}</Text>
              </View>
              <View style={s.livePill}>
                <View style={[s.dot, { backgroundColor: isStale ? '#9CA3AF' : '#22C55E' }]} />
                <Text style={[s.livePillText, { color: isStale ? '#9CA3AF' : '#16A34A' }]}>{isStale ? 'Stale' : 'Live'}</Text>
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

            {/* Alert me — local notification at 10/5 min + arriving */}
            <View style={s.alertRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <BellRing size={16} color="#374151" />
                <Text style={s.alertLabel}>Alert me as the bus nears</Text>
              </View>
              <Switch value={alertsOn} onValueChange={(v) => { Haptics.selectionAsync(); setAlertsOn(v) }} trackColor={{ true: BRAND, false: '#E5E7EB' }} thumbColor="#fff" />
            </View>
            <Text style={s.hint}>You'll get a notification at ~10 min, ~5 min and on arrival — lock your phone, we'll tap you.</Text>
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
  hint: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 17 },
  saverChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F3F4F6' },
  saverText: { fontFamily: font.bold, fontSize: 12, color: '#6B7280' },
  saverHero: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  saverEta: { fontFamily: font.extrabold, fontSize: 40, color: '#0A0A0A', letterSpacing: -1.2, marginTop: 6 },
  saverAlertNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(34,197,94,0.10)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  saverAlertText: { fontFamily: font.bold, fontSize: 12.5, color: '#16A34A' },
  alertRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  alertLabel: { fontFamily: font.bold, fontSize: 14, color: '#1F2937' },
})
