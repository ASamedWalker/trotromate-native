import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect, type Href } from 'expo-router'
import { X, Check, Lock, WifiOff, MessageCircle } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { font, brand, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { TicketBand, todayBand, FROZEN_BAND } from '@/components/ticket/TicketBand'
import { hhmm, hhmmss } from '@/lib/utils/clock'
import { SUPPORT_WHATSAPP } from '@/lib/config/support'
import { useApp } from '@/lib/contexts/AppContext'

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
import { fetchMyTickets, type ActivePass } from '@/lib/services/tickets'
import { getCachedPasses, cacheActivePasses } from '@/lib/services/ticketCache'
import { useAuthContext } from '@/lib/contexts/AuthContext'

const RED = '#B91C1C'

/** TK2: ticking hh:mm:ss from the device clock (offline-safe). Own state, so the
 *  QR doesn't re-render every second. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    // Ticks every second: hidden from screen readers so it isn't announced each tick.
    <HeroText size={40} style={s.clock} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {hhmmss(now)}
    </HeroText>
  )
}
const GREEN = '#15803D'

/** "TRK48F2Q91XD" → "TRK4 8F2Q 91XD" (display only; the QR keeps the raw code). */
function groupCode(code: string): string {
  const raw = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (raw.match(/.{1,4}/g) ?? [raw]).join(' ')
}

/**
 * Full-screen boarding ticket — what the mate checks by eye and the QR the
 * conductor scans (UX v2 TK1–TK7). A moving day-coloured Adinkra band and a
 * ticking device clock show it is live; used tickets freeze grey with the QR
 * at 12%; expired tickets hide the QR entirely. Reads from the LOCAL cache so
 * it works with no network, and bumps screen brightness so the QR scans.
 */
export default function TicketScreen() {
  const router = useRouter()
  const { trip_code } = useLocalSearchParams<{ trip_code?: string }>()
  const { user } = useAuthContext()
  const { isOnline } = useApp()
  const [pass, setPass] = useState<ActivePass | null>(null)
  const [usedAt, setUsedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [brightnessDenied, setBrightnessDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCachedPasses().then(async (passes) => {
      // A named ticket must match exactly — never show a different pass's QR.
      const cached = trip_code ? passes.find((p) => p.trip_code === trip_code) ?? null : passes[0] ?? null
      if (cached) {
        // Cache hit — instant path, works offline. No network round-trip needed.
        if (!cancelled) { setPass(cached); setLoading(false) }
        return
      }
      // Cache miss — fall back to the backend before declaring "no ticket".
      if (!user?.id) { if (!cancelled) { setPass(null); setLoading(false) }; return }
      const tickets = await fetchMyTickets(user.id)
      if (cancelled) return
      // A named used/expired ticket opens in its used/expired state (QR faded or
      // hidden). Without a name, only an active ticket is a boarding pass.
      // Cancelled tickets never render.
      const named = trip_code ? tickets?.find((t) => t.trip_code === trip_code && t.status !== 'cancelled') : undefined
      const found = named ?? tickets?.find((t) => t.status === 'active') ?? null
      const matched: ActivePass | null = found && found.status !== 'cancelled' ? {
        trip_code: found.trip_code,
        route_label: found.route_label,
        van_plate: found.van_plate,
        fare: found.fare,
        currency: found.currency,
        status: found.status,
        expires_at: found.expires_at,
      } : null
      if (tickets) setLastPollOk(Date.now())
      setPass(matched)
      setUsedAt(found?.used_at ?? null)
      setLoading(false)
      if (matched && matched.status === 'active') {
        // Write back so the next offline open has it cached.
        cacheActivePasses([matched, ...passes.filter((p) => p.trip_code !== matched.trip_code)])
      }
    })
    return () => { cancelled = true }
  }, [trip_code, user?.id])

  // TK5: flip to "Expired" at expires_at by the device clock — but only when we
  // can't ask the server. A phone with its clock set ahead must not hide a paid
  // ticket's QR, so a server answer from the last 2 min ("active") wins.
  const [lastPollOk, setLastPollOk] = useState<number | null>(null)
  const [pollFailed, setPollFailed] = useState(false)
  const [freshTick, setFreshTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setFreshTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const serverFresh = lastPollOk != null && freshTick - lastPollOk < 120000
  const localExpiryAllowed = !isOnline || !user?.id || (lastPollOk == null ? pollFailed : !serverFresh)
  const expiresMs = pass?.expires_at ? new Date(pass.expires_at).getTime() : NaN
  const [pastExpiry, setPastExpiry] = useState(false)
  useEffect(() => {
    setPastExpiry(false)
    if (!isFinite(expiresMs)) return
    const left = expiresMs - Date.now()
    if (left <= 0) { setPastExpiry(true); return }
    const id = setTimeout(() => setPastExpiry(true), Math.min(left + 250, 2147483000))
    return () => clearTimeout(id)
  }, [expiresMs])
  const kind: 'valid' | 'used' | 'expired' = !pass ? 'valid'
    : pass.status === 'used' ? 'used'
    : pass.status === 'expired' || (pastExpiry && localExpiryAllowed) ? 'expired'
    : 'valid'

  // Re-check the ticket on focus and every 5s while it is still active, so a
  // scan by the conductor flips the screen to "Used" and polling stops.
  const activeCode = pass?.status === 'active' ? pass.trip_code : null
  useFocusEffect(useCallback(() => {
    if (!activeCode || !user?.id) return
    let cancelled = false
    let inFlight = false
    const check = async () => {
      if (inFlight) return // slow trotro signal: never stack requests
      inFlight = true
      const tickets = await fetchMyTickets(user.id).finally(() => { inFlight = false })
      if (cancelled) return
      if (!tickets) { setPollFailed(true); return }
      setPollFailed(false)
      setLastPollOk(Date.now())
      setFreshTick(Date.now())
      const t = tickets.find((x) => x.trip_code === activeCode)
      if (!t || t.status === 'active') return
      if (t.status === 'used' || t.status === 'expired') {
        const next = t.status
        setPass((prev) => (prev && prev.trip_code === activeCode ? { ...prev, status: next } : prev))
        if (t.used_at) setUsedAt(t.used_at)
      } else {
        setPass(null)
      }
      // Drop it from the offline cache so it never reopens as a valid pass.
      getCachedPasses().then((passes) => cacheActivePasses(passes.filter((p) => p.trip_code !== activeCode))).catch(() => {})
    }
    check()
    const id = setInterval(check, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [activeCode, user?.id]))

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
        if (status !== 'granted' || !active) { if (active) setBrightnessDenied(true); return }
        prev = await Brightness.getBrightnessAsync()
        await Brightness.setBrightnessAsync(1)
      } catch { /* denied — ignore */ }
    })()
    return () => {
      active = false
      if (prev != null) Brightness.setBrightnessAsync(prev).catch(() => {})
    }
  }, [])

  const band = todayBand()
  const live = kind === 'valid'
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/wallet' as Href) }
  const bookAnother = () => router.replace('/(tabs)/lines' as Href)

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={close} hitSlop={8} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Close ticket">
          <X size={24} color={ui.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ticket</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={brand.orange} /></View>
      ) : !pass ? (
        <View style={s.center}>
          <Text style={s.noneTitle}>No active ticket</Text>
          <Text style={s.noneSub}>Book a trip to get a ticket you can show the mate.</Text>
        </View>
      ) : (
        <>
          <TicketBand live={live} color={live ? band.hex : FROZEN_BAND} />
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            {/* TK2 / TK4 / TK5: the time line */}
            <View style={s.topBlock}>
              {kind === 'valid' ? (
                <>
                  <LiveClock />
                  <Text style={s.caption}>{band.day} band: {band.name}. It changes every day.</Text>
                </>
              ) : kind === 'used' ? (
                <>
                  <HeroText size={28} style={s.stateTitle}>{usedAt ? `Used at ${hhmm(usedAt)}` : 'Used'}</HeroText>
                  <Text style={s.caption}>Scanned · band stopped</Text>
                </>
              ) : (
                <>
                  <HeroText size={28} style={[s.stateTitle, { color: RED }]}>
                    {pass.expires_at ? `Expired at ${hhmm(pass.expires_at)}` : 'Expired'}
                  </HeroText>
                  <Text style={s.caption}>Not scanned</Text>
                </>
              )}
            </View>

            {/* TK3: route, up to 2 lines, shrinks instead of truncating */}
            <HeroText
              size={32}
              style={s.route}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {pass.route_label}
            </HeroText>

            {/* QR — live, faded under "Scanned · Used", or hidden when expired */}
            <View style={s.qrBlock}>
              {kind === 'expired' ? (
                <View style={s.qrHidden} accessible accessibilityLabel="QR hidden. This ticket can't be used.">
                  <Lock size={28} color={RED} />
                  <Text style={s.qrHiddenTitle}>QR hidden</Text>
                  <Text style={s.qrHiddenSub}>{"This ticket can't be used."}</Text>
                </View>
              ) : (
                <View accessible accessibilityLabel={kind === 'used' ? 'Ticket QR code, already used' : 'Ticket QR code'}>
                  <View style={kind === 'used' ? { opacity: 0.12 } : undefined}>
                    <QRCode value={pass.trip_code} size={220} quietZone={8} backgroundColor="#FFFFFF" />
                  </View>
                  {kind === 'used' && (
                    <View style={s.usedOverlay} pointerEvents="none">
                      <View style={s.usedPill}><Text style={s.usedPillText}>Scanned · Used</Text></View>
                    </View>
                  )}
                </View>
              )}
              <Text style={[s.code, kind !== 'valid' && { opacity: 0.3 }]}>{groupCode(pass.trip_code)}</Text>
            </View>

            {/* Details grid: FARE / VALID TILL / VAN */}
            <View style={s.grid}>
              <View style={s.gridCell}>
                <Text style={s.gridLabel}>FARE</Text>
                <Text style={s.gridValue}>{formatGHS(pass.fare)}</Text>
              </View>
              <View style={s.gridCell}>
                <Text style={s.gridLabel}>VALID TILL</Text>
                <Text style={s.gridValue}>{pass.expires_at ? hhmm(pass.expires_at) : '—'}</Text>
              </View>
              <View style={s.gridCell}>
                <Text style={s.gridLabel}>VAN</Text>
                <Text style={s.gridValue} numberOfLines={1}>{pass.van_plate || 'Any'}</Text>
              </View>
            </View>

            <View style={{ flex: 1, minHeight: 16 }} />

            {kind === 'valid' ? (
              <View style={s.footer}>
                {!isOnline && (
                  <View style={s.offlineChip}>
                    <WifiOff size={14} color={ui.textSecondary} />
                    <Text style={s.offlineText}>Offline · ticket still valid</Text>
                  </View>
                )}
                <View style={s.paidRow}>
                  <Check size={16} color={GREEN} strokeWidth={3} />
                  <Text style={s.paidText}>Paid · works offline</Text>
                </View>
                <Text style={s.hint}>{"Show this to the mate. The moving band shows it's live."}</Text>
                {brightnessDenied && Platform.OS === 'android' && (
                  <Text style={s.hint}>Turn your screen brightness up so the QR scans easily.</Text>
                )}
              </View>
            ) : (
              <View style={s.footer}>
                <TouchableOpacity onPress={bookAnother} activeOpacity={0.9} style={s.darkBtn} accessibilityRole="button">
                  <Text style={s.darkBtnText}>Book another</Text>
                </TouchableOpacity>
                {kind === 'expired' && !!SUPPORT_WHATSAPP && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() => {})}
                    style={s.helpBtn}
                    accessibilityRole="link"
                  >
                    <MessageCircle size={16} color={ui.textSecondary} />
                    <Text style={s.helpText}>Need help? Chat on WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 17, color: ui.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  noneTitle: { fontFamily: font.bold, fontSize: 18, color: ui.text },
  noneSub: { fontFamily: font.regular, fontSize: 14, color: ui.textSecondary, textAlign: 'center' },

  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  topBlock: { alignItems: 'center' },
  clock: { color: ui.text, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  stateTitle: { color: ui.text, textAlign: 'center' },
  caption: { fontFamily: font.medium, fontSize: 12, color: ui.textTertiary, textAlign: 'center' },
  route: { color: ui.text, textAlign: 'center', letterSpacing: -0.5, marginTop: 8 },

  qrBlock: { alignItems: 'center', marginTop: 12 },
  usedOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  usedPill: { backgroundColor: '#0A0A0A', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  usedPillText: { fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' },
  qrHidden: {
    width: 220, height: 220, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 4,
  },
  qrHiddenTitle: { fontFamily: font.bold, fontSize: 16, color: RED, marginTop: 4 },
  qrHiddenSub: { fontFamily: font.medium, fontSize: 14, color: '#57534E', textAlign: 'center' },
  code: { fontFamily: font.bold, fontSize: 15, color: ui.text, letterSpacing: 2, marginTop: 6, fontVariant: ['tabular-nums'] },

  grid: {
    flexDirection: 'row', marginTop: 12, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: ui.hairline,
  },
  gridCell: { flex: 1, gap: 2 },
  gridLabel: { fontFamily: font.bold, fontSize: 12, color: ui.textTertiary, letterSpacing: 0.8 },
  gridValue: { fontFamily: font.bold, fontSize: 15, color: ui.text, fontVariant: ['tabular-nums'] },

  footer: { gap: 6, alignItems: 'center' },
  offlineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ui.surface,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  offlineText: { fontFamily: font.semibold, fontSize: 13, color: ui.textSecondary },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paidText: { fontFamily: font.semibold, fontSize: 14, color: GREEN },
  hint: { fontFamily: font.medium, fontSize: 13, color: ui.textSecondary, textAlign: 'center' },
  darkBtn: { alignSelf: 'stretch', height: 56, borderRadius: 14, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  darkBtnText: { fontFamily: font.bold, fontSize: 16, color: '#FFFFFF' },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 },
  helpText: { fontFamily: font.semibold, fontSize: 13, color: ui.textSecondary },
})
