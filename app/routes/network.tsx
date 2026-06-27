import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Keyboard } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Mapbox from '@rnmapbox/maps'
import { X, Search, Route as RouteIcon, MapPin } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import {
  linesFeatureCollection, hubsFeatureCollection, ROUTE_COUNT, hubs,
  type NetworkRoute, networkRoutes,
} from '@/lib/data/trotro-network'

const BRAND = '#FF4D1C'
const MAP_STYLE = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
// Accra metro center + a comfortable starting frame.
const ACCRA = { center: [-0.187, 5.6037] as [number, number], zoom: 10.4 }

/**
 * Accra Trotro Network Map — the whole trotro network on one map (566 OSM/
 * AccraMobile routes), colored like a transit diagram, with the big lorry-park
 * hubs as nodes. Search by route number / name / station; tap a line to see it.
 * Accra has never had a public trotro route map — this is it.
 */
export default function NetworkMapScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<NetworkRoute | null>(null)

  const lines = useMemo(() => linesFeatureCollection(query, selected?.id ?? null), [query, selected])
  const hubFC = useMemo(() => hubsFeatureCollection(4), [])

  // Search suggestions — top matching routes shown as a list under the box.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return networkRoutes
      .filter((r) =>
        (r.ref || '').toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.from || '').toLowerCase().includes(q) ||
        (r.to || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [query])

  const choose = (r: NetworkRoute) => {
    Haptics.selectionAsync()
    Keyboard.dismiss()
    setSelected(r)
    setQuery('')
  }

  const onLinePress = (e: any) => {
    const f = e?.features?.[0]
    if (!f) return
    const r = networkRoutes.find((x) => x.id === String(f.properties?.id))
    if (r) choose(r)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1020' }}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          defaultSettings={{ centerCoordinate: ACCRA.center, zoomLevel: ACCRA.zoom }}
          centerCoordinate={selected ? undefined : undefined}
        />

        {/* All routes — one source, data-driven color/width/opacity (efficient). */}
        <Mapbox.ShapeSource id="net-lines" shape={lines as any} onPress={onLinePress} hitbox={{ width: 16, height: 16 }}>
          <Mapbox.LineLayer
            id="net-lines-layer"
            style={{
              lineColor: ['get', 'color'] as any,
              lineWidth: ['get', 'width'] as any,
              lineOpacity: ['get', 'opacity'] as any,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>

        {/* Hubs — lorry parks / termini, sized by how many routes touch them. */}
        <Mapbox.ShapeSource id="net-hubs" shape={hubFC as any}>
          <Mapbox.CircleLayer
            id="net-hubs-dot"
            style={{
              circleRadius: ['case', ['==', ['get', 'big'], 1], 6, 3.5] as any,
              circleColor: '#FFFFFF',
              circleStrokeColor: '#0B1020',
              circleStrokeWidth: 1.6,
            }}
          />
          <Mapbox.SymbolLayer
            id="net-hubs-label"
            minZoomLevel={11}
            style={{
              textField: ['get', 'name'] as any,
              textSize: ['case', ['==', ['get', 'big'], 1], 12, 10] as any,
              textColor: '#0A0A0A',
              textHaloColor: '#FFFFFF',
              textHaloWidth: 1.4,
              textOffset: [0, 1.1],
              textAnchor: 'top',
              textOptional: true,
              textAllowOverlap: false,
              textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* ── Header + search ── */}
      <SafeAreaView edges={['top']} style={styles.headerWrap} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} style={styles.iconBtn} hitSlop={8}>
            <X size={20} color="#0A0A0A" />
          </TouchableOpacity>
          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={styles.title}>Accra Trotro Map</Text>
            <Text style={styles.subtitle}>{ROUTE_COUNT} routes · {hubs.length} stations</Text>
          </View>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.searchBox}>
          <Search size={17} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={(t) => { setSelected(null); setQuery(t) }}
            placeholder="Search route no., name or station…"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color="#9CA3AF" /></TouchableOpacity>
          )}
        </View>

        {matches.length > 0 && (
          <ScrollView style={styles.suggest} keyboardShouldPersistTaps="handled">
            {matches.map((r) => (
              <TouchableOpacity key={r.id} style={styles.suggestRow} onPress={() => choose(r)}>
                <View style={[styles.refChip, { backgroundColor: r.color }]}><Text style={styles.refChipText}>{r.ref || '•'}</Text></View>
                <Text style={styles.suggestText} numberOfLines={1}>{r.from} → {r.to}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ── Selected route card ── */}
      {selected && (
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.refChipLg, { backgroundColor: selected.color }]}>
              <Text style={styles.refChipLgText}>{selected.ref || '•'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{selected.from} → {selected.to}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{selected.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}><X size={18} color="#9CA3AF" /></TouchableOpacity>
          </View>
          <View style={styles.cardMetaRow}>
            <View style={styles.metaPill}><RouteIcon size={13} color="#374151" /><Text style={styles.metaText}>{selected.coords.length} points</Text></View>
            <View style={styles.metaPill}><MapPin size={13} color="#374151" /><Text style={styles.metaText}>Trotro</Text></View>
          </View>
        </View>
      )}

      {/* ── Legend hint ── */}
      {!selected && matches.length === 0 && (
        <SafeAreaView edges={['bottom']} style={styles.legendWrap} pointerEvents="none">
          <View style={styles.legend}>
            <Text style={styles.legendText}>Each color = a trotro line · tap a line for details · ● = lorry-park hub</Text>
          </View>
        </SafeAreaView>
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
  subtitle: { fontFamily: font.semibold, fontSize: 11.5, color: '#374151', textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 46, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 5 },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 15, color: '#0A0A0A' },
  suggest: { backgroundColor: '#fff', borderRadius: 14, marginTop: 8, maxHeight: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 5 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  suggestText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: '#1F2937' },
  refChip: { minWidth: 30, height: 22, borderRadius: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  refChipText: { fontFamily: font.bold, fontSize: 12, color: '#fff' },
  card: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  refChipLg: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  refChipLgText: { fontFamily: font.extrabold, fontSize: 17, color: '#fff' },
  cardTitle: { fontFamily: font.bold, fontSize: 16, color: '#0A0A0A', letterSpacing: -0.3 },
  cardSub: { fontFamily: font.medium, fontSize: 12.5, color: '#9CA3AF', marginTop: 1 },
  cardMetaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  metaText: { fontFamily: font.semibold, fontSize: 12, color: '#374151' },
  legendWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  legend: { backgroundColor: 'rgba(10,10,10,0.82)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14 },
  legendText: { fontFamily: font.medium, fontSize: 11.5, color: '#fff' },
})
