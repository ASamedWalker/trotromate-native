import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, WifiOff, ShieldCheck } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { font } from '@/lib/theme'

// Lazy-require so a dev client without the native module (pre-rebuild) doesn't
// crash. Probe the native side first (requireOptionalNativeModule never throws)
// so we never require the JS wrapper when the module is absent — that throw
// would trip a dev redbox.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function brightnessMod(): any | null {
  if (!requireOptionalNativeModule('ExpoBrightness')) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-brightness')
  } catch { return null }
}
import { formatGHS } from '@/lib/utils/currency'
import { formatPassExpiry, type ActivePass } from '@/lib/services/tickets'
import { getCachedPasses } from '@/lib/services/ticketCache'

const BRAND = '#FF4D1C'

/**
 * Full-screen boarding ticket — the QR the conductor scans. Reads from the
 * LOCAL cache so it works with no network (trotros have poor signal). Bumps
 * screen brightness so the QR scans easily.
 */
export default function TicketScreen() {
  const router = useRouter()
  const { trip_code } = useLocalSearchParams<{ trip_code?: string }>()
  const [pass, setPass] = useState<ActivePass | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCachedPasses().then((passes) => {
      setPass(passes.find((p) => p.trip_code === trip_code) ?? passes[0] ?? null)
      setLoading(false)
    })
  }, [trip_code])

  // Max brightness while the QR is shown (restored on leave) so it scans easily
  // in a dim trotro. Best-effort — needs a native build with expo-brightness.
  useEffect(() => {
    const Brightness = brightnessMod()
    if (!Brightness) return
    let prev: number | null = null
    let active = true
    ;(async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync()
        if (status !== 'granted' || !active) return
        prev = await Brightness.getBrightnessAsync()
        await Brightness.setBrightnessAsync(1)
      } catch { /* denied — ignore */ }
    })()
    return () => {
      active = false
      if (prev != null) Brightness.setBrightnessAsync(prev).catch(() => {})
    }
  }, [])

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Your Ticket</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : !pass ? (
        <View style={s.center}>
          <Text style={s.noneTitle}>No active ticket</Text>
          <Text style={s.noneSub}>Book a trip to get a ticket you can show the conductor.</Text>
        </View>
      ) : (
        <View style={s.body}>
          <View style={s.routeRow}>
            <Text style={s.route} numberOfLines={1}>{pass.route_label}</Text>
          </View>

          <View style={s.qrCard}>
            <QRCode value={pass.trip_code} size={240} />
            <Text style={s.code}>{pass.trip_code}</Text>
          </View>

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>FARE</Text>
              <Text style={s.metaValue}>{formatGHS(pass.fare)}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>EXPIRES</Text>
              <Text style={s.metaValue}>{formatPassExpiry(pass.expires_at)}</Text>
            </View>
            {pass.van_plate ? (
              <>
                <View style={s.metaDivider} />
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>VAN</Text>
                  <Text style={s.metaValue}>{pass.van_plate}</Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={s.offlineRow}>
            <WifiOff size={14} color="#6B7280" />
            <Text style={s.offlineText}>Works offline — show this even with no signal</Text>
          </View>
          <View style={s.verifiedRow}>
            <ShieldCheck size={14} color="#16a34a" />
            <Text style={s.verifiedText}>Paid · valid until expiry</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: '#111' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  noneTitle: { fontFamily: font.bold, fontSize: 18, color: '#111' },
  noneSub: { fontFamily: font.regular, fontSize: 14, color: '#6B7280', textAlign: 'center' },

  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, gap: 24 },
  routeRow: { alignItems: 'center' },
  route: { fontFamily: font.extrabold, fontSize: 24, color: '#111', letterSpacing: -0.5 },
  qrCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  code: { fontFamily: font.bold, fontSize: 16, color: '#111', letterSpacing: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  metaItem: { flex: 1, alignItems: 'center', gap: 4 },
  metaLabel: { fontFamily: font.bold, fontSize: 10, color: '#6B7280', letterSpacing: 1 },
  metaValue: { fontFamily: font.bold, fontSize: 14, color: '#111' },
  metaDivider: { width: 1, height: 28, backgroundColor: '#F3F4F6' },

  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineText: { fontFamily: font.medium, fontSize: 12, color: '#6B7280' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -16 },
  verifiedText: { fontFamily: font.semibold, fontSize: 12, color: '#16a34a' },
})
