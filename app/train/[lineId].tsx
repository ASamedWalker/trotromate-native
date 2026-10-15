import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'
import { Bell, BellRing, Plus, Info, TrainFront, Repeat } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { LoadErrorState } from '@/components/StateViews'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { showReminderFailureAlert, REMINDER_LEAD_MINUTES } from '@/lib/services/trainReminders'
import { timeAgo, getGhanaTime } from '@/lib/utils/time'
import { parseTimeToMinutes } from '@/lib/utils/train'
import {
  TRAIN_SCHEDULES, TRAIN_LINE_INFO, PUBLISHED_FARES, TMP_LAUNCH_FARES, LAUNCH_FARE_LABEL, TMA_FARE_NOTE, TRAIN_CARD_TEXT,
  arrivalLabel, runsOnDay, type TrainSchedule,
} from '@/lib/constants/train-schedule'
import { lineDirections, lineFareLabel } from '@/lib/utils/train-stations'
import { RailNewsList, RailSafetyCard } from '@/components/train/RailNewsSection'
import { LINE_STATUS } from '@/lib/constants/train-network'
import { computeLineDeparture, type DepartureInfo } from '@/app/train/index'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import { BOARD_NAVY, BigCountdown, TimetableChips, ghCedi, useMinuteNow } from '@/components/train/trainTime'
import { HeroText } from '@/components/HeroText'
import type { TrainReportWithNames, CrowdLevel } from '@/lib/types'

/**
 * Train line page. Redesign approved 2026-10-04 (design canvas, "Train line
 * page redesign"): adinkra hero with the next-train board, one direction
 * switch driving one stop list, line facts, rider updates.
 * INFORMATION ONLY (owner, 2026-07-11): no booking, ticketing or payment.
 */

const LINE_TITLES: Record<string, string> = {
  TMA: 'Tema – Accra',
  TMP: 'Tema – Afienya – Adomi',
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

const lastStop = (sc: TrainSchedule) => sc.stops[sc.stops.length - 1]
const destinationOf = (sc: TrainSchedule) => lastStop(sc).station


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
  const [pickedDir, setPickedDir] = useState<string | null>(null) // direction key "origin>destination"
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // T1: re-render on the minute boundary only — countdowns never show seconds.
  useMinuteNow()

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

  // ── Direction switch + stop list (runs grouped by origin → destination) ──
  const info = TRAIN_LINE_INFO[code]
  const directions = lineDirections(code)
  const depKey = dep && dep.type !== 'no-service' ? `${dep.schedule.stops[0].station}>${destinationOf(dep.schedule)}` : null
  const selectedDir = directions.find((g) => g.key === pickedDir) ?? directions.find((g) => g.key === depKey) ?? directions[0]
  const selected = selectedDir?.runs[0] ?? first
  const stationCount = info?.stations.length ?? Math.max(0, ...schedules.map((sc) => sc.stops.length))
  const hasTimetable = schedules.length > 0
  const days = (info?.days ?? first?.days ?? '').replace(/ – /g, '–')
  const fareText = code === 'TMA' ? 'Fare unconfirmed' : lineFareLabel(code)
  const fares = PUBLISHED_FARES.filter((f) => f.lineCode === code && f.basis === 'grda')
  const status = LINE_STATUS[code]
  // First run on the next day this line runs (no-service board).
  const nextServiceRun = (() => {
    for (let add = 1; add <= 7; add++) {
      const d = (ghana.day + add) % 7
      const run = schedules.find((sc) => runsOnDay(sc.days, d))
      if (run) return { run, day: add === 1 ? 'Tomorrow' : DAY_NAMES[d] }
    }
    return null
  })()
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
            <Text style={s.heroMeta}>{ghCedi([stationCount > 0 ? `${stationCount} stations` : null, days, fareText].filter(Boolean).join(' · '))}</Text>

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
                  {departDay(dep.remaining) ? (
                    <View style={s.boardRow}>
                      <HeroText size={56} style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{dep.departTime}</HeroText>
                      <Text style={s.boardWhen}>{departDay(dep.remaining)}</Text>
                    </View>
                  ) : (
                    <BigCountdown minutes={Math.ceil(dep.remaining / 60)} departTime={dep.departTime} />
                  )}
                  <Text style={s.boardSub}>
                    From {dep.origin} · arrives {dep.destination} {arrivalLabel(dep.schedule)} · {dep.schedule.fare !== null ? `GH₵${dep.schedule.fare}` : 'Fare unconfirmed'}
                  </Text>
                  <TimetableChips />
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
                      {reminderSet(dep.schedule.id) ? <BellRing size={18} color={BOARD_NAVY} /> : <Bell size={18} color={BOARD_NAVY} />}
                      <Text style={s.remindText}>
                        {reminderSet(dep.schedule.id) ? `Reminder set · ${REMINDER_LEAD_MINUTES} min before` : `Remind me before the ${dep.departTime}`}
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
                  <TimetableChips />
                </>
              ) : (
                <>
                  <HeroText size={22} style={{ color: '#FFFFFF' }}>No trains on {DAY_NAMES[ghana.day]}</HeroText>
                  {nextServiceRun && (
                    <Text style={s.boardSub}>
                      Next: <Text style={{ fontFamily: font.bold, color: '#FFFFFF' }}>{nextServiceRun.day} {nextServiceRun.run.stops[0].depart}</Text> from {nextServiceRun.run.stops[0].station}
                    </Text>
                  )}
                  <TimetableChips />
                  <Text style={s.boardNote}>Confirm at the station.</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Shuttle lines: change point ── */}
          {info?.changeAt && (
            <View style={s.changeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Repeat size={18} color="#92400E" />
                <Text style={s.changeTitle}>Change at {info.changeAt}</Text>
              </View>
              {info.notes.map((n) => <Text key={n} style={s.changeText}>• {ghCedi(n)}</Text>)}
            </View>
          )}

          {/* ── Stops & times ── */}
          {selected && selectedDir && (
            <View style={s.section}>
              <Text style={s.h2}>Stops &amp; times</Text>
              {directions.length > 1 && (
                <View style={s.seg} accessibilityRole="tablist">
                  {directions.map((g) => {
                    const on = g.key === selectedDir.key
                    return (
                      <TouchableOpacity
                        key={g.key}
                        onPress={() => { Haptics.selectionAsync(); setPickedDir(g.key) }}
                        style={[s.segBtn, directions.length > 2 && s.segBtnHalf, on && s.segOn]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${g.origin} to ${g.destination}`}
                      >
                        <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {g.origin} → {g.destination}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
              <View style={s.card}>
                <Text style={s.cardTitle}>Timetable</Text>
                {selectedDir.runs.map((r, i) => (
                  <View key={r.id} style={[s.runRow, i > 0 && s.divider]}>
                    <Text style={s.stopTime}>{r.stops[0].depart} → {arrivalLabel(r)}</Text>
                    {r.note ? <Text style={s.stopSub}>{r.note}</Text> : null}
                  </View>
                ))}
              </View>
              <View style={s.card}>
                {selected.stops.map((st, i) => {
                  const terminal = i === 0 || i === selected.stops.length - 1
                  // Per-stop times only when the run list has one run or the
                  // timetable publishes them (TMA); else GRDA lists end times only.
                  const ownTime = selectedDir.runs.length === 1 || code === 'TMA' ? (i === 0 ? st.depart : st.arrive) ?? st.depart : null
                  return (
                    <View key={`${selected.id}-${st.station}`} style={s.stopRow} accessible accessibilityLabel={`${st.station}${ownTime ? `, ${ownTime}` : terminal ? '' : ', time not published'}`}>
                      <View style={s.stopRail}>
                        <View style={[s.stopDot, terminal && s.stopDotEnd]} />
                        {i < selected.stops.length - 1 && <View style={s.stopLine} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopName}>{st.station}</Text>
                        {i === 0 && <Text style={s.stopSub}>Departs</Text>}
                        {i === selected.stops.length - 1 && <Text style={s.stopSub}>Arrives</Text>}
                        {!terminal && !ownTime && code !== 'TMA' && <Text style={s.stopSub}>Time not published</Text>}
                      </View>
                      {ownTime ? <Text style={s.stopTime}>{ownTime}</Text> : null}
                    </View>
                  )
                })}
                <Text style={s.verified}>Timetable · not live tracking · {info?.source ?? 'confirm at the station'}</Text>
                {status?.fareConfidence === 'unverified' && status.fareNote && (
                  <View style={s.fareNote}>
                    <Info size={16} color="#7A4B00" />
                    <Text style={s.fareNoteText}>{ghCedi(status.fareNote)}</Text>
                  </View>
                )}
              </View>
              <View style={[s.card, { gap: 6 }]}>
                <Text style={s.cardTitle}>Fares</Text>
                {fares.map((f) => (
                  <View key={`${f.from}-${f.to}`} style={s.zoneRow}>
                    <Text style={s.cardText}>{f.from} – {f.to}</Text>
                    <Text style={s.zoneFare}>GH₵{f.adult}{f.child !== null ? ` · child GH₵${f.child}` : ''}</Text>
                  </View>
                ))}
                {code === 'TMA' && <Text style={s.cardText}>{ghCedi(TMA_FARE_NOTE)}</Text>}
                {code === 'TMP' && (
                  <>
                    <Text style={s.cardText}>Other Afienya–Adomi stops: not published · confirm at station.</Text>
                    <Text style={s.stopSub}>
                      Reported at launch: {TMP_LAUNCH_FARES.map((f) => `${f.from}–${f.to} GH₵${f.adult}`).join(', ')} ({LAUNCH_FARE_LABEL}).
                    </Text>
                  </>
                )}
                <Text style={s.stopSub}>{ghCedi(TRAIN_CARD_TEXT)}</Text>
              </View>
            </View>
          )}

          {/* ── About this line ── */}
          {status && (
            <View style={s.section}>
              <Text style={s.h2}>About this line</Text>
              <View style={[s.card, { gap: 8 }]}>
                <Text style={s.cardTitle}>{status.statusNote}</Text>
                {status.facts.map((f) => (
                  <Text key={f} style={s.fact}>• {ghCedi(f)}</Text>
                ))}
              </View>
            </View>
          )}

          {/* ── Line news + safety (static, curated) ── */}
          <RailNewsList lineCode={code} limit={4} title="Line news" />
          <RailSafetyCard />

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
  kindPill: { alignSelf: 'flex-start', backgroundColor: '#FF4D1C', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  kindText: { fontSize: 13, fontFamily: font.bold, letterSpacing: 1, color: '#1C1917' },
  heroTitle: { fontSize: 30, fontFamily: font.extrabold, color: '#FFFFFF', letterSpacing: -0.5 },
  heroMeta: { fontSize: 15, fontFamily: font.medium, color: '#D6CFC8' },

  board: { marginTop: 4, backgroundColor: BOARD_NAVY, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  boardKicker: { fontSize: 12, fontFamily: font.extrabold, letterSpacing: 0.7, color: 'rgba(255,255,255,0.75)' },
  boardRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 8 },
  boardWhen: { fontSize: 17, fontFamily: font.bold, color: '#FFFFFF', marginBottom: 13 },
  boardTitle: { fontSize: 26, lineHeight: 34, fontFamily: font.extrabold, color: '#FFFFFF' },
  boardSub: { fontSize: 15, fontFamily: font.medium, color: '#D6CFC8' },
  boardNote: { fontSize: 13, fontFamily: font.medium, color: '#A8A29E' },
  remindBtn: {
    marginTop: 10, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  remindOn: { backgroundColor: '#FFFFFF' },
  remindText: { fontSize: 16, fontFamily: font.bold, color: BOARD_NAVY },

  body: { paddingHorizontal: space.gutter, paddingTop: 18, gap: 24 },
  section: { gap: 10 },
  h2: { fontSize: 22, fontFamily: font.extrabold, color: ui.text },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md, ...cardShadow },
  cardTitle: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  cardText: { ...type.label, color: ui.textSecondary },

  seg: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#F0EBE6', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segBtnHalf: { flexBasis: '48%', flexGrow: 1 },
  runRow: { paddingVertical: 8, gap: 2 },
  changeCard: { backgroundColor: '#FFF7E6', borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#F5A300', padding: space.md, gap: 6 },
  changeTitle: { fontSize: 17, fontFamily: font.extrabold, color: ui.text },
  changeText: { ...type.label, color: '#44403C' },
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
