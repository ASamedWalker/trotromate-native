import { useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin, Plus, Heart, MessageCircle, Info, ChevronDown, ChevronUp, Receipt } from 'lucide-react-native'
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated'
import { useQuery } from '@tanstack/react-query'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { SkeletonRouteDetail } from '@/components/Skeleton'
import { HeroText } from '@/components/HeroText'
import { LoadErrorState } from '@/components/StateViews'
import { FareTrendChart } from '@/components/FareTrendChart'
import { Button } from '@/components/ui'
import { useRouteDetail, useFareTrend } from '@/lib/hooks/useRoutes'
import { fetchRouteActivity } from '@/lib/services/route-activity'
import { fetchRouteSegmentFares, resolveDropoffFareSync } from '@/lib/services/segment-fares'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { timeAgo } from '@/lib/utils/time'
import { formatGHS } from '@/lib/utils/currency'
import { TROTRO_BOOKING_ENABLED } from '@/lib/config/booking'
import { titleCase } from '@/lib/utils/title-case'

/**
 * Line page (Lines tab → route). Redesign approved 2026-10-04 (design canvas,
 * "Lines route page redesign"): hero with an honest fare label, Book + Report,
 * stops with stage fares, where to board, fares over time, Pulse, tips.
 * Okada lines are fare information only — rides aren't live.
 */
// Hero = the brand adinkra print on dark (approved canvas design), not a stock photo.
const HERO_H = 320
const heroPatternCache = new Map<string, string>()
function heroPattern(w: number, h: number): string {
  const key = `${w}x${h}`
  let xml = heroPatternCache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, h, 26, 'rgba(255,255,255,0.07)'); heroPatternCache.set(key, xml) }
  return xml
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const haptics = useHaptics()
  const { isAuthenticated } = useAuthContext()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [tipsOpen, setTipsOpen] = useState(false)
  const [heroW, setHeroW] = useState(0)
  const [heroH, setHeroH] = useState(HERO_H)

  // Status-bar scrim fades in once the hero scrolls away.
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y })
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [200, 280], [0, 1], Extrapolation.CLAMP),
  }))

  const { route, recentReports, isLoading, isError, refetch } = useRouteDetail(id!)
  const { trend, isLoading: trendLoading, days: trendDays, setDays: setTrendDays } = useFareTrend(id!)
  const { data: segments = [] } = useQuery({
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
          <Text style={[s.h2, { marginTop: space.md }]}>Route not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isOkada = (route as { transport_type?: string }).transport_type === 'okada'
  const from = titleCase(route.from_location)
  const to = titleCase(route.to_location)

  // ── Honest fare label: by the number actually shown (UX-18) ──
  const reportCount = route.fare_stats?.report_count ?? 0
  const officialFare = Number(route.official_fare) || 0
  const avgReported = Number(route.fare_stats?.avg_reported_fare) || 0
  const hasReportedFare = reportCount > 0 && avgReported > 0
  const displayFare = hasReportedFare ? avgReported : officialFare
  // Fare truth: on GPRTU-verified lines always show the official fare, and flag
  // when riders report paying well above it (was the old overcharge banner).
  const showOfficial = !!route.is_gprtu_verified && officialFare > 0 && hasReportedFare
  const overchargePct = route.is_gprtu_verified && officialFare > 0 && hasReportedFare && avgReported > officialFare * 1.2
    ? Math.round((avgReported / officialFare - 1) * 100)
    : 0
  const fareLabel = hasReportedFare ? 'rider-reported' : route.is_gprtu_verified ? 'official fare' : 'estimated'
  const lastReport = route.fare_stats?.last_report_at ? timeAgo(route.fare_stats.last_report_at) : null

  // ── Stops with stage fares (from the origin) ──
  const stops = [...(route.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order)
  const firstOrder = stops[0]?.stop_order ?? 0
  const stageFares = stops.map((st, i) => {
    if (i === 0) return null
    const f = resolveDropoffFareSync(segments, firstOrder, st.stop_order, stops, officialFare)
    if (f.source === 'corridor' || !(f.fare > 0)) return null
    // Distance-interpolated fares are guesses: round to Ghana's 50-pesewa steps.
    return f.source === 'interpolated' ? { ...f, fare: Math.max(0.5, Math.round(f.fare * 2) / 2) } : f
  })
  const shownStages = stageFares.filter((f): f is NonNullable<typeof f> => !!f)
  const isEst = (src: string) => src !== 'official' && src !== 'reported'
  const allOfficial = shownStages.length > 0 && shownStages.every((f) => f.source === 'official')
  const anyEstimate = shownStages.some((f) => isEst(f.source))
  const stageNote = allOfficial
    ? `Official fares from ${from}.`
    : anyEstimate
      ? `Fares from ${from}. "est." fares are estimates, not yet confirmed by riders.`
      : `Fares from ${from}, from what riders report.`

  const heroMeta = [
    stops.length >= 3 ? `${stops.length} stops` : null,
    hasReportedFare
      ? `based on ${reportCount} recent report${reportCount !== 1 ? 's' : ''}${lastReport ? ` · ${lastReport}` : ''}`
      : 'no recent rider reports',
  ].filter(Boolean).join(' · ').replace(/^./, (ch) => ch.toUpperCase())

  const favorited = isFavorite(id!)
  const posts = activity

  const goReport = () => {
    haptics.light()
    router.push({ pathname: '/report/fare', params: { route_id: id!, from: route.from_location, to: route.to_location, transport_type: isOkada ? 'okada' : 'trotro' } } as never)
  }
  const goPost = (location: string) =>
    router.push(`/report/photo?mode=text&location=${encodeURIComponent(location)}` as Href)
  const goBook = () => {
    if (!isAuthenticated) { router.push('/auth/phone' as Href); return }
    router.push({ pathname: '/booking/checkout', params: { from, to, route_id: route.id, fare: String(displayFare) } } as never)
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Light status-bar icons over the dark adinkra hero. */}
      <StatusBar style="light" />
      <View style={[s.topBtn, { left: 16, top: insets.top + 8 }]}>
        <BackButton variant="floating" tone="dark" />
      </View>
      <View style={[s.topBtn, { right: 16, top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => { haptics.light(); toggleFavorite({ id: id!, from: route.from_location, to: route.to_location }) }}
          hitSlop={8}
          style={s.favBtn}
          accessibilityRole="button"
          accessibilityLabel={favorited ? 'Remove from saved routes' : 'Save route'}
        >
          <Heart size={20} color={favorited ? '#EF4444' : '#FFFFFF'} fill={favorited ? '#EF4444' : 'transparent'} />
        </TouchableOpacity>
      </View>
      <Animated.View pointerEvents="none" style={[s.scrim, { height: insets.top }, scrimStyle]} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Hero ── */}
        {/* Content starts below the floating back/save buttons (top inset + 8 + 44 + 12),
            so tall-notch phones don't slide the route pill under the back button. */}
        <View
          style={[s.hero, { paddingTop: insets.top + 64 }]}
          onLayout={(e) => {
            setHeroW(Math.round(e.nativeEvent.layout.width))
            setHeroH(Math.round(e.nativeEvent.layout.height))
          }}
        >
          <LinearGradient colors={['#2A1D14', '#16110D']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFillObject} />
          {heroW > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <SvgXml xml={heroPattern(heroW, heroH)} width={heroW} height={heroH} />
            </View>
          )}
          <View style={s.heroBody}>
            <View style={[s.kindPill, { backgroundColor: isOkada ? '#FFFFFF' : '#F5A300' }]}>
              <Text style={s.kindText}>{isOkada ? 'OKADA ROUTE' : 'TROTRO ROUTE'}</Text>
            </View>
            <Text style={s.heroTitle}>{from} → {to}</Text>
            <View style={s.heroFareRow}>
              {displayFare > 0 ? (
                <>
                  <HeroText size={40} style={{ color: '#FF6A3D', letterSpacing: -1 }}>{formatGHS(displayFare)}</HeroText>
                  <Text style={s.heroFareLabel}>{fareLabel}</Text>
                </>
              ) : (
                <Text style={s.heroFareLabel}>No fare yet. Be the first to report it.</Text>
              )}
            </View>
            {showOfficial && (
              <Text style={s.heroOfficial}>Official GPRTU fare {formatGHS(officialFare)}</Text>
            )}
            <Text style={s.heroMeta}>{heroMeta}</Text>
            {overchargePct > 0 && (
              <TouchableOpacity onPress={goReport} style={s.overPill} accessibilityRole="button" accessibilityLabel={`Riders report paying ${overchargePct} percent above the official fare. Report your fare`}>
                <Text style={s.overText}>Riders report paying {overchargePct}% above the official fare</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.body}>
          {isOkada ? (
            <>
              <View style={s.notice} accessible>
                <Info size={22} color={brand.orangeText} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.noticeTitle}>Okada rides on Troski are coming soon</Text>
                  <Text style={s.noticeText}>For now this is the fare riders report paying. Agree the price with your rider before you go.</Text>
                </View>
              </View>
              <Button label="Report what you paid" icon={Plus} size="lg" onPress={goReport} />
            </>
          ) : (
            <View style={s.ctaRow}>
              {TROTRO_BOOKING_ENABLED && displayFare > 0 && (
                <View style={{ flex: 1 }}><Button label="Book this trip" size="lg" onPress={goBook} /></View>
              )}
              <View style={{ flex: 1 }}><Button label="Report fare" icon={Plus} variant="outline" size="lg" onPress={goReport} /></View>
            </View>
          )}

          {/* ── Stops & stage fares ── */}
          {!isOkada && stops.length >= 3 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.h2}>Stops &amp; fares</Text>
                <Text style={s.muted}>{stops.length} stops</Text>
              </View>
              <View style={s.card}>
                {stops.map((st, i) => {
                  const terminal = i === 0 || i === stops.length - 1
                  const f = stageFares[i]
                  return (
                    <View key={st.id ?? `${st.stop_order}`} style={s.stopRow} accessible accessibilityLabel={`${titleCase(st.stop_name)}${i === 0 ? ', board here' : i === stops.length - 1 ? ', end of line' : ''}${f ? `, ${formatGHS(f.fare)}${isEst(f.source) ? ' estimated' : ''}` : ''}`}>
                      <View style={s.stopRail}>
                        <View style={[s.stopDot, terminal && s.stopDotEnd]} />
                        {i < stops.length - 1 && <View style={s.stopLine} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopName}>{titleCase(st.stop_name)}</Text>
                        {i === 0 && <Text style={s.stopSub}>Board here</Text>}
                        {i === stops.length - 1 && <Text style={s.stopSub}>End of line</Text>}
                      </View>
                      {f ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.stopFare}>{formatGHS(f.fare)}</Text>
                          {isEst(f.source) && <Text style={s.stopSub}>est.</Text>}
                        </View>
                      ) : null}
                    </View>
                  )
                })}
                {shownStages.length > 0 && (
                  <TouchableOpacity onPress={goReport} style={[s.stageNote, allOfficial && { backgroundColor: ui.successSoft }]} accessibilityRole="button" accessibilityLabel={`${stageNote}${!allOfficial ? ' Paid something different? Report your fare.' : ''}`}>
                    <Text style={[s.stageNoteText, allOfficial && { color: '#166534' }]}>
                      {stageNote}{!allOfficial ? <Text style={{ fontFamily: font.bold }}> Paid something different? Tell us.</Text> : null}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Where to board ── */}
          {!isOkada && (
            <View style={s.section}>
              <Text style={s.h2}>Where to board</Text>
              <View style={[s.card, s.rowCard]}>
                <MapPin size={22} color={brand.orange} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.cardTitle}>{from} station</Text>
                  <Text style={s.cardText}>Bay not shared yet. Seen it? Share the bay so the next rider finds it faster.</Text>
                  <TouchableOpacity onPress={() => goPost(route.from_location)} style={s.link} accessibilityRole="button">
                    <Text style={s.linkText}>Share the bay on Pulse</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {liveTrips.length > 0 && (
                <Text style={s.muted}>{liveTrips.length} rider{liveTrips.length !== 1 ? 's' : ''} sharing this trip live now</Text>
              )}
            </View>
          )}

          {/* ── Fares over time (was the Fare Trend + Reports tabs) ── */}
          <View style={s.section}>
            <Text style={s.h2}>{isOkada ? 'Latest reports' : 'Fares over time'}</Text>
            {!isOkada && (trendLoading || trend.length > 0) && (
              <View style={s.card}>
                <FareTrendChart
                  data={trend}
                  officialFare={officialFare}
                  isLoading={trendLoading}
                  selectedPeriod={trendDays}
                  onPeriodChange={setTrendDays}
                  routeName={`${from} → ${to}`}
                />
              </View>
            )}
            {recentReports.length > 0 ? (
              <View style={s.card}>
                {recentReports.slice(0, 4).map((r, i) => (
                  <View key={r.id} style={[s.reportRow, i > 0 && s.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{formatGHS(r.reported_fare)}</Text>
                      <Text style={s.cardText}>Reported {timeAgo(r.reported_at)}</Text>
                    </View>
                    <View style={s.reportPill}><Text style={s.reportPillText}>Rider report</Text></View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.card}>
                <Text style={s.cardText}>No one has reported this fare yet. Your report helps every rider on this line.</Text>
                {!isOkada && (
                  <View style={{ marginTop: space.md }}>
                    <Button label="Report what you paid" icon={Plus} variant="outline" onPress={goReport} />
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Pulse ── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.h2}>On Pulse</Text>
              {posts.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/tales' as Href)} hitSlop={8} accessibilityRole="link" accessibilityLabel="See all Pulse posts">
                  <Text style={s.linkText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.card}>
              {posts.length === 0 ? (
                <>
                  <View style={s.rowCard}>
                    <MessageCircle size={22} color={brand.orange} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.cardTitle}>Nothing posted on this line yet</Text>
                      <Text style={s.cardText}>Queues, fares, road updates: riders share them on Pulse.</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: space.md }}>
                    <Button label="Post on Pulse" variant="outline" onPress={() => goPost(route.from_location)} />
                  </View>
                </>
              ) : posts.map((p, i) => (
                <TouchableOpacity key={p.id} onPress={() => router.push('/tales' as Href)} style={[s.postRow, i > 0 && s.divider]} accessibilityRole="button">
                  <View style={s.postMeta}>
                    {p.kind === 'fare' ? <Receipt size={13} color={ui.success} /> : <MapPin size={13} color={brand.orangeText} />}
                    <Text style={[s.postMetaText, { color: p.kind === 'fare' ? ui.success : brand.orangeText }]}>
                      {p.kind === 'fare' ? 'Fare reported' : p.location_name}
                    </Text>
                    <Text style={s.cardText}>· {timeAgo(p.created_at)}</Text>
                  </View>
                  <Text style={s.postText} numberOfLines={2}>
                    {p.kind === 'fare' ? `A rider paid ${formatGHS(p.fare)} on this route.` : p.caption || 'Shared a photo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Tips (collapsed) ── */}
          <View style={s.card}>
            <TouchableOpacity
              onPress={() => setTipsOpen((v) => !v)}
              style={s.tipsHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: tipsOpen }}
            >
              <Text style={s.cardTitle}>Rider tips</Text>
              {tipsOpen ? <ChevronUp size={20} color={ui.textSecondary} /> : <ChevronDown size={20} color={ui.textSecondary} />}
            </TouchableOpacity>
            {tipsOpen && (
              <View style={{ gap: space.md, marginTop: space.sm }}>
                {(isOkada
                  ? ['Agree the fare with your rider before you set off.', 'Ask for a helmet. Report unsafe riding on Pulse so others know.']
                  : ['Confirm the fare with the mate before you board.', 'Overcharged? Report it in two taps so other riders know what to pay.']
                ).map((tip) => (
                  <Text key={tip} style={s.cardText}>• {tip}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F2' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  topBtn: { position: 'absolute', zIndex: 20 },
  favBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,25,23,0.45)', alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#16110D', zIndex: 15 },

  hero: { minHeight: HERO_H, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#16110D' },
  heroBody: { paddingHorizontal: space.gutter, paddingBottom: 22, gap: 6 },
  kindPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  kindText: { fontSize: 13, fontFamily: font.bold, letterSpacing: 1, color: '#1C1917' },
  heroTitle: { fontSize: 30, fontFamily: font.extrabold, color: '#FFFFFF', letterSpacing: -0.5 },
  heroFareRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroFareLabel: { fontSize: 16, fontFamily: font.semibold, color: '#E7E0DA' },
  heroMeta: { fontSize: 15, fontFamily: font.medium, color: '#D6CFC8' },
  heroOfficial: { fontSize: 15, fontFamily: font.semibold, color: '#FFFFFF' },
  overPill: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#FDE68A', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, minHeight: 32, justifyContent: 'center' },
  overText: { fontSize: 14, fontFamily: font.bold, color: '#78350F' },

  body: { paddingHorizontal: space.gutter, paddingTop: 18, gap: 24 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  notice: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: brand.orangeSoft, borderRadius: radius.lg, padding: 14 },
  noticeTitle: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  noticeText: { ...type.label, color: ui.textSecondary },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontSize: 22, fontFamily: font.extrabold, color: ui.text },
  muted: { ...type.label, color: ui.textSecondary },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md, ...cardShadow },
  rowCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardTitle: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  cardText: { ...type.label, color: ui.textSecondary },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...type.labelStrong, color: brand.orangeText },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  stopRail: { width: 16, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: brand.orange, backgroundColor: '#FFFFFF', zIndex: 1 },
  stopDotEnd: { width: 16, height: 16, borderRadius: 8, backgroundColor: brand.orange },
  stopLine: { position: 'absolute', top: '50%', bottom: -26, width: 3, backgroundColor: '#F5C9B8' },
  stopName: { fontSize: 17, fontFamily: font.bold, color: ui.text },
  stopSub: { ...type.caption, color: ui.textSecondary },
  stopFare: { fontSize: 17, fontFamily: font.extrabold, color: ui.text, fontVariant: ['tabular-nums'] },
  stageNote: { marginTop: space.sm, padding: 12, borderRadius: radius.md, backgroundColor: '#FFF7E6' },
  stageNoteText: { ...type.label, color: '#7A4B00' },

  reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  reportPill: { backgroundColor: ui.successSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  reportPillText: { fontSize: 13, fontFamily: font.bold, color: '#166534' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.surfaceStrong },

  postRow: { paddingVertical: 10, gap: 4 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postMetaText: { fontSize: 14, fontFamily: font.semibold },
  postText: { ...type.body, color: ui.text },

  tipsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
})
