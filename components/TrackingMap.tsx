import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Image, StyleSheet, useColorScheme } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { font } from '@/lib/theme'

const BUS_ICON = require('@/assets/images/home/bus_icon_bg_removed.png')

const MAP_LIGHT = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_DARK = 'mapbox://styles/mapbox/dark-v11'

// Glide the marker between sparse (~10s) GPS fixes instead of teleporting.
const TWEEN_MS = 1800
const SNAP_KM = 2 // first fix or a big jump (>2km) → snap, don't fly across the map

type Pos = { lat: number; lng: number; heading: number | null }

interface TrackingMapProps {
  vehiclePosition: Pos | null
  pickupCoord?: { lat: number; lng: number }
  dropoffCoord?: { lat: number; lng: number }
  /** Road-following corridor (lng,lat pairs) from the bus toward the drop-off. */
  routeLine?: [number, number][]
  etaMins?: number | null
  plateNumber?: string
  status?: 'waiting' | 'en_route' | 'arriving' | 'arrived'
  height?: number | string
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const kmBetween = (a: Pos, b: Pos) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
// Shortest-arc heading interpolation (handles the 359°→1° wrap).
const lerpAngle = (a: number | null, b: number | null, t: number) => {
  if (a == null) return b
  if (b == null) return a
  let d = ((b - a + 540) % 360) - 180
  return a + d * t
}

/**
 * Shared tracking map component.
 * Used by: Trotro booking tracking, Okada ride tracking, Delivery tracking.
 * Notification-first — this map is optional for power users.
 */
export default function TrackingMap({
  vehiclePosition,
  pickupCoord,
  dropoffCoord,
  routeLine,
  etaMins,
  plateNumber,
  status = 'waiting',
  height = '45%',
}: TrackingMapProps) {
  const isDark = useColorScheme() === 'dark'
  const cameraRef = useRef<Mapbox.Camera>(null)

  // ── Interpolated marker position. Tween from the last shown point to each new
  // GPS fix over TWEEN_MS so the bus glides along the road instead of hopping. ──
  const [disp, setDisp] = useState<Pos | null>(vehiclePosition)
  const fromRef = useRef<Pos | null>(vehiclePosition)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!vehiclePosition) { setDisp(null); fromRef.current = null; return }
    const target = vehiclePosition
    const start = fromRef.current
    // First fix or a big jump → snap straight there (no fly across the city).
    if (!start || kmBetween(start, target) > SNAP_KM) {
      fromRef.current = target
      setDisp(target)
      return
    }
    const begin = start
    const t0 = Date.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / TWEEN_MS)
      const e = easeInOut(t)
      setDisp({
        lat: begin.lat + (target.lat - begin.lat) * e,
        lng: begin.lng + (target.lng - begin.lng) * e,
        heading: lerpAngle(begin.heading, target.heading, e),
      })
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [vehiclePosition?.lat, vehiclePosition?.lng, vehiclePosition?.heading])

  // Auto-follow the (target) vehicle position.
  useEffect(() => {
    if (vehiclePosition && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [vehiclePosition.lng, vehiclePosition.lat],
        zoomLevel: 15,
        animationDuration: 1000,
        animationMode: 'flyTo',
      })
    }
  }, [vehiclePosition?.lat, vehiclePosition?.lng])

  const center = disp
    ? [disp.lng, disp.lat]
    : pickupCoord
    ? [pickupCoord.lng, pickupCoord.lat]
    : [-0.187, 5.6037]

  const statusColors = {
    waiting: '#F59E0B',
    en_route: '#08b64f',
    arriving: '#08b64f',
    arrived: '#22C55E',
  }

  return (
    <View style={[styles.container, { height: height as any }]}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? MAP_DARK : MAP_LIGHT}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={center as [number, number]}
          zoomLevel={14}
          animationMode="flyTo"
          animationDuration={800}
        />
        <Mapbox.UserLocation visible />

        {/* Corridor — road-following line from the bus toward the drop-off, so the
            marker visibly rides the lane. Drawn before markers so it sits under. */}
        {routeLine && routeLine.length > 1 && (
          <Mapbox.ShapeSource
            id="tracking-route"
            shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeLine }, properties: {} }}
          >
            <Mapbox.LineLayer
              id="tracking-route-casing"
              style={{ lineColor: '#FFFFFF', lineWidth: 8, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.9 }}
            />
            <Mapbox.LineLayer
              id="tracking-route-core"
              style={{ lineColor: statusColors[status], lineWidth: 4.5, lineCap: 'round', lineJoin: 'round' }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Vehicle marker — the actual minibus icon, pointed in its heading.
            Uses the interpolated `disp` so it glides between GPS fixes. */}
        {disp && (
          <Mapbox.MarkerView id="tracking-vehicle" coordinate={[disp.lng, disp.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View style={[styles.busPuck, { borderColor: statusColors[status] }]}>
              <Image
                source={BUS_ICON}
                style={[styles.busImg, disp.heading != null ? { transform: [{ rotate: `${disp.heading}deg` }] } : null]}
                resizeMode="contain"
              />
            </View>
          </Mapbox.MarkerView>
        )}

        {/* Pickup marker */}
        {pickupCoord && (
          <Mapbox.ShapeSource
            id="tracking-pickup"
            shape={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [pickupCoord.lng, pickupCoord.lat] },
              properties: {},
            }}
          >
            <Mapbox.CircleLayer
              id="tracking-pickup-dot"
              style={{
                circleRadius: 6,
                circleColor: '#08b64f',
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Dropoff marker */}
        {dropoffCoord && (
          <Mapbox.ShapeSource
            id="tracking-dropoff"
            shape={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [dropoffCoord.lng, dropoffCoord.lat] },
              properties: {},
            }}
          >
            <Mapbox.CircleLayer
              id="tracking-dropoff-dot"
              style={{
                circleRadius: 6,
                circleColor: '#1C1917',
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* ETA overlay */}
      {etaMins != null && (
        <View style={[styles.etaBadge, { backgroundColor: isDark ? '#1C1917' : '#FFFFFF' }]}>
          <Text style={[styles.etaLabel, { color: isDark ? '#78716c' : '#6B7280' }]}>
            {status === 'arrived' ? 'ARRIVED' : 'ARRIVING IN'}
          </Text>
          <Text style={[styles.etaValue, { color: statusColors[status] }]}>
            {status === 'arrived' ? 'Now' : `${etaMins} min`}
          </Text>
          {plateNumber && (
            <Text style={[styles.etaPlate, { color: isDark ? '#A8A29E' : '#9CA3AF' }]}>{plateNumber}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  busPuck: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 6,
  },
  busImg: { width: 28, height: 28 },
  etaBadge: {
    position: 'absolute', top: 60, left: 16,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  etaLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  etaValue: { fontFamily: font.black, fontSize: 22, letterSpacing: -1, marginTop: 2 },
  etaPlate: { fontFamily: font.medium, fontSize: 11, marginTop: 2 },
})
