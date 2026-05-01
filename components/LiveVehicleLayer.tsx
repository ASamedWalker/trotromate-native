import { useMemo } from 'react'
import Mapbox from '@rnmapbox/maps'
import type { VehiclePosition } from '@/lib/services/vehicle-positions'

interface Props {
  vehicles: VehiclePosition[]
  onVehicleTap?: (vehicle: VehiclePosition) => void
}

/**
 * Mapbox layer showing live trotro positions on the map.
 * Uses ShapeSource + CircleLayer + SymbolLayer for GPU-rendered performance.
 */
export default function LiveVehicleLayer({ vehicles, onVehicleTap }: Props) {
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: vehicles.map((v) => ({
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
        stale: v.isStale ? 1 : 0, // Mapbox expressions need numbers, not booleans
      },
    })),
  }), [vehicles])

  if (vehicles.length === 0) return null

  return (
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
      {/* Outer glow */}
      <Mapbox.CircleLayer
        id="vehicle-glow"
        style={{
          circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 20, 17, 28],
          circleColor: '#FFAD3A',
          circleOpacity: 0.15,
        }}
      />

      {/* Main vehicle dot — bright amber with white border */}
      <Mapbox.CircleLayer
        id="vehicle-dot"
        style={{
          circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 10, 17, 14],
          circleColor: ['case', ['==', ['get', 'stale'], 1], '#78716c', '#FFAD3A'],
          circleStrokeWidth: 3,
          circleStrokeColor: '#ffffff',
        }}
      />

      {/* Plate number label at zoom 14+ */}
      <Mapbox.SymbolLayer
        id="vehicle-labels"
        minZoomLevel={14}
        style={{
          textField: ['get', 'plateNumber'],
          textSize: 10,
          textFont: ['DIN Pro Medium'],
          textOffset: [0, 1.8],
          textAnchor: 'top',
          textColor: '#FFAD3A',
          textHaloColor: '#1c1917',
          textHaloWidth: 2,
          textAllowOverlap: false,
        }}
      />

      {/* Route label at zoom 15+ */}
      <Mapbox.SymbolLayer
        id="vehicle-route-labels"
        minZoomLevel={15}
        style={{
          textField: ['get', 'routeLabel'],
          textSize: 9,
          textFont: ['DIN Pro Medium'],
          textOffset: [0, 3.0],
          textAnchor: 'top',
          textColor: '#a8a29e',
          textHaloColor: '#1c1917',
          textHaloWidth: 1.5,
          textAllowOverlap: false,
        }}
      />
    </Mapbox.ShapeSource>
  )
}
