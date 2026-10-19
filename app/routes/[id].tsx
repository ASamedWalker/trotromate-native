import { useMemo, useRef } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, Animated, AccessibilityInfo } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin, Heart, Receipt, Bell } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { font, brand, ui, space, radius } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { SkeletonRouteDetail } from '@/components/Skeleton'
import { HeroText } from '@/components/HeroText'
import { TicketCard } from '@/components/TicketCard'
import { LoadErrorState } from '@/components/StateViews'
import { FareTrendChart } from '@/components/FareTrendChart'
import { QueueGlyph } from '@/components/QueueGlyph'
import { okadaRange } from '@/components/lines/LineRow'
import { useRouteDetail, useFareTrend } from '@/lib/hooks/useRoutes'
import { fetchStations } from '@/lib/services/stations'
import { corridorFor } from '@/lib/constants/corridors'
import { QUEUE_COLOR, QUEUE_WORD } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { fareSource } from '@/lib/utils/fare-source'
import { useApp } from '@/lib/contexts/AppContext'
import { useAlerts, alertsForRoute } from '@/lib/hooks/useAlerts'
import { AlertRow } from '@/components/AlertRow'
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh'

import { fetchRouteActivity } from '@/lib/services/route-activity'
import { fetchRouteSegmentFares, resolveDropoffFareSync } from '@/lib/services/segment-fares'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { timeAgo } from '@/lib/utils/time'
import { formatGHS, formatGHSRange } from '@/lib/utils/currency'
import { AdinkraCardPattern } from '@/components/AdinkraAccent'
import { titleCase } from '@/lib/utils/title-case'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

/**
 * Line page. UX v2 canvas "Route detail → Proposed" (R1, R3, R4, R5, R7):
 * corridor-colour hero (code, "→ Circle", stops, fare + one label + basis line),
 * a fixed "Queue at <station>" slot, the stops-and-fares timeline in the corridor
 * colour, ONE "Help the next rider" card instead of stacked empty states, the map
 * link with its data cost, and a sticky Report queue / Report fare bar.
 * R2 ("Usually" strip) and R6 (alert windows) need backend and are not built.
 * No GO Mode entry on this page (owner rule, 2026-06-12).
 */
const BAR_H = 76

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const haptics = useHaptics()
  const { isFavorite, toggleFavorite } = useFavorites()

  // Status-bar scrim fades in once the hero scrolls away (core RN Animated).
  const scrollY = useRef(new Animated.Value(0)).current
  const scrimOpacity = scrollY.interpolate({ inputRange: [160, 240], outputRange: [0, 1], extrapolate: 'clamp' })

  const { route, recentReports, isLoading, isError, refetch } = useRouteDetail(id!)
  const stationsQ = useQuery({ queryKey: ['stations'], queryFn: fetchStations, staleTime: 2 * 60 * 1000 })
  const { deviceId } = useApp()
  const { refreshing, onRefresh } = usePullToRefresh([['stations'], ['service-alerts'], ['corridor-rank', deviceId, id]], refetch)
  // Heart "pop" when saving/unsaving.
  const heartScale = useRef(new Animated.Value(1)).current
  const popHeart = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return
      heartScale.setValue(0.7)
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start()
    }).catch(() => {})
  }
  const alertsQ = useAlerts()
  // Your reporter rank on this corridor (30 days) — shown in the Help card (R4) when you have one.
  const rankQ = useQuery({
    queryKey: ['corridor-rank', deviceId, id],
    enabled: !!deviceId && !!id,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ rank: number | null; reports: number }> => {
      const res = await fetch(`${API_URL}/api/reports/rank?device_id=${encodeURIComponent(deviceId!)}&route_id=${encodeURIComponent(id!)}`)
      if (!res.ok) return { rank: null, reports: 0 }
      return res.json()
    },
  })
  const { trend, isLoading: trendLoading, days: trendDays, setDays: setTrendDays } = useFareTrend(id!)
  const { data: segments = [], isFetched: segmentsLoaded } = useQuery({
    queryKey: ['segment-fares', id],
    queryFn: () => fetchRouteSegmentFares(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
  const placeNames = useMemo(() => {
    const names = [route?.from_location, route?.to_location]
    for (const st of route?.stops ?? []) names.push(st.stop_name)
    return names.filter(Boolean) as string[]
  }, [route?.from_location, route?.to_location, route?.stops])
  const { data: activity = [] } = useQuery({
    queryKey: ['route-activity', id, placeNames.join('|')],
    queryFn: () => fetchRouteActivity({ routeId: id!, placeNames, limit: 3 }),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
  const liveTrips = useLiveTripPositions(id)

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <SkeletonRouteDetail isDark={false} />
      </SafeAreaView>
    )
  }
  // Load failure ≠ nonexistent route (UX-14); loaded data stays visible on a failed refetch.
  if (isError && !route) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadErrorState message="Couldn't load this route. Check your connection." onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    )
  }
  if (!route) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.centered}>
          <MapPin size={48} color={ui.textTertiary} />
          <Text style={[s.cardTitle, { marginTop: space.md }]}>Route not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isOkada = (route as { transport_type?: string }).transport_type === 'okada'
  const from = titleCase(route.from_location)
  const to = titleCase(route.to_location)
  const corridor = corridorFor(route.from_location, route.to_location)
  const favorited = isFavorite(id!)

  // ── R1: one fare, one label, one basis line ──
  const src = fareSource(route)
  const reportCount = route.fare_stats?.report_count ?? 0
  const lastAt = route.fare_stats?.last_report_at ?? null
  const range = isOkada ? okadaRange(route) : null
  const officialFare = Number(route.official_fare) || 0
  const avgReported = Number(route.fare_stats?.avg_reported_fare) || 0
  let heroFare: string | null = null
  let heroLabel: string | null = null
  let basis = ''
  let basisWarn = false
  if (isOkada) {
    heroFare = range ? formatGHSRange(range.min, range.max) : null
    heroLabel = range ? 'RIDERS' : null
    basis = range
      ? `From ${reportCount} reports${lastAt ? ` · ${ageLabel(lastAt)}` : ''} · Agree before you ride`
      : 'Agree the fare before you ride'
  } else {
    heroFare = src.amount != null ? `${src.approx ? '~' : ''}${formatGHS(src.amount)}` : null
    heroLabel = src.chip === 'GPRTU' ? 'GPRTU FARE' : src.chip === 'RIDERS' ? 'RIDERS' : null
    const age = lastAt ? ageLabel(lastAt) : ''
    const based = reportCount > 0 ? `Based on ${reportCount} ${reportCount === 1 ? 'report' : 'reports'}` : ''
    if (src.kind === 'agree') basis = [based, 'riders agree', age].filter(Boolean).join(' · ')
    else if (src.kind === 'differ') {
      const pct = Math.round((avgReported / officialFare - 1) * 100)
      basis = `Riders paid ${formatGHS(avgReported)} (${pct > 0 ? '+' : ''}${pct}%)${age ? ` · ${age}` : ''}`
      basisWarn = pct > 0
    } else if (src.kind === 'riders') basis = [based, age].filter(Boolean).join(' · ')
    else if (src.kind === 'gprtu') {
      const when = route.fare_approved_at ? new Date(route.fare_approved_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''
      basis = when ? `GPRTU fare · ${when} · no rider reports yet` : 'No rider reports yet'
    } else basis = 'No fare yet. Be the first to report it.'
  }

  // ── R3: stops with stage fares, board stop → that stop (cumulative) ──
  // Same util + base as the map's alight picker (routes/detail.tsx): stored segment
  // fare → rider average → distance-interpolated estimate. The last stop IS the
  // corridor, so it always shows the hero fare (GH₵ 8.70 on MAD·CIR), never an estimate.
  const stops = [...(route.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order)
  const firstOrder = stops[0]?.stop_order ?? 0
  const corridorFare = src.amount ?? (officialFare > 0 ? officialFare : 0)
  const stageFares = stops.map((st, i) => {
    if (i === 0) return null
    if (i === stops.length - 1) {
      return corridorFare > 0 ? { fare: corridorFare, source: src.chip === 'GPRTU' ? 'official' : 'reported' } : null
    }
    // Wait for the segment prefetch so an estimate never flashes before an official stage fare.
    if (!segmentsLoaded || !(corridorFare > 0)) return null
    const f = resolveDropoffFareSync(segments, firstOrder, st.stop_order, stops, corridorFare)
    if (f.source === 'corridor' || !(f.fare > 0)) return null
    // Distance-interpolated fares are guesses: round to Ghana's 50-pesewa steps.
    // Below GH₵2 the guess is noise ("GH₵0.50 est." one stop out), so show "—" with
    // no chip. Stored stage fares (official / reported) always show.
    if (f.source === 'interpolated') {
      const rounded = Math.round(f.fare * 2) / 2
      return rounded < MIN_EST_STAGE_FARE ? { fare: null, source: f.source } : { ...f, fare: rounded }
    }
    return f
  })
  const isEst = (source: string) => source !== 'official' && source !== 'reported'

  // ── Queue at the boarding station, matched by name like the server's commute card ──
  const boardKey = route.from_location.trim().toLowerCase()
  const stationList = stationsQ.data ?? []
  const prefixMatches = boardKey ? stationList.filter((st) => st.name.trim().toLowerCase().startsWith(boardKey)) : []
  const boardStat = boardKey
    ? stationList.find((st) => st.name.trim().toLowerCase() === boardKey) ?? (prefixMatches.length === 1 ? prefixMatches[0] : undefined)
    : undefined
  const q = boardStat?.queue_stats?.[0]
  const qFresh = q ? freshness(q.last_report_at) : 'stale'
  const boardName = boardStat?.name ?? from

  const goReportFare = () => {
    haptics.light()
    router.push({ pathname: '/report/fare', params: { route_id: id!, from: route.from_location, to: route.to_location, transport_type: isOkada ? 'okada' : 'trotro' } } as never)
  }
  const goReportQueue = () => {
    haptics.light()
    router.push({ pathname: '/report/queue', params: boardStat ? { station_id: boardStat.id, station_name: boardStat.name } : {} } as never)
  }
  const goPost = (location: string) => {
    haptics.light()
    router.push(`/report/photo?mode=text&location=${encodeURIComponent(location)}` as Href)
  }
  // R7: the Mapbox screen costs data, so the link says so.
  const goMap = () => {
    haptics.light()
    router.push({
      pathname: '/routes/detail',
      params: {
        from: route.from_location,
        to: route.to_location,
        fare: String(src.amount ?? officialFare ?? 0),
        duration: String(route.estimated_duration_mins ?? 0),
        transport_type: isOkada ? 'okada' : 'trotro',
        route_id: route.id,
        type: 'direct',
      },
    } as never)
  }

  const routeAlerts = isOkada ? [] : alertsForRoute(alertsQ.data, route.from_location, route.to_location).slice(0, 2)
  const asks: { label: string; onPress: () => void }[] = isOkada
    ? [{ label: reportCount > 0 ? 'Confirm fare' : 'Add fare', onPress: goReportFare }, { label: 'Post update', onPress: () => goPost(route.from_location) }]
    : [
        { label: reportCount > 0 ? 'Confirm fare' : 'Add fare', onPress: goReportFare },
        { label: 'Share bay', onPress: () => goPost(route.from_location) },
        { label: 'Post update', onPress: () => goPost(route.from_location) },
      ]
  const barH = BAR_H + insets.bottom

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[s.scrim, { height: insets.top, backgroundColor: corridor.color, opacity: scrimOpacity }]} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: barH + 24 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[brand.orange]} progressViewOffset={insets.top} />}
      >
        {/* ── R1 hero in the corridor colour ── */}
        <View style={[s.hero, { backgroundColor: corridor.color, paddingTop: insets.top + 4 }]}>
          {/* Adinkra (owner rule: every hero carries it) — faint white, decoration only. */}
          <AdinkraCardPattern height={insets.top + 420} ink="rgba(255,255,255,0.09)" size={28} />
          <View style={s.heroTop}>
            <BackButton variant="floating" tone="dark" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
            <TouchableOpacity
              onPress={() => { haptics.light(); popHeart(); toggleFavorite({ id: id!, from: route.from_location, to: route.to_location }) }}
              style={s.saveBtn}
              accessibilityRole="button"
              accessibilityState={{ selected: favorited }}
              accessibilityLabel={favorited ? 'Saved. Remove from saved lines' : 'Save this line'}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart size={20} color="#FFFFFF" fill={favorited ? '#FFFFFF' : 'transparent'} />
              </Animated.View>
              <Text style={s.saveText}>{favorited ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.heroBody}>
            <HeroText size={44} style={{ color: '#FFFFFF', letterSpacing: 0.3 }} accessibilityRole="header">{corridor.code}</HeroText>
            <HeroText size={22} style={{ color: '#FFFFFF', marginTop: -6 }}>{isOkada ? 'Okada ' : ''}→ {to}</HeroText>
            <Text style={s.heroSub}>from {from}{stops.length >= 3 ? ` · ${stops.length} stops` : ''}</Text>
            <View style={s.heroFareRow}>
              {heroFare ? <HeroText size={44} style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{heroFare}</HeroText> : null}
              {heroLabel ? (
                <View style={[s.heroLabel, heroFare ? { marginBottom: 12 } : null]}>
                  <Text style={[s.heroLabelText, { color: heroLabel === 'RIDERS' ? '#57534E' : '#047857' }]}>{heroLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.heroBasis, basisWarn && { color: '#FDE68A', fontFamily: font.bold }]}>{basis}</Text>
          </View>
        </View>

        <View style={s.body}>
          {routeAlerts.length > 0 ? <View style={{ gap: 8 }}>{routeAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}</View> : null}
          {favorited && !isOkada ? (
            <View style={[s.card, s.alertsCard]}>
              <Bell size={18} color={ui.text} />
              <Text style={s.alertsText}>Alerts on · disruptions on this line are pushed to you</Text>
            </View>
          ) : null}

          {/* ── Fixed queue slot (R2 without the "Usually" strip, which needs backend) ── */}
          {!isOkada ? (
            <View>
              <Text style={s.label}>Queue at {boardName}</Text>
              <View style={[s.card, { padding: 14, marginTop: 6 }]} accessible accessibilityLabel={q && qFresh !== 'stale' ? `${QUEUE_WORD[q.current_status]} at ${boardName}, reported ${ageLabel(q.last_report_at)}` : `No recent queue report at ${boardName}`}>
                {q && qFresh !== 'stale' ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <QueueGlyph status={q.current_status} color={QUEUE_COLOR[q.current_status]} size={24} opacity={qFresh === 'aging' ? 0.8 : 1} />
                      <HeroText size={28} style={{ color: ui.text, flexShrink: 1 }}>{QUEUE_WORD[q.current_status]}</HeroText>
                    </View>
                    <Text style={s.meta}>
                      {ageLabel(q.last_report_at)}
                      {q.report_count_last_hour > 0 ? ` · ${q.report_count_last_hour} ${q.report_count_last_hour === 1 ? 'report' : 'reports'} this hour` : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <QueueGlyph status={null} color={ui.textTertiary} size={24} />
                      <HeroText size={22} style={{ color: ui.textSecondary, flexShrink: 1 }}>No recent report</HeroText>
                    </View>
                    <Text style={s.meta}>At the station? Report the queue below.</Text>
                  </>
                )}
              </View>
              {liveTrips.length > 0 && (
                <Text style={[s.meta, { marginTop: 6 }]}>{liveTrips.length} rider{liveTrips.length !== 1 ? 's' : ''} sharing this trip live now</Text>
              )}
            </View>
          ) : null}

          {/* ── R3 stops and fares, in the corridor colour ── */}
          {!isOkada && stops.length >= 3 ? (
            <View>
              <TicketCard tone="fare" label="Stops and fares" value={`${stops.length} stops`} bodyStyle={{ paddingTop: 4, paddingBottom: 8, paddingHorizontal: 14 }}>
                {stops.map((st, i) => {
                  const first = i === 0
                  const last = i === stops.length - 1
                  const terminal = first || last
                  const f = stageFares[i]
                  return (
                    <View
                      key={st.id ?? `${st.stop_order}`}
                      style={s.stopRow}
                      accessible
                      accessibilityLabel={`${titleCase(st.stop_name)}${first ? ', board here' : last ? ', end of line' : ''}${f && f.fare != null ? `, ${formatGHS(f.fare)}${isEst(f.source) ? ' estimated' : ''}` : ''}`}
                    >
                      <View style={s.stopRail}>
                        <View style={[s.railLine, { backgroundColor: corridor.color, top: first ? '50%' : 0, bottom: last ? '50%' : 0 }]} />
                        <View
                          style={terminal
                            ? { width: 18, height: 18, borderRadius: 9, backgroundColor: corridor.color }
                            : { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: corridor.color, backgroundColor: '#FFFFFF' }}
                        />
                      </View>
                      <Text style={[s.stopName, terminal && { fontFamily: font.extrabold }]}>{titleCase(st.stop_name)}</Text>
                      {first ? (
                        <View style={[s.chip, { backgroundColor: '#ECFDF5' }]}><Text style={[s.chipText, { color: '#047857' }]}>Board here</Text></View>
                      ) : f && f.fare == null ? (
                        <Text style={[s.stopFare, { color: ui.textTertiary }]}>—</Text>
                      ) : f && f.fare != null ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.stopFare}>{formatGHS(f.fare)}</Text>
                          {isEst(f.source) ? <View style={[s.chip, { backgroundColor: '#F5F5F4' }]}><Text style={[s.chipText, { color: '#57534E' }]}>est.</Text></View> : null}
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </TicketCard>
            </View>
          ) : null}

          {/* ── R4: one "Help the next rider" card, rank chip moved here ── */}
          <View style={s.help}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Text style={s.helpTitle}>Help the next rider</Text>
              {rankQ.data?.rank ? (
                <View style={s.rankChip} accessible accessibilityLabel={`You are the number ${rankQ.data.rank} reporter on this line this month`}>
                  <Text style={s.rankText}>You&apos;re #{rankQ.data.rank} here this month</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {asks.map((a) => (
                <TouchableOpacity key={a.label} onPress={a.onPress} style={s.askBtn} activeOpacity={0.75} accessibilityRole="button">
                  <Text style={s.askText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── R7: map link states its data cost ── */}
          <TouchableOpacity onPress={goMap} style={s.mapLink} accessibilityRole="link" accessibilityLabel="View on map. Uses about 2 megabytes of data">
            <MapPin size={15} color={ui.textTertiary} />
            <Text style={s.meta}>View on map · uses about 2 MB</Text>
          </TouchableOpacity>

          {/* ── Data-backed history: shown only when there is something to show ── */}
          {!isOkada && trend.length > 0 ? (
            <View>
              <Text style={s.label}>Fares over time</Text>
              <View style={[s.card, { padding: space.md, marginTop: 6 }]}>
                <FareTrendChart
                  data={trend}
                  officialFare={src.chip === 'GPRTU' ? officialFare : 0}
                  isLoading={trendLoading}
                  selectedPeriod={trendDays}
                  onPeriodChange={setTrendDays}
                  routeName={`${from} → ${to}`}
                />
              </View>
            </View>
          ) : null}
          {recentReports.length > 0 ? (
            <View>
              <TicketCard tone="fare" label="Latest fare reports" value="Riders paid" bodyStyle={{ paddingTop: 2, paddingBottom: 4, paddingHorizontal: 14 }}>
                {recentReports.slice(0, 4).map((r, i) => (
                  <View key={r.id} style={[s.reportRow, i > 0 && s.divider]}>
                    <Text style={[s.stopFare, { flex: 1 }]}>{formatGHS(r.reported_fare)}</Text>
                    <Text style={s.meta}>{timeAgo(r.reported_at)}</Text>
                  </View>
                ))}
              </TicketCard>
            </View>
          ) : null}
          {activity.length > 0 ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.label}>On Pulse</Text>
                <TouchableOpacity onPress={() => router.push('/tales' as Href)} hitSlop={12} accessibilityRole="link" accessibilityLabel="See all Pulse posts">
                  <Text style={s.linkText}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.card, { paddingHorizontal: 14, marginTop: 6 }]}>
                {activity.map((p, i) => (
                  <TouchableOpacity key={p.id} onPress={() => router.push('/tales' as Href)} style={[s.postRow, i > 0 && s.divider]} accessibilityRole="button">
                    <View style={s.postMeta}>
                      {p.kind === 'fare' ? <Receipt size={13} color={ui.success} /> : <MapPin size={13} color={brand.orangeText} />}
                      <Text style={[s.postMetaText, { color: p.kind === 'fare' ? '#15803D' : brand.orangeText }]}>
                        {p.kind === 'fare' ? 'Fare reported' : p.location_name}
                      </Text>
                      <Text style={s.meta}>· {timeAgo(p.created_at)}</Text>
                    </View>
                    <Text style={s.postText} numberOfLines={2}>
                      {p.kind === 'fare' ? `A rider paid ${formatGHS(p.fare)} on this route.` : p.caption || 'Shared a photo'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* ── R5: sticky bottom bar ── */}
      <View style={[s.bar, { height: barH, paddingBottom: 12 + insets.bottom }]}>
        {isOkada ? (
          <TouchableOpacity onPress={goReportFare} style={[s.barBtn, s.barPri]} accessibilityRole="button">
            <Text style={[s.barText, { color: '#FFFFFF' }]}>Report what you paid</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={goReportQueue} style={[s.barBtn, s.barPri]} accessibilityRole="button" accessibilityLabel={`Report the queue at ${boardName}`}>
              <Text style={[s.barText, { color: '#FFFFFF' }]}>Report queue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goReportFare} style={[s.barBtn, s.barOut]} accessibilityRole="button" accessibilityLabel="Report the fare you paid">
              <Text style={s.barText}>Report fare</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

/** Interpolated stage fares under this read as noise; show "—" instead. */
const MIN_EST_STAGE_FARE = 2

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15 },

  hero: { paddingBottom: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, minHeight: 48 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingLeft: 12 },
  saveText: { fontFamily: font.bold, fontSize: 16, color: '#FFFFFF' },
  heroBody: { paddingHorizontal: space.xl, marginTop: 4 },
  heroSub: { fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  heroFareRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  heroLabel: { backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  heroLabelText: { fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6 },
  heroBasis: { fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.9)' },

  body: { paddingHorizontal: space.xl, paddingTop: 12, gap: 16 },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1, borderColor: ui.hairline },
  alertsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52, paddingVertical: 8 },
  alertsText: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: ui.text },
  label: { fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: ui.textTertiary },
  meta: { fontFamily: font.medium, fontSize: 13, color: ui.textTertiary },
  cardTitle: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  linkText: { fontFamily: font.bold, fontSize: 14, color: brand.orangeText },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  stopRail: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', width: 4, borderRadius: 2 },
  stopName: { flex: 1, fontFamily: font.bold, fontSize: 16, color: ui.text },
  stopFare: { fontFamily: font.extrabold, fontSize: 16, color: ui.text, fontVariant: ['tabular-nums'] },
  chip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  chipText: { fontFamily: font.bold, fontSize: 13 },

  help: { backgroundColor: brand.orangeSoft, borderRadius: radius.lg, padding: 14 },
  helpTitle: { fontFamily: font.bold, fontSize: 16, color: ui.text },
  rankChip: { backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: 10, height: 26, justifyContent: 'center' },
  rankText: { fontFamily: font.semibold, fontSize: 12, color: ui.text },
  askBtn: {
    flex: 1, height: 48, borderRadius: radius.md, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#D6D3D1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  askText: { fontFamily: font.bold, fontSize: 14, color: ui.text },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, alignSelf: 'flex-start' },

  reportRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.surfaceStrong },
  postRow: { paddingVertical: 10, gap: 4 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postMetaText: { fontSize: 14, fontFamily: font.semibold },
  postText: { fontFamily: font.regular, fontSize: 15, color: ui.text },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: space.xl,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: ui.hairline,
  },
  barBtn: { flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  barPri: { backgroundColor: brand.orange },
  barOut: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D6D3D1' },
  barText: { fontFamily: font.bold, fontSize: 16, color: ui.text },
})
