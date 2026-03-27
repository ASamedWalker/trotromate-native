import { useMemo, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { ChevronRight, ShieldCheck, MapPin, Clock, Radio } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { getStationCoords } from '@/lib/utils/station-coords'
import { haversineKm } from '@/lib/utils/distance'
import { getWaitEstimate, type StationWithQueue, type QueueStatus } from '@/lib/services/stations'
import { getTrainLines, TRANSPORT_COLORS, type NearbyLine } from '@/lib/utils/train-search'
import type { RouteWithStats } from '@/lib/types'

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const QUEUE_LABELS: Record<QueueStatus, string> = {
  empty: 'No wait',
  short: 'Short queue',
  moderate: 'Moderate',
  long: 'Long queue',
  very_long: 'Very long',
}

function abbreviate(name: string): string {
  const words = name.split(/[\s-]+/)
  if (words.length === 1) return name.length <= 5 ? name : name.slice(0, 4)
  return words[0].slice(0, 3)
}

/* ── Animated card wrapper — staggered entrance ── */

function AnimatedCard({
  index,
  children,
  style,
  onPress,
}: {
  index: number
  children: React.ReactNode
  style: any
  onPress: () => void
}) {
  const slideAnim = useRef(new Animated.Value(24)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const delay = index * 100
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [index, slideAnim, fadeAnim])

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Animated.View
        style={[
          style,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

/* ── Component ─────────────────────────────────────── */

interface NearbyLinesProps {
  stations: StationWithQueue[]
  routes: RouteWithStats[]
  userLat: number | null
  userLng: number | null
  locationGranted?: boolean
  onRequestLocation?: () => void
}

export function NearbyLines({
  stations, routes, userLat, userLng,
  locationGranted = true,
  onRequestLocation,
}: NearbyLinesProps) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const lines = useMemo(() => {
    const result: NearbyLine[] = []

    let nearbyStations: { station: StationWithQueue; distM: number }[] = []

    if (userLat != null && userLng != null) {
      nearbyStations = stations
        .map((station) => {
          const coords = getStationCoords(station)
          if (!coords) return null
          const distM = Math.round(
            haversineKm(userLat, userLng, coords.latitude, coords.longitude) * 1000,
          )
          return { station, distM }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null && s.distM <= 5000)
        .sort((a, b) => a.distM - b.distM)
        .slice(0, 10)
    }

    const stationQueueMap = new Map<string, { wait: string; status?: QueueStatus }>()
    for (const { station } of nearbyStations) {
      const stat = station.queue_stats?.[0]
      if (stat) {
        stationQueueMap.set(station.name.toLowerCase(), {
          wait: getWaitEstimate(stat),
          status: stat.current_status as QueueStatus,
        })
      }
    }

    const hasNearby = nearbyStations.length > 0
    const stationNames = nearbyStations.map((ns) => ns.station.name.toLowerCase())

    const matchedRoutes = hasNearby
      ? routes.filter((r) => {
          const from = r.from_location.toLowerCase()
          return stationNames.some(
            (name) => from.includes(name) || name.includes(from),
          )
        })
      : routes.slice(0, 6)

    for (const route of matchedRoutes.slice(0, 6)) {
      const from = route.from_location.toLowerCase()
      const queueInfo = Array.from(stationQueueMap.entries()).find(
        ([name]) => from.includes(name) || name.includes(from),
      )
      const displayMins =
        route.traffic?.duration_in_traffic_mins ?? route.estimated_duration_mins
      const nearStation = nearbyStations.find((ns) => {
        const name = ns.station.name.toLowerCase()
        return from.includes(name) || name.includes(from)
      })

      result.push({
        id: `route-${route.id}`,
        type: (route.transport_type as 'trotro' | 'okada') || 'trotro',
        from: route.from_location,
        to: route.to_location,
        fare: route.official_fare,
        timeNumber: displayMins ? `${displayMins}` : '--',
        timeUnit: displayMins ? 'minutes' : '',
        routeLabel: abbreviate(route.from_location),
        color:
          TRANSPORT_COLORS[
            route.transport_type as keyof typeof TRANSPORT_COLORS
          ] || TRANSPORT_COLORS.trotro,
        sortKey: nearStation ? nearStation.distM : 9000,
        href: `/routes/${route.id}`,
        queueStatus: queueInfo?.[1].status,
        isVerified: route.is_gprtu_verified,
      })
    }

    result.push(...getTrainLines())
    result.sort((a, b) => a.sortKey - b.sortKey)
    return result.slice(0, 8)
  }, [stations, routes, userLat, userLng])

  const trotroLines = lines.filter((l) => l.type !== 'train')
  const trainLines = lines.filter((l) => l.type === 'train')
  const hasLiveTrotro = trotroLines.some((l) => l.queueStatus)
  const hasLiveTrain = trainLines.some((l) => l.liveTag === 'live')

  return (
    <View style={s.container}>
      {/* ── Location banner ── */}
      {!locationGranted && onRequestLocation && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onRequestLocation}
          style={s.locationBanner}
        >
          <MapPin size={18} color="#fff" />
          <View style={s.locationBannerText}>
            <Text style={s.locationBannerTitle}>Tap to turn on location</Text>
            <Text style={s.locationBannerSub}>See trotro routes and trains near you</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}

      {/* ── Trotro Routes ── */}
      {trotroLines.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Nearby Routes</Text>
            <View style={{ flex: 1 }} />
            {hasLiveTrotro ? (
              <View style={s.liveBadge}>
                <View style={s.livePulse} />
                <Text style={s.liveBadgeText}>LIVE NOW</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push('/routes')} style={s.seeAllRow}>
                <Text style={s.seeAllText}>See all</Text>
                <ChevronRight size={14} color={t.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {trotroLines.map((line, idx) => {
            const queueColor = line.queueStatus ? QUEUE_COLORS[line.queueStatus] : undefined
            const queueLabel = line.queueStatus ? QUEUE_LABELS[line.queueStatus] : undefined
            const accent = TRANSPORT_COLORS.trotro
            // Card bg tinted towards accent color
            const cardBg = isDark
              ? 'rgba(245,158,11,0.06)'
              : 'rgba(245,158,11,0.04)'

            return (
              <AnimatedCard
                key={line.id}
                index={idx}
                onPress={() => router.push(line.href as Href)}
                style={[s.card, {
                  backgroundColor: cardBg,
                  borderLeftColor: accent,
                }]}
              >
                {/* Content wrapper — vertical stack */}
                <View style={s.cardContent}>
                  {/* Left: stacked info */}
                  <View style={s.cardLeft}>
                    {/* Row 1: Large line ID + type badge */}
                    <View style={s.topRow}>
                      <Text style={[s.lineId, { color: accent }]}>
                        {line.routeLabel}
                      </Text>
                      {line.isVerified ? (
                        <View style={[s.typeBadge, { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.3)' }]}>
                          <ShieldCheck size={10} color="#16a34a" />
                          <Text style={[s.typeBadgeText, { color: '#16a34a' }]}>GPRTU</Text>
                        </View>
                      ) : (
                        <View style={[s.typeBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
                          <Text style={[s.typeBadgeText, { color: accent }]}>TROTRO</Text>
                        </View>
                      )}
                    </View>

                    {/* Row 2: towards Destination */}
                    <Text style={s.towardsLine} numberOfLines={1}>
                      <Text style={s.towardsText}>towards </Text>
                      <Text style={s.destinationBold}>{line.to}</Text>
                    </Text>

                    {/* Row 3: Station meta */}
                    {queueLabel ? (
                      <View style={s.metaRow}>
                        <View style={[s.metaDot, { backgroundColor: queueColor }]} />
                        <Text style={[s.metaTextBold, { color: queueColor }]}>
                          {queueLabel.toUpperCase()}
                        </Text>
                        <Text style={s.metaSep}>{'\u2022'}</Text>
                        <Text style={s.metaText}>{line.from}</Text>
                      </View>
                    ) : (
                      <View style={s.metaRow}>
                        <MapPin size={11} color={t.textTertiary} />
                        <Text style={s.metaText}>{line.from}</Text>
                      </View>
                    )}
                  </View>

                  {/* Right: Big arrival time */}
                  <View style={s.cardRight}>
                    <View style={s.timeRow}>
                      <Text style={[s.timeNumber, { color: queueColor ?? accent }]}>
                        {line.timeNumber}
                      </Text>
                      {line.timeUnit === 'minutes' && (
                        <Text style={[s.timeUnit, { color: queueColor ?? accent }]}>min</Text>
                      )}
                    </View>
                    {line.timeUnit === 'minutes' && (
                      <Text style={s.timeLabel}>ARRIVAL</Text>
                    )}
                  </View>
                </View>
              </AnimatedCard>
            )
          })}
        </>
      )}

      {/* ── Train Routes ── */}
      {trainLines.length > 0 && (
        <>
          <View style={[s.sectionHeader, trotroLines.length > 0 && { marginTop: 24 }]}>
            <Text style={[s.sectionTitle, { color: TRANSPORT_COLORS.train }]}>Train Routes</Text>
            <View style={{ flex: 1 }} />
            {hasLiveTrain ? (
              <View style={[s.liveBadge, { backgroundColor: 'rgba(14,165,233,0.12)' }]}>
                <View style={[s.livePulse, { backgroundColor: TRANSPORT_COLORS.train }]} />
                <Text style={[s.liveBadgeText, { color: TRANSPORT_COLORS.train }]}>LIVE</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push('/train')} style={s.seeAllRow}>
                <Text style={[s.seeAllText, { color: TRANSPORT_COLORS.train }]}>Schedule</Text>
                <ChevronRight size={14} color={TRANSPORT_COLORS.train} />
              </TouchableOpacity>
            )}
          </View>

          {trainLines.map((line, idx) => {
            const accent = TRANSPORT_COLORS.train
            const isLive = line.liveTag === 'live'
            const cardBg = isDark
              ? 'rgba(14,165,233,0.06)'
              : 'rgba(14,165,233,0.04)'

            return (
              <AnimatedCard
                key={line.id}
                index={trotroLines.length + idx}
                onPress={() => router.push(line.href as Href)}
                style={[s.card, {
                  backgroundColor: cardBg,
                  borderLeftColor: accent,
                }]}
              >
                <View style={s.cardContent}>
                  <View style={s.cardLeft}>
                    {/* Row 1: Line name + status badge */}
                    <View style={s.topRow}>
                      <Text style={[s.lineId, { color: accent }]}>
                        {line.lineName ?? 'TR'}
                      </Text>
                      {isLive ? (
                        <View style={[s.typeBadge, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }]}>
                          <View style={[s.livePulse, { backgroundColor: '#22c55e', width: 5, height: 5 }]} />
                          <Text style={[s.typeBadgeText, { color: '#22c55e' }]}>LIVE</Text>
                        </View>
                      ) : (
                        <View style={[s.typeBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
                          <Text style={[s.typeBadgeText, { color: accent }]}>
                            {line.liveTag === 'scheduled' ? 'SCHEDULED' : 'TRAIN'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Row 2: towards Destination */}
                    <Text style={s.towardsLine} numberOfLines={1}>
                      <Text style={s.towardsText}>towards </Text>
                      <Text style={s.destinationBold}>{line.to}</Text>
                    </Text>

                    {/* Row 3: Meta */}
                    {isLive ? (
                      <View style={s.metaRow}>
                        <Radio size={11} color="#22c55e" />
                        <Text style={[s.metaTextBold, { color: '#22c55e' }]}>IN TRANSIT</Text>
                        <Text style={s.metaSep}>{'\u2022'}</Text>
                        <Text style={s.metaText}>{line.from}</Text>
                      </View>
                    ) : (
                      <View style={s.metaRow}>
                        <Clock size={11} color={t.textTertiary} />
                        <Text style={s.metaText}>{line.from}</Text>
                      </View>
                    )}
                  </View>

                  {/* Right: Big time */}
                  <View style={s.cardRight}>
                    <View style={s.timeRow}>
                      <Text style={[
                        s.timeNumber,
                        { color: isLive ? '#22c55e' : accent },
                        line.liveTag === 'done' && s.timeMuted,
                      ]}>
                        {line.timeNumber}
                      </Text>
                      {line.timeUnit !== '' && line.liveTag !== 'done' && (
                        <Text style={[s.timeUnit, { color: isLive ? '#22c55e' : accent }]}>
                          {line.timeUnit === 'minutes' ? 'min' : line.timeUnit}
                        </Text>
                      )}
                    </View>
                    {line.liveTag === 'scheduled' && (
                      <Text style={s.timeLabel}>DEPARTS</Text>
                    )}
                  </View>
                </View>
              </AnimatedCard>
            )
          })}
        </>
      )}

      {/* View all routes — CTA button */}
      {lines.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/routes')}
          style={s.viewAllBtn}
        >
          <Text style={s.viewAllText}>VIEW ALL ROUTES</Text>
          <ChevronRight size={16} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {lines.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No routes nearby</Text>
          <Text style={s.emptySub}>Search for a route to get started</Text>
        </View>
      )}
    </View>
  )
}

/* ── Styles ────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      marginHorizontal: 20,
      marginTop: 14,
      marginBottom: 4,
    },

    // Location permission banner
    locationBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#0ea5e9',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    locationBannerText: { flex: 1 },
    locationBannerTitle: {
      fontSize: 15,
      fontFamily: font.bold,
      color: '#fff',
    },
    locationBannerSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 1,
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 22,
      fontFamily: font.extrabold,
      color: t.text,
      letterSpacing: -0.3,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(34,197,94,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    livePulse: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    liveBadgeText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: '#22c55e',
      letterSpacing: 0.8,
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seeAllText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.textTertiary,
    },

    // Cards — thick left border, accent-tinted bg
    card: {
      borderRadius: 18,
      marginTop: 10,
      borderLeftWidth: 4,
      overflow: 'hidden',
    },

    // Card internal layout — horizontal: info left, time right
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingLeft: 16,
      paddingRight: 18,
    },

    // Left content — stacked vertically
    cardLeft: {
      flex: 1,
      gap: 4,
    },

    // Top row: line ID + type badge
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    lineId: {
      fontSize: 38,
      fontFamily: font.extrabold,
      lineHeight: 42,
      letterSpacing: -1,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    typeBadgeText: {
      fontSize: 11,
      fontFamily: font.bold,
      letterSpacing: 0.6,
    },

    // "towards Destination" row
    towardsLine: {
      marginTop: 2,
    },
    towardsText: {
      fontSize: 15,
      fontFamily: font.regular,
      color: t.textTertiary,
    },
    destinationBold: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },

    // Meta / status row
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
    },
    metaDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    metaTextBold: {
      fontSize: 11,
      fontFamily: font.bold,
      letterSpacing: 0.5,
    },
    metaSep: {
      fontSize: 11,
      color: t.textTertiary,
    },
    metaText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    // Right: arrival time — dominant
    cardRight: {
      alignItems: 'flex-end',
      marginLeft: 12,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    timeNumber: {
      fontSize: 36,
      fontFamily: font.extrabold,
      lineHeight: 40,
    },
    timeMuted: {
      fontSize: 18,
      lineHeight: 22,
    },
    timeUnit: {
      fontSize: 16,
      fontFamily: font.semibold,
      marginBottom: 2,
    },
    timeLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: t.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 1,
    },

    // View all routes CTA
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: c.amber500,
    },
    viewAllText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 0.8,
    },

    // Empty state
    emptyState: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    emptySub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textTertiary,
      marginTop: 4,
    },
  })
}
