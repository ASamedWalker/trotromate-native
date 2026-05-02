import { useMemo, useEffect, useRef } from 'react'
import Mapbox from '@rnmapbox/maps'
import type { VehiclePosition } from '@/lib/services/vehicle-positions'

const trotroIcon = require('@/assets/images/new_troski_view.png')

// Route destinations for ETA estimation
const ROUTE_DESTINATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  'Circle → Madina': { lat: 5.6697, lng: -0.1662, name: 'Madina' },
  'Kasoa → Kaneshie': { lat: 5.5508, lng: -0.2377, name: 'Kaneshie' },
  'Madina → Accra': { lat: 5.5502, lng: -0.2174, name: 'Accra Central' },
  'Achimota → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Tema → Accra': { lat: 5.5502, lng: -0.2174, name: 'Accra Central' },
  'Lapaz → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Nima → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Adenta → Madina': { lat: 5.6697, lng: -0.1662, name: 'Madina' },
  'Dansoman → Kaneshie': { lat: 5.5508, lng: -0.2377, name: 'Kaneshie' },
  'Osu → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
}

function estimateETAMins(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round((dist / 20) * 60) // 20 km/h avg trotro speed
}

interface Props {
  vehicles: VehiclePosition[]
  onVehicleTap?: (vehicle: VehiclePosition) => void
}

/**
 * Live vehicle layer — amber dots with pulse, direction arrows, ETA labels.
 * GPU-rendered via ShapeSource + CircleLayer + SymbolLayer.
 */
export default function LiveVehicleLayer({ vehicles, onVehicleTap }: Props) {
  const pulseRef = useRef<Mapbox.ShapeSource>(null)

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: vehicles.map((v) => {
      const dest = ROUTE_DESTINATIONS[v.routeLabel || '']
      const etaMins = dest ? estimateETAMins(v.latitude, v.longitude, dest.lat, dest.lng) : null

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [v.longitude, v.latitude],
        },
        properties: {
          vanId: v.vanId,
          plateNumber: v.plateNumber,
          routeLabel: v.routeLabel || '',
          heading: v.heading || 0,
          speed: v.speed || 0,
          stale: v.isStale ? 1 : 0,
          etaLabel: etaMins != null ? `${etaMins} min` : '',
        },
      }
    }),
  }), [vehicles])

  // Pulse animation via ref (no React re-renders)
  useEffect(() => {
    if (vehicles.length === 0) return
    let phase = 0
    let animId: number

    const tick = () => {
      phase += 0.03
      const s = Math.sin(phase)
      const scale = 1 + 0.25 * s

      try {
        // Update pulse ring radius via native props
        const features = vehicles.map((v) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
          properties: { radius: 20 * scale, opacity: 0.06 + 0.05 * s },
        }))
        const shape = JSON.stringify({ type: 'FeatureCollection', features })
        ;(pulseRef.current as any)?.setNativeProps({ shape })
      } catch {}

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [vehicles])

  if (vehicles.length === 0) return null

  return (
    <>
      {/* ── Pulse ring (animated via ref) ── */}
      <Mapbox.ShapeSource
        ref={pulseRef}
        id="vehicle-pulse"
        shape={{ type: 'FeatureCollection', features: [] } as any}
      >
        <Mapbox.CircleLayer
          id="vehicle-pulse-ring"
          style={{
            circleRadius: ['get', 'radius'],
            circleColor: '#FFAD3A',
            circleOpacity: ['get', 'opacity'],
          }}
        />
      </Mapbox.ShapeSource>

      {/* ── Trotro bus icon ── */}
      <Mapbox.Images images={{ 'trotro-bus': trotroIcon }} />

      {/* ── Main vehicle source ── */}
      <Mapbox.ShapeSource
        id="live-vehicles"
        shape={geojson}
        hitbox={{ width: 30, height: 30 }}
        onPress={(e) => {
          const feature = e.features?.[0]
          if (!feature?.properties?.vanId || !onVehicleTap) return
          const vehicle = vehicles.find(v => v.vanId === feature.properties!.vanId)
          if (vehicle) onVehicleTap(vehicle)
        }}
      >
        {/* Glow */}
        <Mapbox.CircleLayer
          id="vehicle-glow"
          style={{
            circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 14, 17, 22],
            circleColor: '#FFAD3A',
            circleOpacity: 0.18,
          }}
        />

        {/* Main dot — visible at low zoom, fades as bus icon appears */}
        <Mapbox.CircleLayer
          id="vehicle-dot"
          style={{
            circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 5, 12, 8, 13, 0],
            circleColor: ['case', ['==', ['get', 'stale'], 1], '#78716c', '#FFAD3A'],
            circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 10, 2, 12, 3, 13, 0],
            circleStrokeColor: '#ffffff',
            circleOpacity: ['interpolate', ['linear'], ['zoom'], 12, 1, 13, 0],
          }}
        />

        {/* 3D Bus icon — appears at zoom 12+, rotates with heading */}
        <Mapbox.SymbolLayer
          id="vehicle-bus-icon"
          minZoomLevel={12}
          style={{
            iconImage: 'trotro-bus',
            iconSize: ['interpolate', ['linear'], ['zoom'], 12, 0.4, 14, 0.55, 17, 0.75],
            iconRotate: ['get', 'heading'],
            iconRotationAlignment: 'map',
            iconPitchAlignment: 'map',
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0, 12.5, 1],
          }}
        />

        {/* No text labels on map — info shown in smart banner instead */}
      </Mapbox.ShapeSource>
    </>
  )
}
