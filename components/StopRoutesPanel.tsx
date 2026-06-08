import React, { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { X, MapPin, Clock, ShieldCheck, ChevronRight, Users, Flame, BusFront, AlertTriangle } from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import { timeAgo } from '@/lib/utils/time'
import { fetchRoutesByIds } from '@/lib/services/routes'
import { formatDistance } from '@/lib/utils/distance'
import type { NearbyStop } from '@/lib/hooks/useNearbyRouteStops'
import type { RouteWithStats } from '@/lib/types'

interface Props {
  stop: NearbyStop
  onClose: () => void
}

export function StopRoutesPanel({ stop, onClose }: Props) {
  const isDark = useColorScheme() === 'dark'
  const router = useRouter()
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { data: routes = [], isLoading } = useQuery<RouteWithStats[]>({
    queryKey: ['routes-for-stop', stop.routeIds],
    queryFn: () => fetchRoutesByIds(stop.routeIds),
    enabled: stop.routeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <MapPin size={18} color={c.amber500} />
          <View style={{ flex: 1 }}>
            <Text style={s.stopName} numberOfLines={1}>
              {stop.name.charAt(0).toUpperCase() + stop.name.slice(1)}
            </Text>
            {stop.distanceKm != null && (
              <Text style={s.distanceText}>
                {formatDistance(stop.distanceKm)} away
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.closeBtn}>
          <X size={18} color={isDark ? c.stone400 : c.stone500} />
        </TouchableOpacity>
      </View>

      {/* Live Queue Status Card */}
      {stop.queueStatus ? (
        <View style={[s.queueCard, {
          borderLeftColor: stop.queueStatus === 'very_long' ? '#ef4444'
            : stop.queueStatus === 'long' ? '#f97316'
            : stop.queueStatus === 'moderate' ? '#f59e0b'
            : '#22c55e',
        }]}>
          <View style={s.queueCardTop}>
            {stop.queueStatus === 'very_long' || stop.queueStatus === 'long' ? (
              <Flame size={20} color={stop.queueStatus === 'very_long' ? '#ef4444' : '#f97316'} fill={stop.queueStatus === 'very_long' ? '#ef4444' : undefined} />
            ) : stop.queueStatus === 'moderate' ? (
              <AlertTriangle size={20} color="#f59e0b" />
            ) : (
              <BusFront size={20} color="#22c55e" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.queueCardTitle}>
                {stop.queueStatus === 'very_long' ? 'Very Long Queue'
                  : stop.queueStatus === 'long' ? 'Long Queue'
                  : stop.queueStatus === 'moderate' ? 'Moderate Queue'
                  : stop.queueStatus === 'short' ? 'Short Queue'
                  : 'No Queue'}
              </Text>
              {stop.waitText ? (
                <Text style={s.queueCardWait}>Estimated wait: ~{stop.waitText}</Text>
              ) : null}
              {stop.lastReportAt ? (
                <View style={s.freshnessRow}>
                  <View style={[s.freshnessDot, {
                    backgroundColor: (Date.now() - new Date(stop.lastReportAt).getTime()) < 15 * 60 * 1000
                      ? '#22c55e'
                      : (Date.now() - new Date(stop.lastReportAt).getTime()) < 45 * 60 * 1000
                      ? '#f59e0b'
                      : '#ef4444',
                  }]} />
                  <Text style={s.freshnessText}>
                    {timeAgo(stop.lastReportAt)}
                    {stop.reportCount && stop.reportCount > 0
                      ? ` · ${stop.reportCount} report${stop.reportCount !== 1 ? 's' : ''}`
                      : ''}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[s.queueBadge, {
              backgroundColor: stop.queueStatus === 'very_long' ? 'rgba(239,68,68,0.15)'
                : stop.queueStatus === 'long' ? 'rgba(249,115,22,0.15)'
                : stop.queueStatus === 'moderate' ? 'rgba(245,158,11,0.15)'
                : 'rgba(34,197,94,0.15)',
            }]}>
              <Text style={[s.queueBadgeText, {
                color: stop.queueStatus === 'very_long' ? '#ef4444'
                  : stop.queueStatus === 'long' ? '#f97316'
                  : stop.queueStatus === 'moderate' ? '#f59e0b'
                  : '#22c55e',
              }]}>LIVE</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Routes count */}
      <Text style={s.routesLabel}>
        {routes.length} route{routes.length !== 1 ? 's' : ''} from this stop
      </Text>

      {/* Routes list */}
      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={c.amber500} />
        </View>
      ) : routes.length === 0 ? (
        <Text style={s.emptyText}>No route details available</Text>
      ) : (
        routes.map((route) => (
          <TouchableOpacity
            key={route.id}
            style={s.routeCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/routes/${route.id}` as any)}
          >
            {/* Left accent bar */}
            <View style={s.accentBar} />

            <View style={s.routeBody}>
              <View style={s.routeTop}>
                <Text style={s.routeLabel} numberOfLines={1}>
                  {route.from_location} → {route.to_location}
                </Text>
                <ChevronRight size={16} color={isDark ? c.stone500 : c.stone400} />
              </View>

              {route.via && (
                <Text style={s.viaText} numberOfLines={1}>via {route.via}</Text>
              )}

              <View style={s.routeMeta}>
                {/* Fare */}
                <View style={s.metaChip}>
                  <Text style={s.fareText}>
                    GH₵{route.official_fare.toFixed(2)}
                  </Text>
                </View>

                {/* Duration */}
                {route.estimated_duration_mins > 0 && (
                  <View style={s.metaChip}>
                    <Clock size={12} color={isDark ? c.stone400 : c.stone500} />
                    <Text style={s.metaText}>
                      {route.estimated_duration_mins} min
                    </Text>
                  </View>
                )}

                {/* Distance */}
                {route.distance_km != null && route.distance_km > 0 && (
                  <View style={s.metaChip}>
                    <Text style={s.metaText}>
                      {formatDistance(route.distance_km)}
                    </Text>
                  </View>
                )}

                {/* GPRTU badge */}
                {route.is_gprtu_verified && (
                  <View style={s.gprtuBadge}>
                    <ShieldCheck size={12} color="#16a34a" />
                    <Text style={s.gprtuText}>GPRTU</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    stopName: {
      fontSize: 20,
      fontFamily: font.bold,
      color: t.text,
    },
    distanceText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textTertiary,
      marginTop: 1,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    queueCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafaf9',
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderLeftWidth: 3,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    queueCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    queueCardTitle: {
      fontSize: 15,
      fontFamily: font.bold,
      color: isDark ? '#fafaf9' : '#1c1917',
    },
    queueCardWait: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#78716c',
      marginTop: 2,
    },
    queueBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    queueBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 1.5,
    },
    freshnessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
    },
    freshnessDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    freshnessText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: isDark ? 'rgba(255,255,255,0.4)' : '#a8a29e',
    },
    routesLabel: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 10,
    },
    loadingWrap: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      fontFamily: font.regular,
      color: t.textTertiary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    routeCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      borderRadius: 14,
      marginBottom: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 8,
      elevation: isDark ? 0 : 3,
    },
    accentBar: {
      width: 5,
      backgroundColor: c.amber500,
    },
    routeBody: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    routeTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    routeLabel: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: t.text,
      flex: 1,
    },
    viaText: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textTertiary,
      marginTop: 2,
    },
    routeMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    fareText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: c.amber600,
    },
    metaText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? c.stone400 : c.stone500,
    },
    gprtuBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(22,163,74,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    gprtuText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: '#16a34a',
      letterSpacing: 0.5,
    },
  })
}
