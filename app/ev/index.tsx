import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Mapbox from '@rnmapbox/maps'
import { X, Zap, Navigation, Plug, BatteryCharging, MapPin, Mail } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { useLocation } from '@/lib/hooks/useLocation'
import { fetchEvStations, type EvStation, type EvFetchResult } from '@/lib/services/ev-charging'

const BRAND = '#FF4D1C'
const EV_GREEN = '#16a34a'
const MAP_STYLE = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const ACCRA: [number, number] = [-0.187, 5.6037]

/**
 * EV Charging — a map of EV charge points around Accra/Ghana, powered by
 * OpenChargeMap (the global open registry). Honest about sparse data: shows an
 * onboarding state when no API key is set and a "suggest a station" path when the
 * map is empty (Ghana's EV network is still small + growing).
 */
export default function EvScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { location } = useLocation()
  const [result, setResult] = useState<EvFetchResult | null>(null)
  const [selected, setSelected] = useState<EvStation | null>(null)

  useEffect(() => {
    let active = true
    fetchEvStations({ lat: location?.latitude, lng: location?.longitude, distanceKm: 80 })
      .then((r) => { if (active) setResult(r) })
    return () => { active = false }
  }, [location?.latitude, location?.longitude])

  const stations = result?.ok ? result.stations : []

  const featureCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stations.map((s) => ({
      type: 'Feature' as const,
      id: s.id,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { id: s.id, operational: s.isOperational === false ? 0 : 1 },
    })),
  }), [stations])

  const openDirections = (s: EvStation) => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${s.lat},${s.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,
    })!
    Linking.openURL(url).catch(() => {})
  }

  const suggestStation = () =>
    Linking.openURL('mailto:support@troski.me?subject=New%20EV%20charging%20station&body=Station%20name%2C%20location%20(or%20Google%20Maps%20link)%2C%20operator%3A').catch(() => {})

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1020' }}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onPress={() => setSelected(null)}
      >
        <Mapbox.Camera
          defaultSettings={{
            centerCoordinate: location ? [location.longitude, location.latitude] : ACCRA,
            zoomLevel: location ? 12 : 10.5,
          }}
        />
        <Mapbox.UserLocation visible />

        {/* Station markers — green = operational, grey = unknown/down */}
        <Mapbox.ShapeSource
          id="ev-stations"
          shape={featureCollection as any}
          onPress={(e: any) => {
            const id = e?.features?.[0]?.properties?.id
            const s = stations.find((x) => x.id === String(id))
            if (s) { Haptics.selectionAsync(); setSelected(s) }
          }}
          hitbox={{ width: 22, height: 22 }}
        >
          <Mapbox.CircleLayer
            id="ev-halo"
            style={{ circleRadius: 13, circleColor: EV_GREEN, circleOpacity: 0.18 }}
          />
          <Mapbox.CircleLayer
            id="ev-dot"
            style={{
              circleRadius: 7,
              circleColor: ['case', ['==', ['get', 'operational'], 0], '#9CA3AF', EV_GREEN] as any,
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerWrap} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} style={styles.iconBtn} hitSlop={8}>
            <X size={20} color="#0A0A0A" />
          </TouchableOpacity>
          <View style={styles.titleWrap} pointerEvents="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Zap size={15} color={EV_GREEN} fill={EV_GREEN} />
              <Text style={styles.title}>EV Charging</Text>
            </View>
            <Text style={styles.subtitle}>
              {result?.ok ? `${stations.length} stations · Accra & Ghana` : 'Around Accra & Ghana'}
            </Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      {/* Selected station card */}
      {selected ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={styles.evBadge}><Zap size={20} color="#fff" fill="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={2}>{selected.name}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {[selected.operator, selected.town].filter(Boolean).join(' · ') || selected.address || 'Charging station'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}><X size={18} color="#9CA3AF" /></TouchableOpacity>
          </View>

          <View style={styles.pillRow}>
            {selected.maxPowerKW != null && (
              <View style={styles.pill}><Zap size={12} color="#374151" /><Text style={styles.pillText}>{selected.maxPowerKW} kW</Text></View>
            )}
            {selected.connectors[0] && (
              <View style={styles.pill}><Plug size={12} color="#374151" /><Text style={styles.pillText} numberOfLines={1}>{selected.connectors[0].type}</Text></View>
            )}
            {selected.access && (
              <View style={styles.pill}><MapPin size={12} color="#374151" /><Text style={styles.pillText}>{selected.access}</Text></View>
            )}
            {selected.isOperational === false && (
              <View style={[styles.pill, { backgroundColor: '#fee2e2' }]}><Text style={[styles.pillText, { color: '#dc2626' }]}>Out of service</Text></View>
            )}
          </View>

          <TouchableOpacity style={styles.dirBtn} onPress={() => openDirections(selected)} activeOpacity={0.9}>
            <Navigation size={18} color="#fff" />
            <Text style={styles.dirText}>Directions</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── States: loading / onboarding (no key) / empty / list summary ──
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {!result ? (
            <View style={styles.center}><ActivityIndicator color={EV_GREEN} /><Text style={styles.muted}>Finding charging stations…</Text></View>
          ) : result.ok ? (
            <ScrollView style={{ maxHeight: 230 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.listLabel}>Nearby charging stations</Text>
              {stations.map((s) => (
                <TouchableOpacity key={s.id} style={styles.listRow} onPress={() => { Haptics.selectionAsync(); setSelected(s) }}>
                  <View style={[styles.evDot, { backgroundColor: s.isOperational === false ? '#9CA3AF' : EV_GREEN }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.listSub} numberOfLines={1}>{[s.maxPowerKW ? `${s.maxPowerKW} kW` : null, s.operator, s.town].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Navigation size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : result.reason === 'no_key' ? (
            <View style={styles.stateBox}>
              <BatteryCharging size={30} color={EV_GREEN} />
              <Text style={styles.stateTitle}>Connect EV charging data</Text>
              <Text style={styles.stateSub}>Add a free OpenChargeMap key (EXPO_PUBLIC_OCM_KEY) to show live charge points across Accra & Ghana.</Text>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <BatteryCharging size={30} color={EV_GREEN} />
              <Text style={styles.stateTitle}>{result.reason === 'empty' ? 'No stations mapped near you yet' : "Couldn't load stations"}</Text>
              <Text style={styles.stateSub}>Ghana's EV network is still growing. Know a charging point? Suggest it and we'll add it.</Text>
              <TouchableOpacity style={styles.suggestBtn} onPress={suggestStation} activeOpacity={0.9}>
                <Mail size={16} color={EV_GREEN} /><Text style={styles.suggestText}>Suggest a station</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 4 },
  titleWrap: { alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 16, color: '#0A0A0A', textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 6 },
  subtitle: { fontFamily: font.semibold, fontSize: 11.5, color: '#374151', textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 6, marginTop: 1 },

  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  evBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: EV_GREEN, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: font.bold, fontSize: 16, color: '#0A0A0A', letterSpacing: -0.3 },
  cardSub: { fontFamily: font.medium, fontSize: 12.5, color: '#9CA3AF', marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 180 },
  pillText: { fontFamily: font.semibold, fontSize: 12, color: '#374151' },
  dirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: EV_GREEN, height: 50, borderRadius: 14, marginTop: 16 },
  dirText: { fontFamily: font.bold, fontSize: 15.5, color: '#fff' },

  center: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  muted: { fontFamily: font.medium, fontSize: 13, color: '#9CA3AF' },
  listLabel: { fontFamily: font.bold, fontSize: 12, color: '#6B7280', letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  evDot: { width: 10, height: 10, borderRadius: 5 },
  listTitle: { fontFamily: font.bold, fontSize: 14, color: '#111' },
  listSub: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  stateBox: { alignItems: 'center', paddingVertical: 14, gap: 8 },
  stateTitle: { fontFamily: font.bold, fontSize: 16, color: '#0A0A0A', marginTop: 4, textAlign: 'center' },
  stateSub: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  suggestBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, backgroundColor: 'rgba(22,163,74,0.10)', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 10 },
  suggestText: { fontFamily: font.bold, fontSize: 14, color: EV_GREEN },
})
