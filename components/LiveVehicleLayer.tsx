import { useMemo } from 'react'
import Mapbox from '@rnmapbox/maps'
import { View, Text } from 'react-native'
import { BusFront } from 'lucide-react-native'
import type { VehiclePosition } from '@/lib/services/vehicle-positions'

interface Props {
  vehicles: VehiclePosition[]
  onVehicleTap?: (vehicle: VehiclePosition) => void
}

/**
 * Mapbox layer showing live trotro positions on the map.
 * Uses ShapeSource + SymbolLayer for GPU-rendered performance (handles 100+ vehicles).
 * Amber brand color, heading-based rotation, glow ring.
 */
export default function LiveVehicleLayer({ vehicles, onVehicleTap }: Props) {
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: vehicles.map((v) => ({
      type: 'Feature' as const,
      id: v.vanId,
      geometry: {
        type: 'Point' as const,
        coordinates: [v.longitude, v.latitude],
      },
      properties: {
        vanId: v.vanId,
        plateNumber: v.plateNumber,
        routeLabel: v.routeLabel || '',
        heading: v.heading || 0,
        isStale: v.isStale,
      },
    })),
  }), [vehicles])

  if (vehicles.length === 0) return null

  return (
    <>
      {/* Vehicle icon registered in Mapbox.Images */}
      <Mapbox.Images>
        <Mapbox.Image name="vehicle-trotro">
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#FFAD3A',
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 2.5, borderColor: '#fff',
            elevation: 6,
            shadowColor: '#FFAD3A', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4, shadowRadius: 6,
          }}>
            <BusFront size={18} color="#1c1917" strokeWidth={2.5} />
          </View>
        </Mapbox.Image>
        <Mapbox.Image name="vehicle-trotro-stale">
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: '#78716c',
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 2, borderColor: '#a8a29e',
            opacity: 0.6,
          }}>
            <BusFront size={16} color="#e7e5e3" strokeWidth={2} />
          </View>
        </Mapbox.Image>
      </Mapbox.Images>

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
        {/* Ambient glow ring behind vehicle */}
        <Mapbox.CircleLayer
          id="vehicle-glow"
          style={{
            circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 16, 17, 24],
            circleColor: ['case', ['get', 'isStale'], '#78716c', '#FFAD3A'],
            circleOpacity: ['case', ['get', 'isStale'], 0.08, 0.15],
          }}
        />

        {/* Vehicle icon */}
        <Mapbox.SymbolLayer
          id="vehicle-icons"
          style={{
            iconImage: ['case', ['get', 'isStale'], 'vehicle-trotro-stale', 'vehicle-trotro'],
            iconSize: ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.85, 17, 1.1],
            iconRotate: ['get', 'heading'],
            iconRotationAlignment: 'map',
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconPitchAlignment: 'map',
          }}
        />

        {/* Plate number label at high zoom */}
        <Mapbox.SymbolLayer
          id="vehicle-labels"
          minZoomLevel={14}
          style={{
            textField: ['get', 'plateNumber'],
            textSize: 10,
            textFont: ['DIN Pro Medium'],
            textOffset: [0, 2.2],
            textAnchor: 'top',
            textColor: '#FFAD3A',
            textHaloColor: '#1c1917',
            textHaloWidth: 2,
            textAllowOverlap: false,
          }}
        />

        {/* Route label at very high zoom */}
        <Mapbox.SymbolLayer
          id="vehicle-route-labels"
          minZoomLevel={15}
          style={{
            textField: ['get', 'routeLabel'],
            textSize: 9,
            textFont: ['DIN Pro Medium'],
            textOffset: [0, 3.4],
            textAnchor: 'top',
            textColor: '#a8a29e',
            textHaloColor: '#1c1917',
            textHaloWidth: 1.5,
            textAllowOverlap: false,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}
