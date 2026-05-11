import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface VehiclePosition {
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  plateNumber: string
  routeLabel: string | null
  timestamp: number
}

/**
 * Subscribe to a specific vehicle's GPS broadcast channel.
 * Real-time 10-second updates via Supabase Realtime.
 * Used for live tracking after booking confirmed.
 */
export function useRealtimeVehicle(vanId: string | null) {
  const [position, setPosition] = useState<VehiclePosition | null>(null)
  const [connected, setConnected] = useState(false)
  const [etaMins, setEtaMins] = useState<number | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!vanId) return

    const channelName = `gps:van:${vanId}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'location' }, (payload: any) => {
        const p = payload.payload
        setPosition({
          lat: p.lat,
          lng: p.lng,
          heading: p.heading,
          speed: p.speed,
          plateNumber: p.plate_number,
          routeLabel: p.route_label,
          timestamp: p.timestamp,
        })
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'CHANNEL_ERROR') {
          setTimeout(() => channel.subscribe(), 3000)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setConnected(false)
    }
  }, [vanId])

  // Calculate ETA from position to a target
  const calculateETA = (targetLat: number, targetLng: number) => {
    if (!position) return
    const km = haversineKm(position.lat, position.lng, targetLat, targetLng)
    const speedKmh = position.speed && position.speed > 0 ? position.speed * 3.6 : 20 // fallback 20km/h
    const mins = Math.max(1, Math.round((km / speedKmh) * 60))
    setEtaMins(mins)
  }

  return { position, connected, etaMins, calculateETA }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
