import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { MapPin, RotateCcw } from 'lucide-react-native'

const POPULAR_STATIONS = [
  'Circle', 'Madina', 'Tema', 'Kaneshie', 'Lapaz',
  'Achimota', 'Legon', 'Kasoa', 'Dansoman', 'Spintex',
  'Nima', 'Osu', 'Labadi', 'Teshie', 'Ashaiman',
  'Abeka', 'Odorkor', 'Darkuman', 'Mallam', 'Kwashieman',
]

interface SetCommuteStepProps {
  onCommuteSet: (from: string, to: string) => Promise<void>
  isSaving: boolean
}

export default function SetCommuteStep({ onCommuteSet, isSaving }: SetCommuteStepProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activeField, setActiveField] = useState<'from' | 'to'>('from')
  const [fromEditing, setFromEditing] = useState(false)
  const [toEditing, setToEditing] = useState(false)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')

  const fromRef = useRef<TextInput>(null)
  const toRef = useRef<TextInput>(null)

  const activateFrom = useCallback(() => {
    setActiveField('from')
    setFromEditing(true)
    setToEditing(false)
    setFromQuery(from)
    setTimeout(() => fromRef.current?.focus(), 50)
  }, [from])

  const activateTo = useCallback(() => {
    setActiveField('to')
    setToEditing(true)
    setFromEditing(false)
    setToQuery(to)
    setTimeout(() => toRef.current?.focus(), 50)
  }, [to])

  const handleStationTap = useCallback(
    (station: string) => {
      if (activeField === 'from') {
        setFrom(station)
        setFromQuery('')
        setFromEditing(false)
        // Auto-advance to To
        if (station === to) setTo('')
        setActiveField('to')
        setToEditing(true)
        setToQuery('')
        setTimeout(() => toRef.current?.focus(), 50)
      } else {
        if (station !== from) {
          setTo(station)
          setToQuery('')
          setToEditing(false)
        }
      }
    },
    [activeField, from, to]
  )

  const handleSwap = useCallback(() => {
    setFrom(to)
    setTo(from)
    setFromQuery('')
    setToQuery('')
  }, [from, to])

  const handleConfirm = useCallback(async () => {
    if (from && to) {
      await onCommuteSet(from, to)
    }
  }, [from, to, onCommuteSet])

  const isReady = from.length > 0 && to.length > 0 && from !== to

  // Filter chips by active field's query
  const query = activeField === 'from' ? fromQuery : toQuery
  const filteredStations = useMemo(() => {
    let stations = POPULAR_STATIONS
    if (activeField === 'to') {
      stations = stations.filter((s) => s !== from)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      stations = stations.filter((s) => s.toLowerCase().includes(q))
    }
    return stations
  }, [activeField, from, query])

  // Show "Use custom" option when query doesn't match any station
  const isCustomEntry =
    query.trim().length >= 2 &&
    !POPULAR_STATIONS.some((s) => s.toLowerCase() === query.trim().toLowerCase())

  const handleCustomSelect = useCallback(() => {
    const custom = query.trim()
    if (!custom) return
    handleStationTap(custom)
  }, [query, handleStationTap])

  return (
    <View style={styles.container}>
      {/* Route card with inline editable fields */}
      <View style={styles.routeCard}>
        {/* From field */}
        <TouchableOpacity
          onPress={activateFrom}
          activeOpacity={0.7}
          style={[styles.fieldRow, activeField === 'from' && styles.fieldRowActive]}
        >
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>From</Text>
            {fromEditing && activeField === 'from' ? (
              <TextInput
                ref={fromRef}
                style={styles.fieldInput}
                value={fromQuery}
                onChangeText={setFromQuery}
                placeholder="Type or pick below"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
                autoCorrect={false}
              />
            ) : (
              <Text style={[styles.fieldValue, !from && styles.fieldPlaceholder]}>
                {from || 'Tap to select'}
              </Text>
            )}
          </View>
          {from !== '' && to !== '' && activeField === 'from' && (
            <TouchableOpacity onPress={handleSwap} activeOpacity={0.7} style={styles.swapBtn}>
              <RotateCcw size={14} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* To field */}
        <TouchableOpacity
          onPress={activateTo}
          activeOpacity={0.7}
          style={[styles.fieldRow, activeField === 'to' && styles.fieldRowActive]}
        >
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>To</Text>
            {toEditing && activeField === 'to' ? (
              <TextInput
                ref={toRef}
                style={styles.fieldInput}
                value={toQuery}
                onChangeText={setToQuery}
                placeholder="Type or pick below"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
                autoCorrect={false}
              />
            ) : (
              <Text style={[styles.fieldValue, !to && styles.fieldPlaceholder]}>
                {to || 'Tap to select'}
              </Text>
            )}
          </View>
          {from !== '' && to !== '' && activeField === 'to' && (
            <TouchableOpacity onPress={handleSwap} activeOpacity={0.7} style={styles.swapBtn}>
              <RotateCcw size={14} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom entry option */}
      {isCustomEntry && (
        <TouchableOpacity onPress={handleCustomSelect} activeOpacity={0.7} style={styles.customRow}>
          <MapPin size={16} color="#10b981" />
          <Text style={styles.customText}>Use &ldquo;{query.trim()}&rdquo;</Text>
        </TouchableOpacity>
      )}

      {/* Station chips — 3-column grid */}
      <ScrollView
        style={styles.chipScroll}
        contentContainerStyle={styles.chipGrid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredStations.map((station) => {
          const isSelected =
            (activeField === 'from' && station === from) ||
            (activeField === 'to' && station === to)

          return (
            <TouchableOpacity
              key={station}
              onPress={() => handleStationTap(station)}
              activeOpacity={0.7}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {station}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Confirm button */}
      {isReady && (
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={isSaving}
          activeOpacity={0.85}
          style={styles.confirmBtn}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.confirmText}>Let&apos;s Go</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    marginTop: 4,
  },
  routeCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fieldRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Baloo2_600SemiBold',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: 'Baloo2_600SemiBold',
    color: '#fff',
    marginTop: 2,
  },
  fieldPlaceholder: {
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Baloo2_400Regular',
  },
  fieldInput: {
    fontSize: 16,
    fontFamily: 'Baloo2_500Medium',
    color: '#fff',
    paddingVertical: 0,
    marginTop: 2,
    height: 24,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },

  // Custom entry
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  customText: {
    fontSize: 14,
    fontFamily: 'Baloo2_500Medium',
    color: '#10b981',
  },

  // Chips — 3-column uniform grid
  chipScroll: {
    flex: 1,
    marginTop: 12,
    maxHeight: 180,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipSelected: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(16,185,129,0.5)',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Baloo2_500Medium',
    color: 'rgba(255,255,255,0.7)',
  },
  chipTextSelected: {
    color: '#fff',
    fontFamily: 'Baloo2_600SemiBold',
  },

  // Confirm
  confirmBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  confirmText: {
    fontSize: 17,
    fontFamily: 'Baloo2_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
})
