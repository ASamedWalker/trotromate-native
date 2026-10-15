import React from 'react'
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { brand, font, ui } from '@/lib/theme'
import { META, SectionLabel } from '@/components/pulse/PulseBits'

export type PulseFilter = 'all' | 'fare' | 'question' | 'queue' | 'moment'

export const FILTER_LABEL: Record<PulseFilter, string> = {
  all: 'All types',
  fare: 'Fares',
  question: 'Questions',
  queue: 'Queue updates',
  moment: 'Photos and videos',
}

const ORDER: PulseFilter[] = ['all', 'fare', 'question', 'queue', 'moment']

/**
 * One plain RN Modal (no nested bottom sheets): the place for "Right now" and the post type.
 * Replaces the clipped chip row (UX v2 P7, without followed places / unread counts).
 */
export function PulseFilterSheet({
  visible, onClose, filter, onFilter, places, placeId, onPlace,
}: {
  visible: boolean
  onClose: () => void
  filter: PulseFilter
  onFilter: (f: PulseFilter) => void
  places: { id: string; name: string }[]
  placeId: string | null
  onPlace: (id: string | null) => void
}) {
  const bottom = useSafeAreaInsets().bottom
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: ui.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: bottom + 12, maxHeight: '75%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          {places.length > 0 ? (
            <>
              <View style={{ marginTop: 6, marginBottom: 2 }}><SectionLabel>Place</SectionLabel></View>
              <Option label="Near me" selected={placeId === null} onPress={() => { onPlace(null); onClose() }} />
              {places.map((p) => (
                <Option key={p.id} label={p.name} selected={placeId === p.id} onPress={() => { onPlace(p.id); onClose() }} />
              ))}
            </>
          ) : null}
          <View style={{ marginTop: 14, marginBottom: 2 }}><SectionLabel>Show</SectionLabel></View>
          {ORDER.map((f) => (
            <Option key={f} label={FILTER_LABEL[f]} selected={filter === f} onPress={() => { onFilter(f); onClose() }} />
          ))}
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: META, marginTop: 8 }}>
            The place only changes the Right now stations. Posts stay city-wide.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  )
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0EFED' }}
    >
      <Text style={{ fontFamily: selected ? font.bold : font.medium, fontSize: 16, color: ui.text }} numberOfLines={1}>{label}</Text>
      {selected ? <Check size={20} color={brand.orangeText} /> : null}
    </TouchableOpacity>
  )
}
