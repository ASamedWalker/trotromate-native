import { useState, useRef, useEffect, useMemo, memo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  useColorScheme,
  StyleSheet,
  Platform,
} from 'react-native'
import { Map, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import { c, themed, font } from '@/lib/theme'
import type { TransferPlan } from '@/lib/services/route-planner'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')

const MAP_HEIGHT = 220

const LINE_COLORS: Record<string, string> = {
  trotro: '#d97706',
  okada: '#f97316',
  walk: '#9ca3af',
}

interface RoutePlanMapProps {
  plans: TransferPlan[]
  selectedPlanIndex: number | null
  from: string
  to: string
  stationCoords: Record<string, { lat: number; lon: number }>
}

/* ── Pin marker ─────────────────────────────────────── */

function PlanPin({ color, label, size = 36 }: { color: string; label: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center', width: size + 20 }}>
      <View style={{ alignItems: 'center' }}>
        {/* Circle head */}
        <View style={{
          width: size * 0.75,
          height: size * 0.75,
          borderRadius: size * 0.375,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
            android: { elevation: 6 },
          }),
        }}>
          <View style={{
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: '#fff',
            opacity: 0.9,
          }} />
        </View>
        {/* Point */}
        <View style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.18,
          borderRightWidth: size * 0.18,
          borderTopWidth: size * 0.3,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
          marginTop: -2,
        }} />
      </View>
      {/* Label */}
      <View style={{
        backgroundColor: color,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 2,
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
          android: { elevation: 2 },
        }),
      }}>
        <Text style={{ fontSize: 9, fontFamily: font.bold, color: '#fff', textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </View>
  )
}

/* ── Map component ──────────────────────────────────── */

function RoutePlanMapInner({ plans, selectedPlanIndex, from, to, stationCoords }: RoutePlanMapProps) {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const [expanded, setExpanded] = useState(false)
  const heightAnim = useRef(new Animated.Value(0)).current
  const cameraRef = useRef<Mapbox.Camera>(null)

  // Case-insensitive coord lookup
  const coordsLookup = useMemo(() => {
    const map: Record<string, { lat: number; lon: number }> = {}
    for (const [name, coord] of Object.entries(stationCoords)) {
      map[name.toLowerCase()] = coord
    }
    return map
  }, [stationCoords])

  function getCoord(name: string) {
    return coordsLookup[name.toLowerCase()] || null
  }

  const fromCoord = getCoord(from)
  const toCoord = getCoord(to)
  const hasCoords = !!fromCoord && !!toCoord

  const selectedPlan = selectedPlanIndex !== null ? plans[selectedPlanIndex] : null

  // Animate expand/collapse
  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: expanded ? MAP_HEIGHT : 0,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [expanded])

  // Auto-fit camera when selection or expanded state changes
  useEffect(() => {
    if (!expanded || !cameraRef.current || !hasCoords) return

    const points: { lat: number; lon: number }[] = []
    if (fromCoord) points.push(fromCoord)
    if (toCoord) points.push(toCoord)

    if (selectedPlan?.transfer_hub) {
      const hubCoord = getCoord(selectedPlan.transfer_hub)
      if (hubCoord) points.push(hubCoord)
    }

    if (points.length < 2) return

    const lats = points.map(p => p.lat)
    const lons = points.map(p => p.lon)

    // Small delay to let the map render
    const timer = setTimeout(() => {
      cameraRef.current?.fitBounds(
        [Math.max(...lons), Math.max(...lats)],
        [Math.min(...lons), Math.min(...lats)],
        [50, 50, 50, 50],
        500,
      )
    }, 100)

    return () => clearTimeout(timer)
  }, [selectedPlanIndex, expanded, from, to])

  // Build GeoJSON features for route legs
  const legFeatures = useMemo(() => {
    if (!selectedPlan) {
      // Default: dashed line between from/to
      if (fromCoord && toCoord) {
        return [{
          id: 'default',
          transportType: 'walk',
          geojson: {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: [
                [fromCoord.lon, fromCoord.lat],
                [toCoord.lon, toCoord.lat],
              ],
            },
          },
        }]
      }
      return []
    }

    return selectedPlan.legs
      .map((leg, i) => {
        const legFrom = getCoord(leg.from)
        const legTo = getCoord(leg.to)
        if (!legFrom || !legTo) return null
        return {
          id: `leg-${i}`,
          transportType: leg.transport_type,
          geojson: {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: [
                [legFrom.lon, legFrom.lat],
                [legTo.lon, legTo.lat],
              ],
            },
          },
        }
      })
      .filter(Boolean) as { id: string; transportType: string; geojson: GeoJSON.Feature }[]
  }, [selectedPlan, fromCoord, toCoord])

  if (!hasCoords) return null

  const centerLon = (fromCoord!.lon + toCoord!.lon) / 2
  const centerLat = (fromCoord!.lat + toCoord!.lat) / 2

  return (
    <View style={s.container}>
      {/* Toggle bar */}
      <TouchableOpacity
        style={s.toggleBar}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Map size={16} color={expanded ? '#e88a3a' : t.textSecondary} />
        <Text style={[s.toggleText, expanded && { color: '#e88a3a', fontFamily: font.semibold }]}>
          {expanded ? 'Hide map' : 'Show map'}
        </Text>
        {expanded
          ? <ChevronUp size={16} color="#e88a3a" />
          : <ChevronDown size={16} color={t.textSecondary} />
        }
      </TouchableOpacity>

      {/* Map container */}
      <Animated.View style={[s.mapWrapper, { height: heightAnim }]}>
        {expanded && (
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL={Mapbox.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
            compassEnabled={false}
            scaleBarEnabled={false}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [centerLon, centerLat],
                zoomLevel: 12,
              }}
            />

            {/* Route lines */}
            {legFeatures.map((feat) => {
              const isWalk = feat.transportType === 'walk'
              const lineStyle: Record<string, unknown> = {
                lineColor: LINE_COLORS[feat.transportType] || LINE_COLORS.trotro,
                lineWidth: 4,
                lineCap: 'round' as const,
                lineJoin: 'round' as const,
                lineOpacity: isWalk ? 0.5 : 0.9,
              }
              if (isWalk) lineStyle.lineDasharray = [2, 3]
              return (
                <Mapbox.ShapeSource
                  key={feat.id}
                  id={`src-${feat.id}`}
                  shape={feat.geojson}
                >
                  <Mapbox.LineLayer
                    id={`line-${feat.id}`}
                    style={lineStyle}
                  />
                </Mapbox.ShapeSource>
              )
            })}

            {/* Origin marker */}
            <Mapbox.MarkerView
              coordinate={[fromCoord!.lon, fromCoord!.lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PlanPin color="#22c55e" label={from} />
            </Mapbox.MarkerView>

            {/* Destination marker */}
            <Mapbox.MarkerView
              coordinate={[toCoord!.lon, toCoord!.lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PlanPin color="#ef4444" label={to} />
            </Mapbox.MarkerView>

            {/* Transfer hub marker */}
            {selectedPlan?.transfer_hub && (() => {
              const hubCoord = getCoord(selectedPlan.transfer_hub!)
              if (!hubCoord) return null
              return (
                <Mapbox.MarkerView
                  coordinate={[hubCoord.lon, hubCoord.lat]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <PlanPin color="#0ea5e9" label={selectedPlan.transfer_hub!} size={30} />
                </Mapbox.MarkerView>
              )
            })()}
          </Mapbox.MapView>
        )}
      </Animated.View>
    </View>
  )
}

export const RoutePlanMap = memo(RoutePlanMapInner)

/* ── Styles ─────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      marginHorizontal: 20,
      marginTop: 12,
    },
    toggleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: isDark ? c.stone800 : c.stone100,
    },
    toggleText: {
      flex: 1,
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    mapWrapper: {
      borderRadius: 16,
      overflow: 'hidden',
      marginTop: 8,
    },
  })
}
