import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  useColorScheme,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  Navigation,
  X,
  Flag,
  ChevronDown,
  Camera,
  DollarSign,
  Check,
  Clock,
  MapPin,
  TrainFront,
  Star,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import GorhomBottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Mapbox, { UserTrackingMode } from '@rnmapbox/maps'
import { StatusBar } from 'expo-status-bar'
import { c, font } from '@/lib/theme'
import { getGhanaTime } from '@/lib/utils/time'
import { TrainTimeline } from '@/components/TrainTimeline'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')
import { TRAIN_SCHEDULES, type ScheduleStop } from '@/lib/constants/train-schedule'
import { useTrip, type CompletedTripResult } from '@/lib/hooks/useTrip'
import { useLocation } from '@/lib/hooks/useLocation'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { useStations } from '@/lib/hooks/useStations'
import { getStationCoords } from '@/lib/utils/station-coords'
import { getLineStations } from '@/lib/constants/train-stations'
import { updateTripFare } from '@/lib/services/trips'
import { awardPointsForTrip } from '@/lib/services/rewards'
import { useApp } from '@/lib/contexts/AppContext'
import { buildTripStations, formatDistance, estimateETA, getDistanceKm, type TripStation } from '@/lib/services/trip'
import { TRIP_POINTS } from '@/lib/constants/rewards'
import type { RewardResult } from '@/lib/types'

// Find the best matching schedule for the current time of day
function getActiveSchedule(lineCode: string): { schedule: typeof TRAIN_SCHEDULES['TMA'][0]; stopMap: Map<string, ScheduleStop> } | null {
  const schedules = TRAIN_SCHEDULES[lineCode]
  if (!schedules || schedules.length === 0) return null

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  // Pick the schedule whose first departure is closest (but not long past)
  let best = schedules[0]
  let bestDiff = Infinity
  for (const s of schedules) {
    const firstDepart = s.stops[0]?.depart
    if (!firstDepart) continue
    const [h, m] = firstDepart.split(':').map(Number)
    const departMins = h * 60 + m
    // Prefer schedule that started within last 3 hours or is upcoming
    const diff = nowMins - departMins
    if (diff >= -30 && diff < 180 && Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff)
      best = s
    }
  }

  const stopMap = new Map<string, ScheduleStop>()
  for (const stop of best.stops) {
    stopMap.set(stop.station.toLowerCase(), stop)
  }

  return { schedule: best, stopMap }
}

export default function TripScreen() {
  const router = useRouter()
  const { routeId, type, lineId } = useLocalSearchParams<{
    routeId: string
    type?: string
    lineId?: string
  }>()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)

  const isTrain = type === 'train'
  const { route, isLoading: routeLoading } = useRouteDetail(isTrain ? '' : (routeId ?? ''))
  const { line, stations: trainStations } = useTrainLineDetail(isTrain ? (lineId ?? '') : '')
  const { stations: allStations } = useStations()
  const { location: userLocation, isPermissionGranted, requestPermission } = useLocation()
  const { tripState, progress, startTrip, endTrip } = useTrip()
  const { deviceId } = useDeviceId()
  const { refreshProfile, setLastReward } = useApp()

  // Schedule-aware times for train stations
  const activeSchedule = useMemo(() => {
    if (!isTrain || !line) return null
    return getActiveSchedule(line.code)
  }, [isTrain, line])

  const cameraRef = useRef<Mapbox.Camera>(null)
  const [isStarting, setIsStarting] = useState(false)
  const isEndingRef = useRef(false)
  const [stationPickerTarget, setStationPickerTarget] = useState<'origin' | 'dest' | null>(null)

  // Post-trip fare collection + rewards
  const [showFarePrompt, setShowFarePrompt] = useState(false)
  const [fareInput, setFareInput] = useState('')
  const [completedTrip, setCompletedTrip] = useState<CompletedTripResult | null>(null)
  const [tripReward, setTripReward] = useState<RewardResult | null>(null)

  // ── Train station selection (origin/destination picker) ──
  const [selectedOriginIdx, setSelectedOriginIdx] = useState(0)
  const [selectedDestIdx, setSelectedDestIdx] = useState(-1) // -1 = last station

  // All stations on the line (ordered), used for the picker
  const allLineStations = useMemo(() => {
    if (!isTrain || !line) return null
    const lineCode = line.code as 'TMA' | 'TMP'
    const hardcoded = getLineStations(lineCode)
    const dbSorted = (trainStations ?? []).slice().sort((a, b) => a.order_index - b.order_index)
    const dbNameSet = new Set(dbSorted.map(s => s.name.toLowerCase()))
    const merged: Array<{ id: string; name: string; latitude: number; longitude: number }> = []

    for (const s of dbSorted) {
      const coords = (s.latitude != null && s.longitude != null)
        ? { latitude: s.latitude, longitude: s.longitude }
        : getStationCoords({ name: s.name })
      if (coords) merged.push({ id: s.id, name: s.name, ...coords })
    }
    for (const hc of hardcoded) {
      if (!dbNameSet.has(hc.name.toLowerCase())) {
        merged.push({
          id: `hc-${hc.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: hc.name,
          latitude: hc.lat,
          longitude: hc.lng,
        })
      }
    }
    const orderMap = new Map(hardcoded.map((h, i) => [h.name.toLowerCase(), i]))
    merged.sort((a, b) => {
      const oa = orderMap.get(a.name.toLowerCase()) ?? 999
      const ob = orderMap.get(b.name.toLowerCase()) ?? 999
      return oa - ob
    })
    return merged.length >= 2 ? merged : null
  }, [isTrain, line, trainStations])

  // Initialize dest index when stations load
  useEffect(() => {
    if (allLineStations && selectedDestIdx === -1) {
      setSelectedDestIdx(allLineStations.length - 1)
    }
  }, [allLineStations, selectedDestIdx])

  // Resolve trip stations — sliced for train based on selection
  const tripStations = useMemo(() => {
    // ── Train mode: slice allLineStations to selected range ──
    if (isTrain && allLineStations) {
      const destIdx = selectedDestIdx === -1 ? allLineStations.length - 1 : selectedDestIdx
      const fromIdx = Math.min(selectedOriginIdx, destIdx)
      const toIdx = Math.max(selectedOriginIdx, destIdx)
      const sliced = allLineStations.slice(fromIdx, toIdx + 1)
      if (sliced.length < 2) return null
      return sliced.map((s, i) => ({
        ...s,
        isOrigin: i === 0,
        isDestination: i === sliced.length - 1,
      })) as TripStation[]
    }

    // ── Trotro mode: use fallback coords + DB stations ──
    if (!route) return null

    // Look up coords: try DB station first, then fallback coordinate map
    const fromStation = allStations.find(
      (s) => s.name.toLowerCase() === route.from_location.toLowerCase(),
    )
    const toStation = allStations.find(
      (s) => s.name.toLowerCase() === route.to_location.toLowerCase(),
    )

    const fromCoords = fromStation
      ? getStationCoords(fromStation)
      : getStationCoords({ name: route.from_location })
    const toCoords = toStation
      ? getStationCoords(toStation)
      : getStationCoords({ name: route.to_location })

    if (!fromCoords || !toCoords) return null

    // Build intermediate stations from all available sources
    const stationsWithCoords = allStations
      .map((st) => {
        const coords = getStationCoords(st)
        if (!coords) return null
        return { id: st.id, name: st.name, latitude: coords.latitude, longitude: coords.longitude }
      })
      .filter(Boolean) as Array<{ id: string; name: string; latitude: number; longitude: number }>

    return buildTripStations(
      { id: fromStation?.id ?? 'origin', name: route.from_location, ...fromCoords },
      { id: toStation?.id ?? 'dest', name: route.to_location, ...toCoords },
      stationsWithCoords,
    )
  }, [isTrain, trainStations, line, route, allStations])

  // Route label for display (includes selected stations for train)
  const routeLabel = useMemo(() => {
    if (isTrain && tripStations && tripStations.length >= 2) {
      const from = tripStations[0].name
      const to = tripStations[tripStations.length - 1].name
      return `${from} → ${to}`
    }
    if (isTrain) return line ? line.name : 'Train'
    return route ? `${route.from_location} → ${route.to_location}` : ''
  }, [isTrain, tripStations, line, route])

  // Build GeoJSON for the trip route line — split into traveled + remaining
  const routeLineGeojson = useMemo(() => {
    if (!tripStations || tripStations.length < 2) return null
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: tripStations.map((s) => [s.longitude, s.latitude]),
      },
      properties: {},
    }
  }, [tripStations])

  // Speed in km/h from GPS
  const speedKmh = useMemo(() => {
    if (!userLocation) return 0
    // expo-location provides speed in m/s (can be -1 if unavailable)
    const raw = (userLocation as any).speed
    if (raw == null || raw < 0) return 0
    return Math.round(raw * 3.6)
  }, [userLocation])

  // Build GeoJSON for station dots
  const stationDotsGeojson = useMemo(() => {
    if (!tripStations) return null
    return {
      type: 'FeatureCollection' as const,
      features: tripStations.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
        properties: {
          name: s.name,
          isOrigin: s.isOrigin ? 1 : 0,
          isDestination: s.isDestination ? 1 : 0,
        },
      })),
    }
  }, [tripStations])

  // Haptic feedback on trip milestones
  const hasHalfwayHaptic = useRef(false)
  const hasApproachHaptic = useRef(false)

  useEffect(() => {
    if (progress && progress.progressPercent >= 50 && !hasHalfwayHaptic.current) {
      hasHalfwayHaptic.current = true
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [progress?.progressPercent])

  useEffect(() => {
    if (tripState === 'approaching' && !hasApproachHaptic.current) {
      hasApproachHaptic.current = true
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    if (tripState === 'arrived') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [tripState])

  const handleStartTrip = useCallback(async () => {
    if (!tripStations || !routeLabel) return

    if (!isPermissionGranted) {
      const granted = await requestPermission()
      if (!granted) return
    }

    setIsStarting(true)
    hasHalfwayHaptic.current = false
    hasApproachHaptic.current = false
    await startTrip(routeId!, routeLabel, tripStations, {
      transportType: isTrain ? 'train' : 'trotro',
      trainLineId: isTrain ? (lineId ?? null) : null,
    })
    setIsStarting(false)
  }, [tripStations, routeLabel, isPermissionGranted, requestPermission, startTrip, routeId, isTrain, lineId])

  // End trip → save data → show fare prompt
  const handleEndTrip = useCallback(async () => {
    if (!deviceId || isEndingRef.current) return
    isEndingRef.current = true
    const result = await endTrip(deviceId)
    if (result) {
      setCompletedTrip(result)
      setShowFarePrompt(true)
    } else {
      router.back()
    }
    isEndingRef.current = false
  }, [endTrip, deviceId, router])

  // Submit fare from post-trip prompt — awards 8 pts (5 base + 3 fare bonus)
  const handleSubmitFare = useCallback(async () => {
    const fare = parseFloat(fareInput)
    if (completedTrip?.tripId && fare > 0) {
      await updateTripFare(completedTrip.tripId, fare)
    }
    // Award trip points with fare bonus
    if (completedTrip?.tripId && deviceId) {
      const reward = await awardPointsForTrip({
        deviceId,
        tripId: completedTrip.tripId,
        withFare: fare > 0,
      })
      if (reward) {
        setTripReward(reward)
        if (reward.level_up) setLastReward(reward)
      }
      refreshProfile()
    }
    setShowFarePrompt(false)
    setFareInput('')
    setCompletedTrip(null)
    router.back()
  }, [fareInput, completedTrip, deviceId, refreshProfile, setLastReward, router])

  // Skip fare prompt — close immediately, award 5 pts (base only) in background
  const handleSkipFare = useCallback(() => {
    const tripId = completedTrip?.tripId
    setShowFarePrompt(false)
    setFareInput('')
    setCompletedTrip(null)
    router.back()

    // Award points in background — don't block the UI
    if (tripId && deviceId) {
      awardPointsForTrip({ deviceId, tripId, withFare: false }).then((reward) => {
        if (reward?.level_up) setLastReward(reward)
        refreshProfile()
      })
    }
  }, [completedTrip, deviceId, refreshProfile, setLastReward, router])

  // Still fetching route data — show loading spinner
  const isStillLoading = (!route && !isTrain && routeLoading) || (!line && isTrain)

  if (isStillLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
          <ActivityIndicator size="large" color={c.amber500} />
          <Text style={s.loadingText}>Loading route...</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Route fetch finished but nothing found — bad routeId or stale trip
  if (!route && !line) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
          <Text style={s.loadingText}>Route not found</Text>
          <TouchableOpacity
            onPress={() => { if (deviceId) endTrip(deviceId); router.back() }}
            activeOpacity={0.7}
            style={{ backgroundColor: '#ef4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 14 }}>End Trip & Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Route found but coordinates couldn't be resolved (only blocks train — trotro doesn't need map)
  if (!tripStations && isTrain && line) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
          <Navigation size={40} color={c.amber500} />
          <Text style={[s.loadingText, { marginTop: 0, fontSize: 16 }]}>
            GO Mode isn't available for this route yet
          </Text>
          <Text style={[s.loadingText, { marginTop: 0, fontSize: 13 }]}>
            We're still mapping station coordinates for {routeLabel || 'this route'}.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ backgroundColor: c.amber500, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 14 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const dest = tripStations?.find((s) => s.isDestination)
  const origin = tripStations?.find((s) => s.isOrigin)
  const isActive = tripState === 'active' || tripState === 'approaching'
  const lineColor = isTrain ? (line?.color ?? '#0ea5e9') : '#f59e0b'

  // Auto night mode — dark map between 6 PM and 6 AM Ghana time
  const { hours: ghanaHour } = getGhanaTime()
  const isNightTime = isDark || ghanaHour >= 18 || ghanaHour < 6
  const mapStyleURL = isNightTime
    ? 'mapbox://styles/mapbox/navigation-night-v1'
    : 'mapbox://styles/mapbox/navigation-day-v1'

  // Bottom sheet snap points — compact when active, taller when idle
  const tripSheetRef = useRef<GorhomBottomSheet>(null)
  const activeSnapPoints = useMemo(() => ['18%', '45%', '80%'], [])
  const idleSnapPoints = useMemo(() => ['35%', '60%'], [])

  // Only follow user GPS if they're actually near the route (within ~50km)
  // Prevents camera jumping to another country when testing remotely
  const isNearRoute = useMemo(() => {
    if (!progress || !tripStations || tripStations.length === 0) return false
    const near = progress.distanceToDestinationKm < 50 || progress.distanceToNearestKm < 50
    console.log('[GO Mode]', { near, distDest: progress.distanceToDestinationKm, distNearest: progress.distanceToNearestKm })
    return near
  }, [progress, tripStations])
  const shouldFollowUser = isActive && isNearRoute

  // Schedule-aware simulated progress for remote testing
  // Pauses at each station for the scheduled dwell time, moves between stations
  const [simProgress, setSimProgress] = useState(0)
  const isNearRouteRef = useRef(isNearRoute)
  isNearRouteRef.current = isNearRoute
  const simDwellUntilRef = useRef(0) // timestamp when dwell ends

  useEffect(() => {
    if (!isActive) return
    const stationCount = tripStations?.length ?? 0
    if (stationCount < 2) return

    const segments = stationCount - 1
    // Each segment takes ~8 seconds (4 ticks × 2s), so a 2-stop trip ≈ 8s, 8-stop ≈ 56s
    const ticksPerSegment = 4
    const totalTicks = segments * ticksPerSegment

    // Build dwell time map from schedule
    const dwellMap = new Map<number, number>()
    if (activeSchedule && tripStations) {
      for (let i = 0; i < stationCount; i++) {
        const sched = activeSchedule.stopMap.get(tripStations[i].name.toLowerCase())
        if (sched?.arrive && sched?.depart) {
          const [aH, aM] = sched.arrive.split(':').map(Number)
          const [dH, dM] = sched.depart.split(':').map(Number)
          const dwellMins = (dH * 60 + dM) - (aH * 60 + aM)
          if (dwellMins > 0) dwellMap.set(i, Math.max(dwellMins * 2, 2))
        }
      }
    }

    let tick = 0
    const interval = setInterval(() => {
      if (isNearRouteRef.current) return
      const now = Date.now()
      if (simDwellUntilRef.current > now) return

      tick++
      const pct = Math.min(100, (tick / totalTicks) * 100)

      // Check if we just arrived at a station
      const stationIdx = Math.round((pct / 100) * segments)
      const stationPct = (stationIdx / segments) * 100
      if (Math.abs(pct - stationPct) < (100 / totalTicks) && dwellMap.has(stationIdx)) {
        const dwellSecs = dwellMap.get(stationIdx)!
        simDwellUntilRef.current = now + dwellSecs * 1000
        dwellMap.delete(stationIdx) // only dwell once per station
      }

      setSimProgress(pct)
      if (pct >= 100) clearInterval(interval)
    }, 2000)
    return () => clearInterval(interval)
  }, [isActive, activeSchedule, tripStations])

  // Reset sim progress when trip starts
  useEffect(() => {
    if (tripState === 'idle') {
      setSimProgress(0)
      simDwellUntilRef.current = 0
    }
  }, [tripState])

  // Auto-end trip on arrival — from real GPS or simulation reaching 100%
  const shouldAutoEnd = tripState === 'arrived' || (!isNearRoute && simProgress >= 100)

  useEffect(() => {
    if (shouldAutoEnd && isActive && deviceId && !showFarePrompt && !completedTrip && !isEndingRef.current) {
      isEndingRef.current = true
      ;(async () => {
        const result = await endTrip(deviceId)
        if (result) {
          setCompletedTrip(result)
          setShowFarePrompt(true)
        }
        isEndingRef.current = false
      })()
    }
  }, [shouldAutoEnd, isActive, deviceId, endTrip, showFarePrompt, completedTrip])

  // Effective progress: real GPS when near, simulated when far
  const effectiveProgress = isNearRoute
    ? (progress?.progressPercent ?? 0)
    : simProgress

  // Simulated station statuses for remote testing (derive from effectiveProgress)
  const effectiveStationStatuses = useMemo(() => {
    if (isNearRoute && progress?.stationStatuses && progress.stationStatuses.length > 0) {
      return progress.stationStatuses
    }
    if (!tripStations || tripStations.length < 2) return []

    const segments = tripStations.length - 1
    const pct = effectiveProgress / 100

    // Determine which station the user is approaching (floor = last passed, ceil = next)
    const exactPos = pct * segments // 0 = origin, segments = destination
    const currentIdx = Math.min(Math.ceil(exactPos), segments) // station we're heading toward
    const passedUpTo = Math.floor(exactPos) // stations fully behind us

    return tripStations.map((station, i) => {
      let status: 'passed' | 'current' | 'upcoming'
      if (effectiveProgress >= 100) {
        // Trip complete — all passed except destination is current
        status = i < tripStations.length - 1 ? 'passed' : 'current'
      } else if (i < passedUpTo) {
        status = 'passed'
      } else if (i === currentIdx) {
        status = 'current'
      } else if (i < currentIdx) {
        status = 'passed'
      } else {
        status = 'upcoming'
      }

      // Approximate distance to this station from current position
      const stationPct = i / segments
      const distPct = Math.abs(stationPct - pct)
      const origin = tripStations[0]
      const dest = tripStations[tripStations.length - 1]
      const totalDist = getDistanceKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
      const distanceKm = distPct * totalDist

      return {
        station: { id: station.id, name: station.name, latitude: station.latitude, longitude: station.longitude, isOrigin: station.isOrigin, isDestination: station.isDestination },
        status,
        distanceKm,
      }
    })
  }, [isNearRoute, progress?.stationStatuses, effectiveProgress, tripStations])

  // Effective nearest station for the hero card
  const effectiveNearestStation = useMemo(() => {
    if (isNearRoute) return progress?.nearestStation ?? null
    const current = effectiveStationStatuses.find(ss => ss.status === 'current')
    return current?.station ?? null
  }, [isNearRoute, progress?.nearestStation, effectiveStationStatuses])

  // Effective distance to destination (approximate from progress %)
  const effectiveDistToDest = useMemo(() => {
    if (isNearRoute) return progress?.distanceToDestinationKm ?? 0
    if (!tripStations || tripStations.length < 2) return 0
    const origin = tripStations[0]
    const dest = tripStations[tripStations.length - 1]
    const totalDist = getDistanceKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
    return totalDist * (1 - effectiveProgress / 100)
  }, [isNearRoute, progress?.distanceToDestinationKm, effectiveProgress, tripStations])

  // Traveled portion of route (solid, bright) based on progress
  const traveledLineGeojson = useMemo(() => {
    if (!tripStations || tripStations.length < 2) return null
    if (effectiveProgress <= 0) return null
    const pct = effectiveProgress / 100
    const allCoords = tripStations.map((s) => [s.longitude, s.latitude])
    const totalSegments = allCoords.length - 1
    const rawIdx = pct * totalSegments
    const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1)
    const segFraction = rawIdx - segIdx
    const coords = allCoords.slice(0, segIdx + 1)
    if (segIdx < totalSegments) {
      const from = allCoords[segIdx]
      const to = allCoords[segIdx + 1]
      coords.push([
        from[0] + (to[0] - from[0]) * segFraction,
        from[1] + (to[1] - from[1]) * segFraction,
      ])
    }
    if (coords.length < 2) return null
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    }
  }, [tripStations, effectiveProgress])

  // Vehicle marker GeoJSON — follows user location with heading rotation
  // When user is far from route (testing remotely), interpolate position along the route
  // based on simulated progress so the marker moves visibly
  const vehicleGeojson = useMemo(() => {
    if (!isActive || !tripStations || tripStations.length < 2) return null

    let lng: number
    let lat: number
    let heading = 0

    if (isNearRoute && userLocation) {
      // On the actual route — use real GPS position + heading
      lng = userLocation.longitude
      lat = userLocation.latitude
      heading = userLocation.heading ?? 0
    } else {
      // Remote testing — interpolate along the route using simulated progress
      const pct = effectiveProgress / 100
      const totalSegments = tripStations.length - 1
      const rawIdx = pct * totalSegments
      const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1)
      const segFraction = rawIdx - segIdx
      const from = tripStations[segIdx]
      const to = tripStations[Math.min(segIdx + 1, tripStations.length - 1)]
      lng = from.longitude + (to.longitude - from.longitude) * segFraction
      lat = from.latitude + (to.latitude - from.latitude) * segFraction
      // Point heading toward the next station
      heading = Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * (180 / Math.PI)
    }

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [lng, lat],
      },
      properties: {
        heading,
        icon: isTrain ? 'vehicle-train' : route?.transport_type === 'okada' ? 'vehicle-moto' : 'vehicle-trotro',
      },
    }
  }, [isActive, isNearRoute, userLocation?.latitude, userLocation?.longitude, userLocation?.heading, effectiveProgress, tripStations, isTrain, route?.transport_type])

  /* ── Shared fare modal (used by both trotro and train) ── */
  const renderFareModal = () => (
    <Modal
      visible={showFarePrompt}
      transparent
      animationType="slide"
      onRequestClose={handleSkipFare}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.fareModalOverlay}
      >
        <View style={s.fareModalCard}>
          <View style={s.fareModalHeader}>
            <Check size={28} color="#22c55e" />
            <Text style={s.fareModalTitle}>Trip Complete!</Text>
            <Text style={s.fareModalSub}>
              {completedTrip?.payload.from_location} → {completedTrip?.payload.to_location}
            </Text>
          </View>

          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Clock size={16} color={c.amber500} />
              <Text style={s.summaryValue}>
                {completedTrip?.payload.duration_mins ?? 0} min
              </Text>
              <Text style={s.summaryLabel}>Duration</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <MapPin size={16} color={c.amber500} />
              <Text style={s.summaryValue}>
                {completedTrip?.payload.distance_km
                  ? `${completedTrip.payload.distance_km} km`
                  : '—'}
              </Text>
              <Text style={s.summaryLabel}>Distance</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              {isTrain
                ? <TrainFront size={16} color={c.amber500} />
                : <Navigation size={16} color={c.amber500} />}
              <Text style={s.summaryValue}>
                {completedTrip?.payload.station_count ?? 0}
              </Text>
              <Text style={s.summaryLabel}>Stations</Text>
            </View>
          </View>

          {completedTrip?.tripId && (
            <View style={s.pointsBadge}>
              <Star size={14} color={c.amber500} />
              <Text style={s.pointsBadgeText}>
                +{TRIP_POINTS.completed} pts
              </Text>
              {!fareInput && (
                <Text style={s.pointsBonusHint}>
                   · Submit fare for +{TRIP_POINTS.fare_bonus} bonus
                </Text>
              )}
            </View>
          )}

          {!completedTrip?.tripId && (
            <View style={s.offlineBadge}>
              <Text style={s.offlineBadgeText}>
                Trip saved offline — points awarded when connected
              </Text>
            </View>
          )}

          <Text style={s.fareModalLabel}>How much did you pay?</Text>
          <View style={s.fareInputRow}>
            <Text style={s.fareCurrency}>GH₵</Text>
            <TextInput
              style={s.fareInput}
              value={fareInput}
              onChangeText={setFareInput}
              placeholder="0.00"
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmitFare}
            activeOpacity={0.8}
            style={s.fareSubmitBtn}
          >
            <Text style={s.fareSubmitText}>
              {fareInput ? `Submit Fare (+${TRIP_POINTS.completed + TRIP_POINTS.fare_bonus} pts)` : 'Skip'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkipFare} activeOpacity={0.7}>
            <Text style={s.fareSkipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )

  /* ══════════════════════════════════════════════════════════════
     TROTRO — GO Mode not available, redirect back
     ══════════════════════════════════════════════════════════════ */
  if (!isTrain) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
          <TrainFront size={40} color={c.amber500} />
          <Text style={[s.loadingText, { marginTop: 0, fontSize: 16 }]}>
            GO Mode is for trains only
          </Text>
          <Text style={[s.loadingText, { marginTop: 0, fontSize: 13 }]}>
            Track your journey in real-time on Ghana's railway lines.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ backgroundColor: c.amber500, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 14 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     TRAIN — Full navigation map with all features
     ══════════════════════════════════════════════════════════════ */
  return (
    <View style={s.container}>
      <StatusBar style={isNightTime ? 'light' : 'dark'} />

      {/* Full-screen map */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={mapStyleURL}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: Platform.OS === 'android' ? 80 : 60 }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: tripStations
              ? [tripStations[0].longitude, tripStations[0].latitude]
              : [-0.187, 5.6037],
            zoomLevel: 12,
          }}
          followUserLocation={shouldFollowUser}
          followUserMode={shouldFollowUser ? UserTrackingMode.FollowWithCourse : undefined}
          followZoomLevel={shouldFollowUser ? 16 : undefined}
          followPitch={shouldFollowUser ? 60 : undefined}
          centerCoordinate={
            !shouldFollowUser && tripStations
              ? [tripStations[0].longitude, tripStations[0].latitude]
              : !shouldFollowUser
                ? [-0.187, 5.6037]
                : undefined
          }
          zoomLevel={!shouldFollowUser ? 12 : undefined}
          animationDuration={1000}
        />

        {/* Show blue dot with heading arrow when idle */}
        <Mapbox.UserLocation
          visible={!isActive}
          showsUserHeadingIndicator
          androidRenderMode="compass"
        />

        {/* Vehicle marker — pulsing dot during active trip */}
        {vehicleGeojson && (
          <Mapbox.ShapeSource id="vehicle-marker" shape={vehicleGeojson as any}>
            {/* Outer glow */}
            <Mapbox.CircleLayer
              id="vehicle-glow"
              style={{
                circleRadius: 18,
                circleColor: lineColor,
                circleOpacity: 0.15,
              }}
            />
            {/* White border ring */}
            <Mapbox.CircleLayer
              id="vehicle-ring"
              style={{
                circleRadius: 10,
                circleColor: lineColor,
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 3,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Route corridor — remaining portion (thick, dimmed) */}
        {routeLineGeojson && (
          <Mapbox.ShapeSource id="trip-route-line" shape={routeLineGeojson as any}>
            <Mapbox.LineLayer
              id="trip-route-line-bg"
              style={{
                lineColor: lineColor,
                lineWidth: 12,
                lineOpacity: 0.12,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Mapbox.LineLayer
              id="trip-route-line-fg"
              style={{
                lineColor: lineColor,
                lineWidth: 6,
                lineOpacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Route corridor — traveled portion (thick, bright, solid) */}
        {traveledLineGeojson && (
          <Mapbox.ShapeSource id="trip-traveled-line" shape={traveledLineGeojson as any}>
            <Mapbox.LineLayer
              id="trip-traveled-line-bg"
              style={{
                lineColor: lineColor,
                lineWidth: 14,
                lineOpacity: 0.25,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Mapbox.LineLayer
              id="trip-traveled-line-fg"
              style={{
                lineColor: lineColor,
                lineWidth: 7,
                lineOpacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Station dots */}
        {stationDotsGeojson && (
          <Mapbox.ShapeSource id="trip-stations" shape={stationDotsGeojson as any}>
            <Mapbox.CircleLayer
              id="trip-station-dots"
              style={{
                circleRadius: [
                  'case',
                  ['==', ['get', 'isOrigin'], 1], 10,
                  ['==', ['get', 'isDestination'], 1], 10,
                  7,
                ],
                circleColor: [
                  'case',
                  ['==', ['get', 'isOrigin'], 1], '#22c55e',
                  ['==', ['get', 'isDestination'], 1], '#ef4444',
                  lineColor,
                ],
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 3,
              }}
            />
            <Mapbox.SymbolLayer
              id="trip-station-names"
              style={{
                textField: ['get', 'name'],
                textSize: 11,
                textColor: isDark ? '#e5e7eb' : '#1f2937',
                textHaloColor: isDark ? '#111827' : '#ffffff',
                textHaloWidth: 1.5,
                textOffset: [0, 1.5],
                textAllowOverlap: false,
                textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Speed indicator — Waze style */}
      {isActive && (
        <View style={s.speedBadge}>
          <Text style={s.speedValue}>{speedKmh}</Text>
          <Text style={s.speedUnit}>km/h</Text>
        </View>
      )}

      {/* Status bar tint — prevents map bleeding into system bar */}
      <LinearGradient
        colors={[isNightTime ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)', 'transparent']}
        style={s.statusBarTint}
        pointerEvents="none"
      />

      {/* Glass header */}
      <SafeAreaView edges={['top']} style={s.topBar}>
        <TouchableOpacity
          onPress={() => (isActive ? handleEndTrip() : router.back())}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <X size={20} color={isDark ? '#e5e5e5' : '#312e2d'} />
        </TouchableOpacity>
        <View style={s.topLabel}>
          <Text style={s.topLabelText} numberOfLines={1}>
            {isActive ? `TRIP #${(routeId ?? '').substring(0, 6).toUpperCase()}` : routeLabel}
          </Text>
        </View>
      </SafeAreaView>

      {/* ── Draggable bottom sheet ── */}
      <GorhomBottomSheet
        ref={tripSheetRef}
        index={0}
        snapPoints={isActive ? activeSnapPoints : idleSnapPoints}
        enablePanDownToClose={false}
        backgroundStyle={s.sheetBackground}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.sheetContent}
        >
          {/* Approaching alert */}
          {tripState === 'approaching' && (
            <View style={s.approachBanner}>
              <Flag size={18} color="#815100" />
              <Text style={s.approachText}>
                Approaching destination — {formatDistance(effectiveDistToDest)}
              </Text>
            </View>
          )}

          {/* ── Next Station hero card ── */}
          {isActive && effectiveNearestStation && (() => {
            const nextStatus = effectiveStationStatuses.find((ss) => ss.status === 'current')
            const nextName = nextStatus?.station.name ?? effectiveNearestStation.name
            const scheduleTime = activeSchedule?.stopMap.get(nextName.toLowerCase())
            const arriveTime = scheduleTime?.arrive ?? scheduleTime?.depart
            return (
              <View style={[s.nextStationHero, { borderLeftColor: lineColor }]}>
                <Text style={s.nextStationLabel}>NEXT STATION</Text>
                <Text style={s.nextStationName}>{nextName}</Text>
                <View style={s.nextStationMeta}>
                  {arriveTime && (
                    <View style={s.nextStationTimeBadge}>
                      <Clock size={12} color={lineColor} />
                      <Text style={[s.nextStationTimeText, { color: lineColor }]}>{arriveTime}</Text>
                    </View>
                  )}
                  <Text style={s.nextStationDist}>
                    {formatDistance(nextStatus?.distanceKm ?? effectiveDistToDest)}
                  </Text>
                </View>
              </View>
            )
          })()}

          {/* Progress header when active */}
          {isActive && (effectiveProgress > 0 || progress) && (
            <>
              <View style={s.progressHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.destName}>{dest?.name}</Text>
                  <Text style={s.lineInfo}>
                    {line?.name ?? routeLabel} • ETA {
                      (() => {
                        const destTime = activeSchedule?.stopMap.get((dest?.name ?? '').toLowerCase())
                        return destTime?.arrive ?? estimateETA(effectiveDistToDest, 'train')
                      })()
                    }
                  </Text>
                </View>
                <View style={s.progressBadge}>
                  <Text style={s.progressBadgeText}>{Math.round(effectiveProgress)}%</Text>
                </View>
              </View>

              {/* Gradient progress bar — use line color */}
              <View style={s.progressBarBg}>
                <LinearGradient
                  colors={[lineColor, lineColor + 'aa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.progressBarFill, { width: `${Math.min(100, effectiveProgress)}%` }]}
                />
              </View>

              {/* Stats row */}
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{formatDistance(effectiveDistToDest)}</Text>
                  <Text style={s.statLabel}>remaining</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={s.statValue}>
                    {effectiveStationStatuses.filter((ss) => ss.status === 'passed').length}/{effectiveStationStatuses.length}
                  </Text>
                  <Text style={s.statLabel}>stations</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{speedKmh}</Text>
                  <Text style={s.statLabel}>km/h</Text>
                </View>
              </View>
            </>
          )}

          {/* Station timeline — MTA-style dot timeline */}
          {isActive && effectiveStationStatuses.length > 0 && (
            <TrainTimeline
              stationStatuses={effectiveStationStatuses}
              lineColor={lineColor}
              scheduleStopMap={activeSchedule?.stopMap}
              formatDistance={formatDistance}
            />
          )}

          {/* Quick actions during trip */}
          {isActive && (
            <View style={s.tripActions}>
              <TouchableOpacity
                onPress={() => router.push('/report/photo')}
                activeOpacity={0.7}
                style={s.tripActionBtn}
              >
                <Camera size={18} color="#815100" />
                <Text style={s.tripActionText}>Post Tale</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/report/fare')}
                activeOpacity={0.7}
                style={s.tripActionBtn}
              >
                <DollarSign size={18} color="#815100" />
                <Text style={s.tripActionText}>Report Fare</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Finish trip — editorial gradient */}
          {isActive && (
            <TouchableOpacity onPress={handleEndTrip} activeOpacity={0.8}>
              <LinearGradient
                colors={['#815100', '#f8a010']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.finishBtn}
              >
                <Flag size={18} color="#fff" />
                <Text style={s.finishBtnText}>Finish Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Idle — route preview + start */}
          {tripState === 'idle' && !showFarePrompt && (
            <>
              {tripStations && (
                <View style={s.idleStops}>
                  {/* Origin — tappable for train */}
                  <TouchableOpacity
                    activeOpacity={isTrain && allLineStations ? 0.6 : 1}
                    onPress={() => isTrain && allLineStations && setStationPickerTarget('origin')}
                    style={s.stationRow}
                  >
                    <View style={s.stationTimeline}>
                      <View style={[s.dotIdle, { backgroundColor: '#22c55e' }]} />
                      <View style={s.trackLine} />
                    </View>
                    <View style={[s.stationInfo, { flex: 1 }]}>
                      <Text style={s.stationNameBold}>{origin?.name}</Text>
                      <Text style={s.stationSub}>Origin{isTrain && allLineStations ? ' · Tap to change' : ''}</Text>
                    </View>
                    {isTrain && allLineStations && <ChevronDown size={16} color="#b2acaa" />}
                  </TouchableOpacity>

                  {tripStations.length > 2 && (
                    <View style={s.stationRow}>
                      <View style={s.stationTimeline}>
                        <View style={s.trackLine} />
                        <ChevronDown size={14} color="#b2acaa" />
                        <View style={s.trackLine} />
                      </View>
                      <View style={s.stationInfo}>
                        <Text style={s.stationSub}>
                          {tripStations.length - 2} stop{tripStations.length - 2 !== 1 ? 's' : ''} along the way
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Destination — tappable for train */}
                  <TouchableOpacity
                    activeOpacity={isTrain && allLineStations ? 0.6 : 1}
                    onPress={() => isTrain && allLineStations && setStationPickerTarget('dest')}
                    style={s.stationRow}
                  >
                    <View style={s.stationTimeline}>
                      <View style={s.trackLine} />
                      <View style={[s.dotIdle, { backgroundColor: '#ef4444' }]} />
                    </View>
                    <View style={[s.stationInfo, { flex: 1 }]}>
                      <Text style={s.stationNameBold}>{dest?.name}</Text>
                      <Text style={s.stationSub}>Destination{isTrain && allLineStations ? ' · Tap to change' : ''}</Text>
                    </View>
                    {isTrain && allLineStations && <ChevronDown size={16} color="#b2acaa" />}
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={handleStartTrip}
                disabled={!tripStations || isStarting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={(!tripStations || isStarting) ? ['#9ca3af', '#d1d5db'] : ['#815100', '#f8a010']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.goBtn}
                >
                  <Navigation size={22} color="#fff" />
                  <Text style={s.goBtnText}>
                    {isStarting ? 'Starting...' : 'Start GO Mode'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetScrollView>
      </GorhomBottomSheet>

      {renderFareModal()}

      {/* ── Station picker modal (train only) ── */}
      <Modal
        visible={stationPickerTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setStationPickerTarget(null)}
      >
        <TouchableOpacity
          style={s.pickerOverlay}
          activeOpacity={1}
          onPress={() => setStationPickerTarget(null)}
        >
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>
              Select {stationPickerTarget === 'origin' ? 'Origin' : 'Destination'}
            </Text>
            <ScrollView style={s.pickerList} bounces={false}>
              {allLineStations?.map((station, idx) => {
                const isSelected = stationPickerTarget === 'origin'
                  ? idx === selectedOriginIdx
                  : idx === (selectedDestIdx === -1 ? (allLineStations.length - 1) : selectedDestIdx)
                const isDisabled = stationPickerTarget === 'origin'
                  ? idx >= (selectedDestIdx === -1 ? allLineStations.length - 1 : selectedDestIdx)
                  : idx <= selectedOriginIdx

                return (
                  <TouchableOpacity
                    key={station.id}
                    activeOpacity={isDisabled ? 0.3 : 0.7}
                    onPress={() => {
                      if (isDisabled) return
                      if (stationPickerTarget === 'origin') {
                        setSelectedOriginIdx(idx)
                      } else {
                        setSelectedDestIdx(idx)
                      }
                      setStationPickerTarget(null)
                    }}
                    style={[
                      s.pickerItem,
                      isSelected && { backgroundColor: (lineColor + '15') },
                    ]}
                  >
                    <View style={[
                      s.pickerDot,
                      { backgroundColor: isDisabled ? '#d1d5db' : isSelected ? lineColor : '#b2acaa' },
                    ]} />
                    <Text style={[
                      s.pickerItemText,
                      isSelected && { color: lineColor, fontFamily: font.bold },
                      isDisabled && { color: '#d1d5db' },
                    ]}>
                      {station.name}
                    </Text>
                    {isSelected && <Check size={18} color={lineColor} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  // Stitch M3 tokens
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : '#b2acaa'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    loadingText: { color: onSurfaceVariant, textAlign: 'center', marginTop: 100 },

    // Glass header
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    topLabel: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)',
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    topLabelText: {
      color: onSurface,
      fontSize: 13,
      fontFamily: font.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // Bottom sheet — draggable
    sheetBackground: {
      backgroundColor: surfaceLowest,
      borderRadius: 28,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: isDark ? 0 : 0.12,
      shadowRadius: 40,
      elevation: isDark ? 0 : 10,
    },
    sheetHandle: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#d6d3d1',
      width: 40,
    },
    sheetContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 18,
    },

    // Approaching
    approachBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(129,81,0,0.15)' : 'rgba(129,81,0,0.08)',
      padding: 14,
      borderRadius: 16,
    },
    approachText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: '#815100',
      flex: 1,
    },

    // Next Station hero
    nextStationHero: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f6f5',
      borderRadius: 16,
      borderLeftWidth: 4,
      padding: 16,
      gap: 4,
    },
    nextStationLabel: {
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 2,
      color: onSurfaceVariant,
      textTransform: 'uppercase' as const,
    },
    nextStationName: {
      fontSize: 22,
      fontFamily: font.bold,
      color: onSurface,
    },
    nextStationMeta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginTop: 4,
    },
    nextStationTimeBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    nextStationTimeText: {
      fontSize: 14,
      fontFamily: font.bold,
    },
    nextStationDist: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },

    // Progress header
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    destName: {
      fontSize: 22,
      fontFamily: font.bold,
      color: onSurface,
    },
    lineInfo: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    progressBadge: {
      backgroundColor: isDark ? 'rgba(129,81,0,0.2)' : 'rgba(129,81,0,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    progressBadgeText: {
      fontSize: 18,
      fontFamily: font.extrabold,
      color: '#815100',
    },

    // Gradient progress bar
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de',
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },

    // Stats row
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 14,
      fontFamily: font.bold,
      color: onSurface,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 2,
    },

    // Station timeline
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
    },
    stationTimeline: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackLine: {
      width: 2.5,
      height: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e8e1de',
      borderRadius: 1,
    },
    trackLinePassed: {
      backgroundColor: '#815100',
    },
    dotPassed: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotActive: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(248,160,16,0.2)' : 'rgba(129,81,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: '#f8a010',
    },
    dotActiveInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#f8a010',
    },
    dotUpcoming: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de',
      borderWidth: 2,
      borderColor: outlineVariant,
    },
    dotIdle: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 3,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
    },
    stationInfo: {
      flex: 1,
      paddingLeft: 12,
      paddingVertical: 4,
    },
    stationInfoHighlight: {
      backgroundColor: isDark ? 'rgba(248,160,16,0.1)' : 'rgba(129,81,0,0.06)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginLeft: 8,
    },
    nextLabel: {
      fontSize: 9,
      fontFamily: font.bold,
      color: '#f8a010',
      letterSpacing: 2,
      marginBottom: 2,
    },
    stationNameRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    stationName: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      flex: 1,
    },
    scheduleTime: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
      marginLeft: 8,
    },
    scheduleTimePassed: {
      color: '#815100',
      textDecorationLine: 'line-through' as const,
    },
    stationNamePassed: {
      color: '#815100',
      fontFamily: font.medium,
    },
    stationNameActive: {
      color: onSurface,
      fontFamily: font.bold,
      fontSize: 15,
    },
    stationNameBold: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: onSurface,
    },
    stationSub: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 1,
    },
    stationDist: {
      fontSize: 11,
      fontFamily: font.medium,
      color: '#f8a010',
      marginTop: 2,
    },

    // Idle stops
    idleStops: {
      gap: 0,
      paddingVertical: 4,
    },

    // Buttons — editorial gradient
    goBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 20,
    },
    goBtnText: {
      color: '#fff',
      fontSize: 18,
      fontFamily: font.bold,
    },
    finishBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 20,
    },
    finishBtnText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: font.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // Trip quick actions
    tripActions: {
      flexDirection: 'row',
      gap: 10,
    },
    tripActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: surfaceLow,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    tripActionText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: '#815100',
    },

    // Trip summary stats (post-trip modal)
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: surfaceLow,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    summaryItem: {
      alignItems: 'center',
      gap: 4,
      flex: 1,
    },
    summaryValue: {
      fontSize: 15,
      fontFamily: font.bold,
      color: onSurface,
    },
    summaryLabel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    summaryDivider: {
      width: 1,
      height: 32,
      backgroundColor: outlineVariant,
    },

    // Points badge
    pointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(129,81,0,0.15)' : 'rgba(129,81,0,0.08)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    pointsBadgeText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
    },
    pointsBonusHint: {
      fontSize: 12,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },

    // Offline badge
    offlineBadge: {
      backgroundColor: isDark ? 'rgba(156,163,175,0.12)' : 'rgba(156,163,175,0.08)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    offlineBadgeText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      textAlign: 'center',
    },

    // Post-trip fare modal
    fareModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    fareModalCard: {
      backgroundColor: surfaceLowest,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      padding: 28,
      paddingBottom: 40,
      gap: 20,
    },
    fareModalHeader: {
      alignItems: 'center',
      gap: 8,
    },
    fareModalTitle: {
      fontSize: 22,
      fontFamily: font.bold,
      color: onSurface,
    },
    fareModalSub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      textAlign: 'center',
    },
    fareModalLabel: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurface,
    },
    fareInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: surfaceLow,
      borderRadius: 18,
      paddingHorizontal: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    fareCurrency: {
      fontSize: 18,
      fontFamily: font.bold,
      color: onSurfaceVariant,
    },
    fareInput: {
      flex: 1,
      fontSize: 24,
      fontFamily: font.bold,
      color: onSurface,
      paddingVertical: 16,
    },
    fareSubmitBtn: {
      backgroundColor: '#815100',
      paddingVertical: 18,
      borderRadius: 20,
      alignItems: 'center',
    },
    fareSubmitText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: font.bold,
    },
    fareSkipText: {
      color: onSurfaceVariant,
      fontSize: 13,
      fontFamily: font.regular,
      textAlign: 'center',
    },

    // Status bar tint gradient
    statusBarTint: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      zIndex: 5,
    },

    // Speed indicator
    speedBadge: {
      position: 'absolute',
      bottom: '35%',
      left: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: { elevation: 6 },
      }),
    },
    speedValue: {
      fontSize: 20,
      fontFamily: font.extrabold,
      color: onSurface,
      lineHeight: 22,
    },
    speedUnit: {
      fontSize: 9,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
      marginTop: -2,
    },

    // Station picker modal
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: surfaceLowest,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '60%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    pickerHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: outlineVariant,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 8,
    },
    pickerTitle: {
      fontSize: 16,
      fontFamily: font.bold,
      color: onSurface,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    pickerList: {
      paddingHorizontal: 12,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    pickerDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    pickerItemText: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.medium,
      color: onSurface,
    },

  })
}
