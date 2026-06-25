import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, useColorScheme } from 'react-native'
import Mapbox from '@rnmapbox/maps'
import { font } from '@/lib/theme'

const BUS_ICON = require('@/assets/images/home/bus_icon_bg_removed.png')

const MAP_LIGHT = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_DARK = 'mapbox://styles/mapbox/dark-v11'

interface TrackingMapProps {
  vehiclePosition: { lat: number; lng: number; heading: number | null } | null
  pickupCoord?: { lat: number; lng: number }
  dropoffCoord?: { lat: number; lng: number }
  etaMins?: number | null
  plateNumber?: string
  status?: 'waiting' | 'en_route' | 'arriving' | 'arrived'
  height?: number | string
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
  etaMins,
  plateNumber,
  status = 'waiting',
  height = '45%',
}: TrackingMapProps) {
  const isDark = useColorScheme() === 'dark'
  const cameraRef = useRef<Mapbox.Camera>(null)

  // Auto-follow vehicle
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

  const center = vehiclePosition
    ? [vehiclePosition.lng, vehiclePosition.lat]
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

        {/* Vehicle marker — the actual minibus icon, pointed in its heading */}
        {vehiclePosition && (
          <Mapbox.MarkerView id="tracking-vehicle" coordinate={[vehiclePosition.lng, vehiclePosition.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View style={[styles.busPuck, { borderColor: statusColors[status] }]}>
              <Image
                source={BUS_ICON}
                style={[styles.busImg, vehiclePosition.heading != null ? { transform: [{ rotate: `${vehiclePosition.heading}deg` }] } : null]}
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
