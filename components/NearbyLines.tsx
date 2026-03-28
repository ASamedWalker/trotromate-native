import { useMemo, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { ChevronRight, MapPin, ShieldCheck } from 'lucide-react-native'
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

      {/* ── Section header ── */}
      {lines.length > 0 && (
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Live Near You</Text>
          <TouchableOpacity onPress={() => router.push('/routes')} style={s.seeAllRow}>
            <Text style={s.seeAllText}>See all</Text>
            <ChevronRight size={14} color={t.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Trotro cards ── */}
      {trotroLines.map((line, idx) => {
        const borderColor = TRANSPORT_COLORS.trotro
        const queueColor = line.queueStatus ? QUEUE_COLORS[line.queueStatus] : undefined
        const queueLabel = line.queueStatus ? QUEUE_LABELS[line.queueStatus] : undefined

        return (
          <AnimatedCard
            key={line.id}
            index={idx}
            onPress={() => router.push(line.href as Href)}
            style={[s.card, { borderLeftColor: borderColor }]}
          >
            <View style={s.cardBody}>
              {/* Left content */}
              <View style={s.cardLeft}>
                <View style={s.labelRow}>
                  <Text style={s.categoryLabel}>Route Destination</Text>
                  {line.isVerified && (
                    <View style={s.gprtuBadge}>
                      <ShieldCheck size={10} color="#16a34a" />
                      <Text style={s.gprtuText}>GPRTU</Text>
                    </View>
                  )}
                  {queueLabel && (
                    <View style={[s.queueBadge, { backgroundColor: `${queueColor}18` }]}>
                      <View style={[s.queueDot, { backgroundColor: queueColor }]} />
                      <Text style={[s.queueText, { color: queueColor }]}>{queueLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.routeCode, { color: borderColor }]}>{line.routeLabel}-{abbreviate(line.to)}</Text>
                <Text style={s.routeSubtitle} numberOfLines={1}>{line.from} to {line.to}</Text>
              </View>

              {/* Right: time */}
              <View style={s.cardRight}>
                <Text style={[s.timeNumber, { color: queueColor ?? borderColor }]}>
                  {line.timeNumber === '--' ? '--' : `${line.timeNumber}m`}
                </Text>
                {line.timeUnit === 'minutes' && (
                  <Text style={s.timeLabel}>Minutes</Text>
                )}
              </View>
            </View>
          </AnimatedCard>
        )
      })}

      {/* ── Train cards ── */}
      {trainLines.map((line, idx) => {
        const borderColor = TRANSPORT_COLORS.train
        const isLive = line.liveTag === 'live'

        return (
          <AnimatedCard
            key={line.id}
            index={trotroLines.length + idx}
            onPress={() => router.push(line.href as Href)}
            style={[s.card, { borderLeftColor: borderColor }]}
          >
            <View style={s.cardBody}>
              {/* Left content */}
              <View style={s.cardLeft}>
                <View style={s.labelRow}>
                  <Text style={[s.categoryLabel, { color: borderColor }]}>Rail Link</Text>
                  {isLive && (
                    <View style={s.liveBadge}>
                      <View style={s.liveDot} />
                      <Text style={s.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.routeCode, { color: borderColor }]}>{line.lineName ?? 'TR'}</Text>
                <Text style={s.routeSubtitle} numberOfLines={1}>{line.from} to {line.to}</Text>
              </View>

              {/* Right: time */}
              <View style={s.cardRight}>
                <Text style={[
                  s.timeNumber,
                  { color: isLive ? '#22c55e' : borderColor },
                  line.liveTag === 'done' && s.timeDone,
                ]}>
                  {line.timeNumber === '--' ? '--' : line.timeUnit === 'minutes' ? `${line.timeNumber}m` : line.timeNumber}
                </Text>
                {line.timeUnit !== '' && line.liveTag !== 'done' && (
                  <Text style={s.timeLabel}>
                    {line.liveTag === 'scheduled' ? 'Departs' : 'Minutes'}
                  </Text>
                )}
              </View>
            </View>
          </AnimatedCard>
        )
      })}

      {/* View all routes */}
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

    // Section header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: font.extrabold,
      color: t.text,
      letterSpacing: -0.3,
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.textTertiary,
    },

    // Card — white bg, thick left border
    card: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      borderRadius: 16,
      marginBottom: 10,
      borderLeftWidth: 8,
      borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 2,
    },

    cardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingLeft: 14,
      paddingRight: 16,
    },

    cardLeft: {
      flex: 1,
    },

    // Category label row
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    categoryLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: TRANSPORT_COLORS.trotro,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    gprtuBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(22,163,74,0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    gprtuText: {
      fontSize: 9,
      fontFamily: font.bold,
      color: '#16a34a',
      letterSpacing: 0.5,
    },
    queueBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    queueDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    queueText: {
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 0.3,
    },

    // Route code — large bold
    routeCode: {
      fontSize: 26,
      fontFamily: font.extrabold,
      lineHeight: 30,
      letterSpacing: -0.5,
    },

    // From → To subtitle
    routeSubtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },

    // Right side — time
    cardRight: {
      alignItems: 'flex-end',
      marginLeft: 12,
    },
    timeNumber: {
      fontSize: 28,
      fontFamily: font.extrabold,
      lineHeight: 32,
    },
    timeDone: {
      fontSize: 16,
      lineHeight: 20,
      color: t.textTertiary,
    },
    timeLabel: {
      fontSize: 10,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 1,
    },

    // Live badge for trains
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(34,197,94,0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: '#22c55e',
    },
    liveText: {
      fontSize: 9,
      fontFamily: font.bold,
      color: '#22c55e',
      letterSpacing: 0.5,
    },

    // View all routes CTA
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 6,
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
