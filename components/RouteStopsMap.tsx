import { useRef, useMemo, useCallback } from 'react'
import { View, Text, useColorScheme, StyleSheet } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { font } from '@/lib/theme'
import type { RouteStop } from '@/lib/types'

// Mapbox token set centrally in _layout.tsx

const MAP_HEIGHT = 240

interface Props {
  stops: RouteStop[]
  routeName: string
}

export function RouteStopsMap({ stops, routeName }: Props) {
  const isDark = useColorScheme() === 'dark'
  const cameraRef = useRef<Mapbox.Camera>(null)
  const s = useMemo(() => getStyles(isDark), [isDark])

  // Build polyline GeoJSON from ordered stops
  const lineGeoJSON = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: stops.map(s => [s.longitude, s.latitude]),
    },
  }), [stops])

  // Build stop points GeoJSON
  const stopsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stops.map(stop => ({
      type: 'Feature' as const,
      properties: {
        name: stop.stop_name,
        isTerminal: stop.is_terminal,
        order: stop.stop_order,
        distKm: stop.distance_from_origin_km,
        durMins: stop.duration_from_origin_mins,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [stop.longitude, stop.latitude],
      },
    })),
  }), [stops])

  // Camera bounds
  const bounds = useMemo(() => {
    const lats = stops.map(s => s.latitude)
    const lngs = stops.map(s => s.longitude)
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    }
  }, [stops])

  if (stops.length < 2) return null

  return (
    <View style={s.container}>
      <Mapbox.MapView
        style={s.map}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          bounds={{ ne: bounds.ne, sw: bounds.sw, paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}
          animationDuration={0}
        />

        {/* Route polyline */}
        <Mapbox.ShapeSource id="route-line" shape={lineGeoJSON}>
          {/* Outer glow */}
          <Mapbox.LineLayer
            id="route-line-glow"
            style={{
              lineColor: '#f8a010',
              lineWidth: 6,
              lineOpacity: 0.3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          {/* Main line */}
          <Mapbox.LineLayer
            id="route-line-main"
            style={{
              lineColor: '#f8a010',
              lineWidth: 3,
              lineOpacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>

        {/* Stop dots */}
        <Mapbox.ShapeSource id="route-stops" shape={stopsGeoJSON}>
          {/* Intermediate stops: small dots */}
          <Mapbox.CircleLayer
            id="stops-intermediate"
            filter={['==', ['get', 'isTerminal'], false]}
            style={{
              circleRadius: 4,
              circleColor: '#fff',
              circleStrokeColor: '#f8a010',
              circleStrokeWidth: 2,
            }}
          />
          {/* Terminal stops: larger dots */}
          <Mapbox.CircleLayer
            id="stops-terminal"
            filter={['==', ['get', 'isTerminal'], true]}
            style={{
              circleRadius: 7,
              circleColor: '#f8a010',
              circleStrokeColor: '#fff',
              circleStrokeWidth: 2.5,
            }}
          />
          {/* Terminal labels */}
          <Mapbox.SymbolLayer
            id="stops-terminal-labels"
            filter={['==', ['get', 'isTerminal'], true]}
            style={{
              textField: ['get', 'name'],
              textFont: ['DIN Pro Medium'],
              textSize: 11,
              textOffset: [0, 1.4],
              textAnchor: 'top',
              textColor: isDark ? '#f5f5f4' : '#312e2d',
              textHaloColor: isDark ? '#1c1c1e' : '#ffffff',
              textHaloWidth: 1.5,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* Stop count badge */}
      <View style={s.badge}>
        <Text style={s.badgeText}>{stops.length} stops</Text>
      </View>
    </View>
  )
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      overflow: 'hidden',
      marginTop: 16,
    },
    map: {
      height: MAP_HEIGHT,
      width: '100%',
    },
    badge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.9)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: '#f8a010',
    },
  })
