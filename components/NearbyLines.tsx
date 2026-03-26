import { useMemo, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { ChevronRight, ShieldCheck, MapPin } from 'lucide-react-native'
import { TrotroIcon, TrainIcon } from '@/components/ServiceIcons'
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

/* ── Animated time component ─────────────────────────── */

function PulsingTime({ value, unit, color, muted }: {
  value: string
  unit: string
  color?: string
  muted?: boolean
}) {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Pulse animation for live/scheduled times
    if (!muted) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      )
      loop.start()
      return () => loop.stop()
    }
  }, [muted, pulseAnim])

  return (
    <View style={pStyles.col}>
      <Animated.Text
        style={[
          pStyles.number,
          { color: color ?? t.text },
          muted && pStyles.muted,
          !muted && { opacity: pulseAnim },
        ]}
      >
        {value}
      </Animated.Text>
      {unit !== '' && (
        <Text style={[pStyles.unit, muted && { color: t.textTertiary }]}>
          {unit}
        </Text>
      )}
    </View>
  )
}

const pStyles = StyleSheet.create({
  col: { alignItems: 'flex-end', minWidth: 52 },
  number: { fontSize: 36, fontFamily: font.bold, lineHeight: 40 },
  muted: { fontSize: 18, lineHeight: 22 },
  unit: { fontSize: 12, fontFamily: font.medium, color: '#9ca3af', marginTop: -2 },
})

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
      {/* ── Location banner — shown when permission not granted ── */}
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
            <View style={[s.sectionBadge, { backgroundColor: TRANSPORT_COLORS.trotro }]}>
              <TrotroIcon size={16} active />
            </View>
            <Text style={[s.sectionTitle, { color: TRANSPORT_COLORS.trotro }]}>Trotro Routes</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => router.push('/routes')} style={s.seeAllRow}>
              <Text style={s.seeAllText}>See all</Text>
              <ChevronRight size={14} color={c.amber500} />
            </TouchableOpacity>
          </View>

          {trotroLines.map((line, idx) => {
            const queueColor = line.queueStatus ? QUEUE_COLORS[line.queueStatus] : undefined
            const queueLabel = line.queueStatus ? QUEUE_LABELS[line.queueStatus] : undefined

            return (
              <AnimatedCard
                key={line.id}
                index={idx}
                onPress={() => router.push(line.href as Href)}
                style={[s.card, {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)',
                  borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)',
                }]}
              >
                {/* Route info — left */}
                <View style={s.lineInfo}>
                  <Text style={s.routeName} numberOfLines={1}>
                    {line.from} → {line.to}
                  </Text>

                  {/* Fare — BIG and bold */}
                  <View style={s.fareRow}>
                    <Text style={[s.fareBig, { color: TRANSPORT_COLORS.trotro }]}>
                      ₵{line.fare?.toFixed(2) ?? '--'}
                    </Text>
                    {line.isVerified && (
                      <View style={s.verifiedPill}>
                        <ShieldCheck size={12} color="#16a34a" />
                        <Text style={s.verifiedText}>GPRTU</Text>
                      </View>
                    )}
                  </View>

                  {/* Queue status */}
                  {queueLabel && (
                    <View style={s.queueRow}>
                      <View style={[s.queueDot, { backgroundColor: queueColor }]} />
                      <Text style={[s.queueText, { color: queueColor }]}>{queueLabel}</Text>
                    </View>
                  )}
                </View>

                {/* Time — HUGE animated number */}
                <PulsingTime
                  value={line.timeNumber}
                  unit={line.timeUnit}
                  color={queueColor ?? TRANSPORT_COLORS.trotro}
                />
              </AnimatedCard>
            )
          })}
        </>
      )}

      {/* ── Train Routes ── */}
      {trainLines.length > 0 && (
        <>
          <View style={[s.sectionHeader, trotroLines.length > 0 && { marginTop: 20 }]}>
            <View style={[s.sectionBadge, { backgroundColor: TRANSPORT_COLORS.train }]}>
              <TrainIcon size={16} active />
            </View>
            <Text style={[s.sectionTitle, { color: TRANSPORT_COLORS.train }]}>Train Routes</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => router.push('/train')} style={s.seeAllRow}>
              <Text style={[s.seeAllText, { color: TRANSPORT_COLORS.train }]}>Schedule</Text>
              <ChevronRight size={14} color={TRANSPORT_COLORS.train} />
            </TouchableOpacity>
          </View>

          {trainLines.map((line, idx) => (
            <AnimatedCard
              key={line.id}
              index={trotroLines.length + idx}
              onPress={() => router.push(line.href as Href)}
              style={[s.card, {
                backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.06)',
                borderColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)',
              }]}
            >
              {/* Route info */}
              <View style={s.lineInfo}>
                <View style={s.trainTitleRow}>
                  {line.lineName && (
                    <View style={[s.lineBadge, { backgroundColor: TRANSPORT_COLORS.train }]}>
                      <Text style={s.lineBadgeText}>{line.lineName}</Text>
                    </View>
                  )}
                  <Text style={s.routeName} numberOfLines={1}>
                    {line.from} → {line.to}
                  </Text>
                </View>

                <Text style={[s.fareBig, { color: TRANSPORT_COLORS.train }]}>
                  ₵{line.fare?.toFixed(2) ?? '--'}
                </Text>

                {line.liveTag === 'live' && (
                  <View style={s.liveRow}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>In transit now</Text>
                  </View>
                )}
              </View>

              {/* Time — HUGE animated */}
              <PulsingTime
                value={line.timeNumber}
                unit={line.timeUnit}
                color={line.liveTag === 'live' ? '#22c55e' : TRANSPORT_COLORS.train}
                muted={line.liveTag === 'done'}
              />
            </AnimatedCard>
          ))}
        </>
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
    locationBannerText: {
      flex: 1,
    },
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
      gap: 8,
      marginBottom: 4,
    },
    sectionBadge: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      letterSpacing: 0.2,
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seeAllText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // Route cards — colored backgrounds
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 8,
      gap: 14,
    },

    // Route info
    lineInfo: {
      flex: 1,
      gap: 4,
    },
    routeName: {
      fontSize: 16,
      fontFamily: font.bold,
      color: t.text,
      flexShrink: 1,
    },
    fareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fareBig: {
      fontSize: 22,
      fontFamily: font.bold,
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    verifiedText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: '#16a34a',
    },
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    queueDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    queueText: {
      fontSize: 13,
      fontFamily: font.bold,
    },

    // Train-specific
    trainTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lineBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    lineBadgeText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 0.5,
    },

    // Live indicator
    liveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    liveText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: '#22c55e',
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
