import { useState, useMemo } from 'react'
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { X, Check, Search } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { RouteStop } from '@/lib/types'

const BRAND = '#FF4D1C'

interface Props {
  visible: boolean
  title?: string
  stops: RouteStop[]
  selectedOrder: number | null
  /** Only stops AFTER this order are selectable (alight must be after board). */
  minOrder?: number
  /** Only stops BEFORE this order are selectable (board must be before alight). */
  maxOrder?: number
  /** Optional fare label per stop_order, e.g. "₵5.50". */
  fareLabel?: (order: number) => string | undefined
  onSelect: (order: number) => void
  onClose: () => void
}

/**
 * Searchable stop picker — the scalable alternative to a wall of chips for routes
 * with many alight points. A tappable field opens this; type to filter, tap to
 * pick. Uses a core RN Modal (portals to root) so it's safe to open from inside a
 * @gorhom bottom sheet (no nesting).
 */
export default function StopPickerModal({
  visible, title = 'Where will you alight?', stops, selectedOrder, minOrder, maxOrder, fareLabel, onSelect, onClose,
}: Props) {
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let s = [...stops].sort((a, b) => a.stop_order - b.stop_order)
    if (minOrder != null) s = s.filter((x) => x.stop_order > minOrder)
    if (maxOrder != null) s = s.filter((x) => x.stop_order < maxOrder)
    const t = q.trim().toLowerCase()
    if (t) s = s.filter((x) => x.stop_name.toLowerCase().includes(t))
    return s
  }, [stops, q, minOrder, maxOrder])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.closeBtn}>
            <X size={20} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={s.searchWrap}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search stops"
            placeholderTextColor="#9CA3AF"
            style={s.searchInput}
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 360 }}
          ListEmptyComponent={<Text style={s.empty}>No stops match “{q}”.</Text>}
          renderItem={({ item }) => {
            const sel = item.stop_order === selectedOrder
            const fare = fareLabel?.(item.stop_order)
            const km = item.distance_from_origin_km
            const sub = [km != null ? `${km.toFixed(1)} km` : null, fare].filter(Boolean).join('  ·  ')
            return (
              <TouchableOpacity
                onPress={() => { onSelect(item.stop_order); onClose() }}
                activeOpacity={0.7}
                style={s.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowName, sel && { color: BRAND }]} numberOfLines={1}>{item.stop_name}</Text>
                  {!!sub && <Text style={s.rowSub}>{sub}</Text>}
                </View>
                {sel && <Check size={18} color={BRAND} strokeWidth={2.6} />}
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: font.bold, fontSize: 18, color: '#0A0A0A', letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 15, color: '#0A0A0A', padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowName: { fontFamily: font.bold, fontSize: 15, color: '#1F2937' },
  rowSub: { fontFamily: font.medium, fontSize: 12.5, color: '#9CA3AF', marginTop: 1 },
  empty: { fontFamily: font.medium, fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
})
