import { useMemo } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { MapPin, ChevronRight } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import { c, themed, font } from '@/lib/theme'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')
import { useStations } from '@/lib/hooks/useStations'
import { useLocation } from '@/lib/hooks/useLocation'
import { getStationCoords } from '@/lib/utils/station-coords'
import { getWaitEstimate, type StationWithQueue, type QueueStatus } from '@/lib/services/stations'

const ACCRA_CENTER: [number, number] = [-0.187, 5.6037]

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const TROSKI_ORANGE = '#e88a3a'

function getStationColor(station: StationWithQueue): string {
  const status = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  return status ? QUEUE_COLORS[status] : TROSKI_ORANGE
}

export function MiniMap() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)
  const { stations } = useStations()
  const { location } = useLocation()

  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : ACCRA_CENTER

  // Build GeoJSON for station dots
  const geojson = useMemo(() => {
    const features = stations
      .map((station) => {
        const coords = getStationCoords(station)
        if (!coords) return null
        const stat = station.queue_stats?.[0]
        const waitText = stat ? getWaitEstimate(stat) : ''
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [coords.longitude, coords.latitude],
          },
          properties: {
            id: station.id,
            name: station.name,
            color: getStationColor(station),
            waitText,
            isMajor: station.is_major ? 1 : 0,
          },
        }
      })
      .filter(Boolean)

    return { type: 'FeatureCollection' as const, features }
  }, [stations])

  // Count stations with active queue data
  const activeCount = stations.filter(
    (st) => st.queue_stats?.[0]?.current_status,
  ).length

  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <MapPin size={16} color="#f97316" />
        <Text style={s.headerText}>Stations Near You</Text>
        <TouchableOpacity
          onPress={() => router.push('/stations')}
          style={s.seeAll}
          activeOpacity={0.7}
        >
          <Text style={s.seeAllText}>See all</Text>
          <ChevronRight size={14} color={c.amber500} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/stations')}
        style={s.mapContainer}
      >
        <Mapbox.MapView
          style={s.map}
          styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          zoomEnabled={false}
          attributionEnabled={false}
          logoEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
        >
          <Mapbox.Camera
            centerCoordinate={center}
            zoomLevel={12}
            animationMode="none"
          />

          <Mapbox.UserLocation visible={true} />

          <Mapbox.ShapeSource id="mini-stations" shape={geojson as any}>
            {/* Queue-colored dots */}
            <Mapbox.CircleLayer
              id="mini-station-dots"
              style={{
                circleRadius: [
                  'case',
                  ['==', ['get', 'isMajor'], 1], 7,
                  5,
                ],
                circleColor: ['get', 'color'],
                circleOpacity: 0.9,
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 2,
              }}
            />
            {/* Wait time labels below dots */}
            <Mapbox.SymbolLayer
              id="mini-station-labels"
              minZoomLevel={11}
              style={{
                textField: ['get', 'waitText'],
                textSize: 9,
                textColor: isDark ? '#d1d5db' : '#4b5563',
                textOffset: [0, 1.5],
                textAllowOverlap: false,
                textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              }}
            />
          </Mapbox.ShapeSource>
        </Mapbox.MapView>

        {/* Floating badge */}
        {activeCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {activeCount} live queue{activeCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Tap hint overlay */}
        <View style={s.tapHint}>
          <Text style={s.tapHintText}>Tap to explore full map</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    wrapper: {
      marginHorizontal: 20,
      marginTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    headerText: {
      flex: 1,
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: c.amber500,
    },
    mapContainer: {
      height: 200,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
    },
    map: {
      flex: 1,
    },
    badge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 11,
      fontFamily: font.medium,
    },
    tapHint: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    tapHintText: {
      color: '#ffffff',
      fontSize: 11,
      fontFamily: font.medium,
    },
  })
}
