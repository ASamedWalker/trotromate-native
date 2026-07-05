import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Mapbox from '@rnmapbox/maps'
import { X, Zap, Crosshair, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import { font } from '@/lib/theme'
import { useLocation } from '@/lib/hooks/useLocation'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { submitEvStation, type EvKind } from '@/lib/services/ev-charging'

const EV_GREEN = '#16a34a'
const MAP_STYLE = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const ACCRA: [number, number] = [-0.187, 5.6037]

const CONNECTORS = ['Type 2 (AC)', 'CCS (DC fast)', 'CHAdeMO', '3-pin / Domestic', 'Battery swap']
const POWERS = [7, 11, 22, 50, 60]

export default function EvReportScreen() {
  const router = useRouter()
  const { location } = useLocation()
  const { deviceId } = useDeviceId()
  const cameraRef = useRef<Mapbox.Camera>(null)

  const [center, setCenter] = useState<[number, number]>(location ? [location.longitude, location.latitude] : ACCRA)
  // Scope (owner): charging stations only for now (truck/swap are future services).
  const kind: EvKind = 'charge'
  const [name, setName] = useState('')
  const [operator, setOperator] = useState('')
  const [connector, setConnector] = useState<string | null>(null)
  const [powerKW, setPowerKW] = useState<number | null>(null)
  const [access, setAccess] = useState<'Public' | 'Private'>('Public')
  const [hasBackup, setHasBackup] = useState(false)
  const [pricing, setPricing] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const recenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const c: [number, number] = [pos.coords.longitude, pos.coords.latitude]
      setCenter(c)
      cameraRef.current?.setCamera({ centerCoordinate: c, zoomLevel: 16, animationDuration: 600 })
    } catch { /* ignore */ }
  }

  const submit = async () => {
    if (!name.trim()) { Alert.alert('Add a name', 'Give the station a name (e.g. Accra Mall charger).'); return }
    if (submitting) return
    setSubmitting(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const id = await submitEvStation({
      name: name.trim(),
      kind,
      lng: center[0],
      lat: center[1],
      operator: operator.trim() || null,
      connector,
      powerKW,
      access,
      pricing: pricing.trim() || null,
      hasBackup,
      notes: notes.trim() || null,
      deviceId,
    })
    setSubmitting(false)
    if (id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Thanks! 🔌', 'Station added. Other riders will see it once a couple of people confirm it.', [
        { text: 'Done', onPress: () => router.back() },
      ])
    } else {
      Alert.alert('Couldn’t submit', 'Please try again. (The EV stations table may not be set up yet.)')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Map with a fixed center crosshair — drop the pin where the station is */}
      <View style={{ height: '42%' }}>
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLE}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
          onCameraChanged={(s: any) => { if (s?.properties?.center) setCenter(s.properties.center) }}
        >
          <Mapbox.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: center, zoomLevel: location ? 15 : 11 }} />
          <Mapbox.UserLocation visible />
        </Mapbox.MapView>
        {/* Fixed crosshair pin */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <View style={styles.pin}><Zap size={18} color="#fff" fill="#fff" /></View>
          <View style={styles.pinStem} />
        </View>
        <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} style={styles.iconBtn} hitSlop={8}>
            <X size={20} color="#0A0A0A" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Add charging station</Text>
          <TouchableOpacity onPress={recenter} style={styles.iconBtn} hitSlop={8}>
            <Crosshair size={19} color={EV_GREEN} />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.hint}><Text style={styles.hintText}>Move the map so the pin sits on the station</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Field label="Name *">
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Accra Mall charger" placeholderTextColor="#6B7280" style={styles.input} />
        </Field>
        <Field label="Operator (optional)">
          <TextInput value={operator} onChangeText={setOperator} placeholder="e.g. GreenDrive, Kofa" placeholderTextColor="#6B7280" style={styles.input} />
        </Field>

        <Field label="Connector">
          <View style={styles.chipWrap}>
            {CONNECTORS.filter((c) => c !== 'Battery swap').map((c) => (
              <Chip key={c} on={connector === c} onPress={() => setConnector(connector === c ? null : c)}>{c}</Chip>
            ))}
          </View>
        </Field>
        <Field label="Power (kW)">
          <View style={styles.chipWrap}>
            {POWERS.map((p) => (
              <Chip key={p} on={powerKW === p} onPress={() => setPowerKW(powerKW === p ? null : p)}>{p} kW</Chip>
            ))}
          </View>
        </Field>

        <Field label="Access">
          <View style={styles.chipWrap}>
            {(['Public', 'Private'] as const).map((a) => (
              <Chip key={a} on={access === a} onPress={() => setAccess(a)}>{a}</Chip>
            ))}
          </View>
        </Field>

        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Has solar / backup power</Text>
            <Text style={styles.fieldHint}>Keeps charging during dumsor</Text>
          </View>
          <Switch value={hasBackup} onValueChange={(v) => { Haptics.selectionAsync(); setHasBackup(v) }} trackColor={{ true: EV_GREEN, false: '#E5E7EB' }} thumbColor="#fff" />
        </View>

        <Field label="Pricing (optional)">
          <TextInput value={pricing} onChangeText={setPricing} placeholder="e.g. GH₵ 2.50 / kWh, or per swap" placeholderTextColor="#6B7280" style={styles.input} />
        </Field>
        <Field label="Notes (optional)">
          <TextInput value={notes} onChangeText={setNotes} placeholder="Landmark, opening hours, anything useful" placeholderTextColor="#6B7280" style={[styles.input, { minHeight: 64 }]} multiline maxLength={280} />
        </Field>

        <TouchableOpacity style={[styles.submit, submitting && { opacity: 0.6 }]} onPress={submit} activeOpacity={0.9} disabled={submitting}>
          <Check size={18} color="#fff" />
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Add station'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  )
}
function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onPress() }} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.85}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{children}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 6 },
  topTitle: { fontFamily: font.bold, fontSize: 16, color: '#0A0A0A', textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 6 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 4 },
  pinWrap: { position: 'absolute', top: 0, bottom: 22, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 38, height: 38, borderRadius: 19, backgroundColor: EV_GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
  pinStem: { width: 2, height: 12, backgroundColor: EV_GREEN },
  hint: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(10,10,10,0.8)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  hintText: { fontFamily: font.medium, fontSize: 11.5, color: '#fff' },

  segment: { flexDirection: 'row', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  segBtnOn: { backgroundColor: EV_GREEN },
  segText: { fontFamily: font.semibold, fontSize: 13.5, color: '#374151' },
  segTextOn: { color: '#fff', fontFamily: font.bold },

  fieldLabel: { fontFamily: font.bold, fontSize: 13.5, color: '#111' },
  fieldHint: { fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 1 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontFamily: font.medium, fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#F0F0F0' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 100, backgroundColor: '#F3F4F6' },
  chipOn: { backgroundColor: 'rgba(22,163,74,0.12)', borderWidth: 1, borderColor: EV_GREEN },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: '#374151' },
  chipTextOn: { color: EV_GREEN },
  rowBetween: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },

  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: EV_GREEN, height: 54, borderRadius: 16, marginTop: 26 },
  submitText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
