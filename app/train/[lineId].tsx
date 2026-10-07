import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'
import { Bell, BellRing, Plus, Info, TrainFront } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { LoadErrorState } from '@/components/StateViews'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { showReminderFailureAlert, REMINDER_LEAD_MINUTES } from '@/lib/services/trainReminders'
import { timeAgo, getGhanaTime } from '@/lib/utils/time'
import { parseTimeToMinutes } from '@/lib/utils/train'
import { formatGHS } from '@/lib/utils/currency'
import { TRAIN_SCHEDULES, TMP_ZONE_FARES, SCHEDULE_VERIFIED, type TrainSchedule } from '@/lib/constants/train-schedule'
import { LINE_STATUS } from '@/lib/constants/train-network'
import { computeLineDeparture, type DepartureInfo } from '@/app/train/index'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import type { TrainReportWithNames, CrowdLevel } from '@/lib/types'

/**
 * Train line page. Redesign approved 2026-10-04 (design canvas, "Train line
 * page redesign"): adinkra hero with the next-train board, one direction
 * switch driving one stop list, line facts, rider updates.
 * INFORMATION ONLY (owner, 2026-07-11): no booking, ticketing or payment.
 */

const LINE_TITLES: Record<string, string> = {
  TMA: 'Tema – Accra',
  TMP: 'Tema – Mpakadan',
  STK: 'Sekondi – Takoradi',
}
const CROWD_LABELS: Record<CrowdLevel, string> = { empty: 'empty', few_seats: 'few seats', standing: 'standing room only', packed: 'packed' }
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const HERO_PATTERN_H = 460
const heroPatternCache = new Map<number, string>()
function heroPattern(w: number): string {
  let xml = heroPatternCache.get(w)
  if (!xml) { xml = adinkraPatternXml(w, HERO_PATTERN_H, 26, 'rgba(255,255,255,0.07)'); heroPatternCache.set(w, xml) }
  return xml
}

// Read the date straight from 'YYYY-MM-DD' — new Date() would shift it by the
// phone's time zone (showed 14 Sep for 2026-09-15 west of Greenwich).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const verifiedLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

const lastStop = (sc: TrainSchedule) => sc.stops[sc.stops.length - 1]
const destinationOf = (sc: TrainSchedule) => lastStop(sc).station

function formatCountdown(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60))
  if (m < 1) return 'departing now'
  if (m < 60) return `in ${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `in ${h} h ${m % 60} min` : `in ${h} h`
}

function reportText(r: TrainReportWithNames, schedules: TrainSchedule[]): string {
  const at = r.station_name || 'this station'
  if (r.report_type === 'crowd' && r.crowd_level) return `Train is ${CROWD_LABELS[r.crowd_level as CrowdLevel] ?? r.crowd_level} at ${at}.`
  if (r.report_type === 'delay' && r.delay_mins) return `Train running about ${r.delay_mins} minutes late at ${at}.`
  if (r.report_type === 'schedule') {
    const sc = schedules.find((s) => s.direction === r.direction)
    return `Train spotted at ${at}${sc ? `, heading to ${destinationOf(sc)}` : ''}.`
  }
  return `Update from ${at}.`
}

export default function LineDetailScreen() {
  const { lineId } = useLocalSearchParams<{ lineId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { line, recentReports, isLoading, isError, refetch } = useTrainLineDetail(lineId!)
  const { isSet: reminderSet, toggle: toggleReminder } = useDepartureReminders()
  const [heroW, setHeroW] = useState(0)
  const [pickedDir, setPickedDir] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Re-render every 30 s so the countdown and board state stay current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const code = line?.code ?? ''
  const schedules = useMemo(
    () => [...(TRAIN_SCHEDULES[code] ?? [])].sort((a, b) => parseTimeToMinutes(a.stops[0].depart!) - parseTimeToMinutes(b.stops[0].depart!)),
    [code],
  )

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><TrainFront size={40} color={ui.textTertiary} /></View>
      </SafeAreaView>
    )
  }
  if (isError && !line) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadErrorState message="Couldn't load this train line. Check your connection." onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    )
  }
  if (!line) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}><Text style={s.h2}>Line not found</Text></View>
      </SafeAreaView>
    )
  }

  // ── Board: next train across both directions ──
  const ghana = getGhanaTime()
  const nowMins = ghana.hours * 60 + ghana.minutes
  let dep: DepartureInfo | null = schedules.length ? computeLineDeparture(code, schedules) : null
  // While one run is on its way, a later run today is still the "next train".
  const laterToday = schedules.find((sc) => parseTimeToMinutes(sc.stops[0].depart!) > nowMins)
  if (dep?.type === 'in-transit' && laterToday) {
    const depMins = parseTimeToMinutes(laterToday.stops[0].depart!)
    dep = {
      type: 'waiting', lineCode: code, schedule: laterToday,
      remaining: (depMins - nowMins) * 60 - ghana.seconds,
      origin: laterToday.stops[0].station, destination: destinationOf(laterToday), departTime: laterToday.stops[0].depart!,
    }
  }
  const departDay = (secondsAhead: number) => {
    const daysAhead = Math.floor((nowMins * 60 + ghana.seconds + secondsAhead) / 86400)
    return daysAhead <= 0 ? null : daysAhead === 1 ? 'Tomorrow' : DAY_NAMES[(ghana.day + daysAhead) % 7]
  }
  const first = schedules[0]

  // ── Direction switch + stop list ──
  const selected =
    schedules.find((sc) => sc.id === pickedDir) ??
    (dep && dep.type !== 'no-service' ? dep.schedule : null) ??
    first
  const stationCount = Math.max(0, ...schedules.map((sc) => sc.stops.length))
  const hasTimetable = schedules.length > 0
  const days = first?.days.replace(/\s/g, '') ?? ''
  const zoneFares = TMP_ZONE_FARES.map((z) => z.fare)
  const fareText = code === 'TMP' ? `${formatGHS(Math.min(...zoneFares))}–${Math.max(...zoneFares)}` : first ? formatGHS(first.fare) : ''
  const status = LINE_STATUS[code]
  const title = LINE_TITLES[code] ?? line.name

  const toggle = async (sc: TrainSchedule, origin: string) => {
    if (pending) return
    Haptics.selectionAsync()
    // Recompute from the clock at tap time (the screen only re-renders every 30 s).
    const fresh = computeLineDeparture(code, schedules)
    const g = getGhanaTime()
    const secondsUntil = fresh.type === 'waiting' && fresh.schedule.id === sc.id
      ? fresh.remaining
      : (parseTimeToMinutes(sc.stops[0].depart!) - (g.hours * 60 + g.minutes)) * 60 - g.seconds
    setPending(true)
    try {
      const { on, failure } = await toggleReminder({
        scheduleId: sc.id, lineCode: sc.code, origin, destination: destinationOf(sc),
        departTime: sc.stops[0].depart!, secondsUntilDeparture: secondsUntil,
      })
      if (failure) showReminderFailureAlert(failure)
      else if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      showReminderFailureAlert('denied')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#FFFFFF" onRefresh={async () => { setRefreshing(true); try { await refetch() } finally { setRefreshing(false) } }} />}
      >
        {/* ── Hero: adinkra print + next-train board ── */}
        <View style={[s.hero, { paddingTop: insets.top + 8 }]} onLayout={(e) => setHeroW(Math.round(e.nativeEvent.layout.width))}>
          <LinearGradient colors={['#2A1D14', '#16110D']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFillObject} />
          {heroW > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={heroPattern(heroW)} width={heroW} height={HERO_PATTERN_H} />
            </View>
          )}
          <View style={{ gap: 10 }}>
            <BackButton variant="floating" tone="dark" />
            <View style={s.kindPill}><Text style={s.kindText}>GRDA TRAIN</Text></View>
            <Text style={s.heroTitle}>{title}</Text>
            <Text style={s.heroMeta}>{[stationCount > 0 ? `${stationCount} stations` : null, days, fareText].filter(Boolean).join(' · ')}</Text>

            <View style={s.board}>
              {!hasTimetable ? (
                <>
                  <Text style={s.boardKicker}>TIMETABLE</Text>
                  <Text style={s.boardTitle}>Timetable not available yet</Text>
                  <Text style={s.boardSub}>Check times at the station. Seen the train? Share an update below.</Text>
                </>
              ) : dep?.type === 'waiting' ? (
                <>
                  <Text style={s.boardKicker}>NEXT TRAIN · TO {dep.destination.toUpperCase()}</Text>
                  <View style={s.boardRow}>
                    <Text style={s.boardTime}>{dep.departTime}</Text>
                    <Text style={s.boardWhen}>{departDay(dep.remaining) ?? formatCountdown(dep.remaining)}</Text>
                  </View>
                  <Text style={s.boardSub}>
                    From {dep.origin} · arrives {dep.destination} {lastStop(dep.schedule).arrive}{dep.schedule.fare ? ` · ${code === 'TMP' ? fareText : formatGHS(dep.schedule.fare)}` : ''}
                  </Text>
                  {/* Same rule as the Train tab: no reminder offer inside the lead window. */}
                  {(reminderSet(dep.schedule.id) || dep.remaining > REMINDER_LEAD_MINUTES * 60) && (
                    <TouchableOpacity
                      onPress={() => dep?.type === 'waiting' && toggle(dep.schedule, dep.origin)}
                      disabled={pending}
                      style={[s.remindBtn, reminderSet(dep.schedule.id) && s.remindOn]}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: reminderSet(dep.schedule.id), disabled: pending }}
                      accessibilityLabel={`Remind me ${REMINDER_LEAD_MINUTES} minutes before the ${dep.departTime} train`}
                    >
                      {reminderSet(dep.schedule.id) ? <BellRing size={18} color="#FFFFFF" /> : <Bell size={18} color="#FFFFFF" />}
                      <Text style={s.remindText}>
                        {reminderSet(dep.schedule.id) ? `Reminder set · ${REMINDER_LEAD_MINUTES} min before` : `Remind me ${REMINDER_LEAD_MINUTES} min before`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : dep?.type === 'in-transit' ? (
                <>
                  <Text style={s.boardKicker}>ON ITS WAY · TO {dep.destination.toUpperCase()}</Text>
                  <Text style={s.boardTitle}>Near {dep.currentStation}</Text>
                  <Text style={s.boardSub}>
                    {dep.nextStation ? `Next stop ${dep.nextStation}${dep.nextArrival ? ` at ${dep.nextArrival}` : ''} · ` : ''}arrives {dep.destination} {dep.arrivalTime}
                  </Text>
                  <Text style={s.boardNote}>Scheduled position, not live tracking.</Text>
                </>
              ) : (
                <>
                  <Text style={s.boardKicker}>NO TRAINS TODAY</Text>
                  <Text style={s.boardTitle}>{ghana.day === 0 ? 'No service on Sundays' : 'No service today'}</Text>
                  {first && (
                    <Text style={s.boardSub}>
                      Next train: <Text style={{ fontFamily: font.bold, color: '#FFFFFF' }}>Monday {first.stops[0].depart}</Text> from {first.stops[0].station}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Stops & times ── */}
          {selected && (
            <View style={s.section}>
              <Text style={s.h2}>Stops &amp; times</Text>
              {schedules.length > 1 && (
                <View style={s.seg} accessibilityRole="tablist">
                  {schedules.map((sc) => {
                    const on = sc.id === selected.id
                    return (
                      <TouchableOpacity
                        key={sc.id}
                        onPress={() => { Haptics.selectionAsync(); setPickedDir(sc.id) }}
                        style={[s.segBtn, on && s.segOn]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          To {destinationOf(sc)} · {sc.stops[0].depart}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
              <View style={s.card}>
                {selected.stops.map((st, i) => {
                  const terminal = i === 0 || i === selected.stops.length - 1
                  const time = st.depart ?? st.arrive
                  return (
                    <View key={`${selected.id}-${st.station}`} style={s.stopRow} accessible accessibilityLabel={`${st.station}, ${i === 0 ? 'departs' : 'arrives'} ${time}`}>
                      <View style={s.stopRail}>
                        <View style={[s.stopDot, terminal && s.stopDotEnd]} />
                        {i < selected.stops.length - 1 && <View style={s.stopLine} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopName}>{st.station}</Text>
                        {i === 0 && <Text style={s.stopSub}>Departs</Text>}
                        {i === selected.stops.length - 1 && <Text style={s.stopSub}>Arrives</Text>}
                      </View>
                      <Text style={s.stopTime}>{(i === 0 ? st.depart : st.arrive) ?? time}</Text>
                    </View>
                  )
                })}
                <Text style={s.verified}>All times scheduled · GRDA timetable verified {verifiedLabel(SCHEDULE_VERIFIED)} · confirm at the station</Text>
                {status?.fareConfidence === 'unverified' && status.fareNote && (
                  <View style={s.fareNote}>
                    <Info size={16} color="#7A4B00" />
                    <Text style={s.fareNoteText}>{status.fareNote}</Text>
                  </View>
                )}
                {code === 'TMP' && (
                  <View style={{ marginTop: space.md, gap: 4 }}>
                    <Text style={s.cardTitle}>Zone fares</Text>
                    {TMP_ZONE_FARES.map((z) => (
                      <View key={`${z.from}-${z.to}`} style={s.zoneRow}>
                        <Text style={s.cardText}>{z.from} → {z.to}</Text>
                        <Text style={s.zoneFare}>{formatGHS(z.fare)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── About this line ── */}
          {status && (
            <View style={s.section}>
              <Text style={s.h2}>About this line</Text>
              <View style={[s.card, { gap: 8 }]}>
                <Text style={s.cardTitle}>{status.statusNote}</Text>
                {[...status.facts, ...(status.facts.some((f) => /tap\s*n/i.test(f)) ? [] : ['Fares are paid at the station (TapnGo).'])].map((f) => (
                  <Text key={f} style={s.fact}>• {f}</Text>
                ))}
              </View>
            </View>
          )}

          {/* ── Rider updates ── */}
          <View style={s.section}>
            <Text style={s.h2}>Rider updates</Text>
            <View style={s.card}>
              {recentReports.length === 0 ? (
                <Text style={s.cardText}>No rider updates yet. Seen the train? Tell other riders.</Text>
              ) : recentReports.slice(0, 3).map((r, i) => (
                <View key={r.id} style={[s.update, i > 0 && s.divider]}>
                  <Text style={s.updateAge}>{timeAgo(r.reported_at)}</Text>
                  <Text style={s.updateText}>{reportText(r, schedules)}</Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/report/train', params: { lineId: line.id } })}
                style={s.shareBtn}
                accessibilityRole="button"
              >
                <Plus size={18} color={ui.text} />
                <Text style={s.shareText}>Share an update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F2' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { paddingHorizontal: space.gutter, paddingBottom: 20, overflow: 'hidden', backgroundColor: '#16110D' },
  kindPill: { alignSelf: 'flex-start', backgroundColor: '#F5A300', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  kindText: { fontSize: 13, fontFamily: font.bold, letterSpacing: 1, color: '#1C1917' },
  heroTitle: { fontSize: 30, fontFamily: font.extrabold, color: '#FFFFFF', letterSpacing: -0.5 },
  heroMeta: { fontSize: 15, fontFamily: font.medium, color: '#D6CFC8' },

  board: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 16, gap: 4 },
  boardKicker: { fontSize: 13, fontFamily: font.bold, letterSpacing: 1.2, color: '#F5A300' },
  boardRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  boardTime: { fontSize: 42, fontFamily: font.extrabold, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  boardWhen: { fontSize: 18, fontFamily: font.bold, color: '#FFFFFF' },
  boardTitle: { fontSize: 26, fontFamily: font.extrabold, color: '#FFFFFF' },
  boardSub: { fontSize: 15, fontFamily: font.medium, color: '#D6CFC8' },
  boardNote: { fontSize: 13, fontFamily: font.medium, color: '#A8A29E' },
  remindBtn: {
    marginTop: 8, minHeight: 46, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  remindOn: { backgroundColor: brand.orange, borderColor: brand.orange },
  remindText: { fontSize: 16, fontFamily: font.bold, color: '#FFFFFF' },

  body: { paddingHorizontal: space.gutter, paddingTop: 18, gap: 24 },
  section: { gap: 10 },
  h2: { fontSize: 22, fontFamily: font.extrabold, color: ui.text },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md, ...cardShadow },
  cardTitle: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  cardText: { ...type.label, color: ui.textSecondary },

  seg: { flexDirection: 'row', backgroundColor: '#F0EBE6', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 15, fontFamily: font.bold, color: ui.textSecondary },
  segTextOn: { color: ui.text },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  stopRail: { width: 16, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: brand.orange, backgroundColor: '#FFFFFF', zIndex: 1 },
  stopDotEnd: { width: 16, height: 16, borderRadius: 8, backgroundColor: brand.orange },
  stopLine: { position: 'absolute', top: '50%', bottom: -24, width: 3, backgroundColor: '#F5C9B8' },
  stopName: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  stopSub: { ...type.caption, color: ui.textSecondary },
  stopTime: { fontSize: 17, fontFamily: font.extrabold, color: ui.text, fontVariant: ['tabular-nums'] },
  verified: { ...type.caption, color: ui.textSecondary, marginTop: space.sm },
  fareNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: space.sm, padding: 12, borderRadius: radius.md, backgroundColor: '#FFF7E6' },
  fareNoteText: { flex: 1, ...type.label, color: '#7A4B00' },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between' },
  zoneFare: { ...type.labelStrong, color: ui.text },

  fact: { ...type.body, color: ui.text },
  update: { paddingVertical: 8, gap: 2 },
  updateAge: { ...type.caption, color: ui.textSecondary },
  updateText: { ...type.body, color: ui.text },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.surfaceStrong },
  shareBtn: {
    marginTop: space.md, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: ui.surfaceStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  shareText: { fontSize: 16, fontFamily: font.bold, color: ui.text },
})
