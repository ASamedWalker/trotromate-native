export type TransportStopType = 'trotro_stop' | 'bus_stop' | 'lorry_park' | 'taxi_rank'

export interface TransportStop {
  osm_id: number
  name: string | null
  lat: number
  lng: number
  type: TransportStopType
}

export interface TransportRoute {
  osm_id: number
  name: string | null
  ref: string | null
  from: string | null
  to: string | null
  type: 'bus' | 'share_taxi' | 'minibus'
  coordinates: [number, number][] // [lng, lat] pairs
}
