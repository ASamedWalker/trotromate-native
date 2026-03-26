import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
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
  ChevronUp,
  Camera,
  DollarSign,
  Check,
  Clock,
  MapPin,
  TrainFront,
  Star,
  CircleCheck,
} from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import { c, themed, font } from '@/lib/theme'
import { TrotroTopDown, TrainTopDown, MotoTopDown } from '@/components/VehicleIcons'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')
import { useTrip, type CompletedTripResult } from '@/lib/hooks/useTrip'
import { useLocation } from '@/lib/hooks/useLocation'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { useStations } from '@/lib/hooks/useStations'
import { getStationCoords } from '@/lib/utils/station-coords'
import { updateTripFare } from '@/lib/services/trips'
import { awardPointsForTrip } from '@/lib/services/rewards'
import { useApp } from '@/lib/contexts/AppContext'
import { buildTripStations, formatDistance, estimateETA, type TripStation } from '@/lib/services/trip'
import { TRIP_POINTS } from '@/lib/constants/rewards'
import type { RewardResult } from '@/lib/types'

export default function TripScreen() {
  const router = useRouter()
  const { routeId, type, lineId } = useLocalSearchParams<{
    routeId: string
    type?: string
    lineId?: string
  }>()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const isTrain = type === 'train'
  const { route, isLoading: routeLoading } = useRouteDetail(isTrain ? '' : (routeId ?? ''))
  const { line, stations: trainStations } = useTrainLineDetail(isTrain ? (lineId ?? '') : '')
  const { stations: allStations } = useStations()
  const { location: userLocation, isPermissionGranted, requestPermission } = useLocation()
  const { tripState, progress, startTrip, endTrip } = useTrip()
  const { deviceId } = useDeviceId()
  const { refreshProfile, setLastReward } = useApp()

  const cameraRef = useRef<Mapbox.Camera>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [showStations, setShowStations] = useState(false)
  const isEndingRef = useRef(false)

  // Post-trip fare collection + rewards
  const [showFarePrompt, setShowFarePrompt] = useState(false)
  const [fareInput, setFareInput] = useState('')
  const [completedTrip, setCompletedTrip] = useState<CompletedTripResult | null>(null)
  const [tripReward, setTripReward] = useState<RewardResult | null>(null)

  // Route label for display
  const routeLabel = isTrain
    ? (line ? `${line.name}` : 'Train')
    : (route ? `${route.from_location} → ${route.to_location}` : '')

  // Resolve trip stations — different logic for train vs trotro
  const tripStations = useMemo(() => {
    // ── Train mode: stations ordered, use DB coords or fallback ──
    if (isTrain && trainStations && trainStations.length >= 2) {
      const resolved = trainStations
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => {
          // Prefer DB coords, fall back to client-side lookup
          const coords = (s.latitude != null && s.longitude != null)
            ? { latitude: s.latitude, longitude: s.longitude }
            : getStationCoords({ name: s.name })
          if (!coords) return null
          return { id: s.id, name: s.name, ...coords }
        })
        .filter(Boolean) as Array<{ id: string; name: string; latitude: number; longitude: number }>

      if (resolved.length < 2) return null

      return resolved.map((s, i) => ({
        ...s,
        isOrigin: i === 0,
        isDestination: i === resolved.length - 1,
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
  }, [isTrain, trainStations, route, allStations])

  // Build GeoJSON for the trip route line
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

  // Auto-end trip on arrival — save data and show fare prompt
  useEffect(() => {
    if (tripState === 'arrived' && deviceId && !showFarePrompt && !completedTrip && !isEndingRef.current) {
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
  }, [tripState, deviceId, endTrip, showFarePrompt, completedTrip])

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

  // Route found but coordinates couldn't be resolved
  if (!tripStations && (route || line)) {
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

  // Only follow user GPS if they're actually near the route (within ~50km)
  // Prevents camera jumping to another country when testing remotely
  const isNearRoute = useMemo(() => {
    if (!progress || !tripStations || tripStations.length === 0) return false
    return progress.distanceToDestinationKm < 50 || progress.distanceToNearestKm < 50
  }, [progress, tripStations])
  const shouldFollowUser = isActive && isNearRoute

  // Vehicle marker GeoJSON — follows user location with heading rotation
  // When user is far from route (testing remotely), interpolate position along the route
  // based on trip progress so the marker is visible on the Ghana-centered map
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
      // Remote testing — interpolate along the route corridor based on progress %
      const pct = (progress?.progressPercent ?? 0) / 100
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
  }, [isActive, isNearRoute, userLocation?.latitude, userLocation?.longitude, userLocation?.heading, progress?.progressPercent, tripStations, isTrain, route?.transport_type])

  return (
    <View style={s.container}>
      {/* Full-screen map */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={true}
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
          followZoomLevel={shouldFollowUser ? 15 : undefined}
          followPitch={shouldFollowUser ? 45 : undefined}
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

        {/* Vehicle icons for GO Mode marker */}
        <Mapbox.Images>
          <Mapbox.Image name="vehicle-trotro">
            <TrotroTopDown size={44} />
          </Mapbox.Image>
          <Mapbox.Image name="vehicle-train">
            <TrainTopDown size={44} />
          </Mapbox.Image>
          <Mapbox.Image name="vehicle-moto">
            <MotoTopDown size={44} />
          </Mapbox.Image>
        </Mapbox.Images>

        {/* Show blue dot when idle, vehicle icon when trip is active */}
        <Mapbox.UserLocation visible={!isActive} />

        {/* Vehicle marker — replaces blue dot during active trip */}
        {vehicleGeojson && (
          <Mapbox.ShapeSource id="vehicle-marker" shape={vehicleGeojson as any}>
            <Mapbox.SymbolLayer
              id="vehicle-icon"
              style={{
                iconImage: ['get', 'icon'],
                iconSize: 1,
                iconRotate: ['get', 'heading'],
                iconRotationAlignment: 'map',
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Route corridor line */}
        {routeLineGeojson && (
          <Mapbox.ShapeSource id="trip-route-line" shape={routeLineGeojson as any}>
            <Mapbox.LineLayer
              id="trip-route-line-bg"
              style={{
                lineColor: lineColor,
                lineWidth: 6,
                lineOpacity: 0.3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Mapbox.LineLayer
              id="trip-route-line-fg"
              style={{
                lineColor: lineColor,
                lineWidth: 3,
                lineOpacity: 0.9,
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
                  ['==', ['get', 'isOrigin'], 1], 8,
                  ['==', ['get', 'isDestination'], 1], 8,
                  5,
                ],
                circleColor: [
                  'case',
                  ['==', ['get', 'isOrigin'], 1], '#22c55e',
                  ['==', ['get', 'isDestination'], 1], '#ef4444',
                  '#f59e0b',
                ],
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 2.5,
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

      {/* Top bar */}
      <SafeAreaView edges={['top']} style={s.topBar}>
        <TouchableOpacity
          onPress={() => (isActive ? handleEndTrip() : router.back())}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.topLabel}>
          <Text style={s.topLabelText} numberOfLines={1}>
            {routeLabel}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom card */}
      <SafeAreaView edges={['bottom']} style={s.bottomCard}>
        {/* Approaching alert */}
        {tripState === 'approaching' && (
          <View style={s.approachBanner}>
            <Flag size={18} color={c.amber500} />
            <Text style={s.approachText}>
              Approaching destination — {formatDistance(progress?.distanceToDestinationKm ?? 0)}
            </Text>
          </View>
        )}

        {/* Progress info when active */}
        {isActive && progress && (
          <View style={s.progressSection}>
            <View style={s.progressBarBg}>
              <View
                style={[
                  s.progressBarFill,
                  { width: `${Math.min(100, progress.progressPercent)}%` },
                ]}
              />
            </View>

            <View style={s.progressRow}>
              <View style={s.progressItem}>
                <Text style={s.progressValue}>
                  {formatDistance(progress.distanceToDestinationKm)}
                </Text>
                <Text style={s.progressLabel}>to destination</Text>
              </View>
              {progress.nearestStation && (
                <View style={s.progressItem}>
                  <Text style={s.progressValue}>{progress.nearestStation.name}</Text>
                  <Text style={s.progressLabel}>
                    nearest — {formatDistance(progress.distanceToNearestKm)}
                  </Text>
                </View>
              )}
              <View style={s.progressItem}>
                <Text style={s.progressValue}>
                  {estimateETA(progress.distanceToDestinationKm, isTrain ? 'train' : 'trotro')}
                </Text>
                <Text style={s.progressLabel}>ETA</Text>
              </View>
            </View>
          </View>
        )}

        {/* Station-by-station progress */}
        {isActive && progress && progress.stationStatuses.length > 0 && (
          <View>
            <TouchableOpacity
              onPress={() => setShowStations((v) => !v)}
              activeOpacity={0.7}
              style={s.stationToggle}
            >
              <Text style={s.stationToggleText}>
                {progress.stationStatuses.filter((ss) => ss.status === 'passed').length}/{progress.stationStatuses.length} stations
              </Text>
              {showStations
                ? <ChevronUp size={16} color={t.textSecondary} />
                : <ChevronDown size={16} color={t.textSecondary} />}
            </TouchableOpacity>

            {showStations && (
              <View style={s.stationList}>
                {progress.stationStatuses.map((ss, i) => (
                  <View key={ss.station.id} style={s.stationRow}>
                    {/* Timeline connector */}
                    <View style={s.stationTimeline}>
                      {i > 0 && (
                        <View style={[
                          s.stationLine,
                          { backgroundColor: ss.status === 'upcoming' ? (isDark ? c.stone700 : c.stone300) : '#22c55e' },
                        ]} />
                      )}
                      {ss.status === 'passed' ? (
                        <CircleCheck size={18} color="#22c55e" />
                      ) : ss.status === 'current' ? (
                        <View style={s.stationDotCurrent} />
                      ) : (
                        <View style={s.stationDotUpcoming} />
                      )}
                      {i < progress.stationStatuses.length - 1 && (
                        <View style={[
                          s.stationLine,
                          { backgroundColor: ss.status !== 'upcoming' && progress.stationStatuses[i + 1]?.status !== 'upcoming' ? '#22c55e' : (isDark ? c.stone700 : c.stone300) },
                        ]} />
                      )}
                    </View>
                    {/* Station name + distance */}
                    <View style={s.stationInfo}>
                      <Text style={[
                        s.stationName,
                        ss.status === 'passed' && s.stationNamePassed,
                        ss.status === 'current' && s.stationNameCurrent,
                      ]} numberOfLines={1}>
                        {ss.station.name}
                      </Text>
                      {ss.status === 'current' && (
                        <Text style={s.stationDistance}>{formatDistance(ss.distanceKm)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Start button */}
        {tripState === 'idle' && !showFarePrompt && (
          <TouchableOpacity
            onPress={handleStartTrip}
            disabled={!tripStations || isStarting}
            activeOpacity={0.8}
            style={[s.goBtn, (!tripStations || isStarting) && s.goBtnDisabled]}
          >
            <Navigation size={22} color="#fff" />
            <Text style={s.goBtnText}>
              {isStarting ? 'Starting...' : 'Start GO Mode'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Quick actions during trip */}
        {isActive && (
          <View style={s.tripActions}>
            <TouchableOpacity
              onPress={() => router.push('/report/photo')}
              activeOpacity={0.7}
              style={s.tripActionBtn}
            >
              <Camera size={18} color={c.amber500} />
              <Text style={s.tripActionText}>Post Tale</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/report/fare')}
              activeOpacity={0.7}
              style={s.tripActionBtn}
            >
              <DollarSign size={18} color={c.amber500} />
              <Text style={s.tripActionText}>Report Fare</Text>
            </TouchableOpacity>
          </View>
        )}

        {isActive && (
          <TouchableOpacity
            onPress={handleEndTrip}
            activeOpacity={0.8}
            style={s.endBtn}
          >
            <X size={18} color="#fff" />
            <Text style={s.endBtnText}>End Trip</Text>
          </TouchableOpacity>
        )}

        {/* Route info when not started */}
        {tripState === 'idle' && !showFarePrompt && tripStations && (
          <View style={s.routeInfo}>
            <View style={s.routeInfoRow}>
              <View style={[s.dot, { backgroundColor: '#22c55e' }]} />
              <Text style={s.routeInfoText}>{origin?.name}</Text>
            </View>
            <View style={s.routeInfoDivider} />
            {tripStations.length > 2 && (
              <>
                <View style={s.routeInfoRow}>
                  <ChevronDown size={12} color={t.textSecondary} />
                  <Text style={s.routeInfoSub}>
                    {tripStations.length - 2} stop{tripStations.length - 2 !== 1 ? 's' : ''} along the way
                  </Text>
                </View>
                <View style={s.routeInfoDivider} />
              </>
            )}
            <View style={s.routeInfoRow}>
              <View style={[s.dot, { backgroundColor: '#ef4444' }]} />
              <Text style={s.routeInfoText}>{dest?.name}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* ── Post-trip fare collection modal ── */}
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

            {/* Trip summary stats */}
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

            {/* Points indicator */}
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

            {/* Offline indicator */}
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
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    loadingText: { color: t.textSecondary, textAlign: 'center', marginTop: 100 },

    // Top bar
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topLabel: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    topLabelText: {
      color: '#fff',
      fontSize: 14,
      fontFamily: font.semibold,
    },

    // Bottom card
    bottomCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },

    // Approaching
    approachBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      padding: 12,
      borderRadius: 12,
    },
    approachText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // Progress
    progressSection: { gap: 12 },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? c.stone700 : c.stone200,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: c.amber500,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressItem: {
      alignItems: 'center',
      flex: 1,
    },
    progressValue: {
      fontSize: 14,
      fontFamily: font.bold,
      color: t.text,
    },
    progressLabel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },

    // Buttons
    goBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.amber500,
      paddingVertical: 16,
      borderRadius: 16,
    },
    goBtnDisabled: {
      backgroundColor: isDark ? c.stone700 : c.stone300,
    },
    goBtnText: {
      color: '#fff',
      fontSize: 18,
      fontFamily: font.bold,
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
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
    },
    tripActionText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    endBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#ef4444',
      paddingVertical: 14,
      borderRadius: 16,
    },
    endBtnText: {
      color: '#fff',
      fontSize: 15,
      fontFamily: font.semibold,
    },

    // Route info
    routeInfo: {
      gap: 6,
      paddingTop: 4,
    },
    routeInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeInfoText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
    },
    routeInfoSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
    routeInfoDivider: {
      width: 2,
      height: 12,
      backgroundColor: isDark ? c.stone700 : c.stone200,
      marginLeft: 5,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    // Station-by-station progress
    stationToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    stationToggleText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    stationList: {
      gap: 0,
      paddingBottom: 4,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 32,
    },
    stationTimeline: {
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stationLine: {
      width: 2,
      height: 8,
    },
    stationDotCurrent: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.amber500,
      borderWidth: 2,
      borderColor: isDark ? c.stone800 : c.stone100,
    },
    stationDotUpcoming: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? c.stone600 : c.stone300,
    },
    stationInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 8,
    },
    stationName: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      flex: 1,
    },
    stationNamePassed: {
      color: '#22c55e',
      fontFamily: font.medium,
    },
    stationNameCurrent: {
      color: c.amber500,
      fontFamily: font.bold,
    },
    stationDistance: {
      fontSize: 11,
      fontFamily: font.regular,
      color: c.amber500,
      marginLeft: 8,
    },

    // Trip summary stats (post-trip modal)
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: isDark ? c.stone800 : c.stone100,
      borderRadius: 16,
      paddingVertical: 14,
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
      color: t.text,
    },
    summaryLabel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
    summaryDivider: {
      width: 1,
      height: 32,
      backgroundColor: isDark ? c.stone700 : c.stone300,
    },

    // Points badge
    pointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    pointsBadgeText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: c.amber500,
    },
    pointsBonusHint: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
    },

    // Offline badge
    offlineBadge: {
      backgroundColor: isDark ? 'rgba(156,163,175,0.12)' : 'rgba(156,163,175,0.08)',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    offlineBadgeText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: t.textSecondary,
      textAlign: 'center',
    },

    // Post-trip fare modal
    fareModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    fareModalCard: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      gap: 20,
    },
    fareModalHeader: {
      alignItems: 'center',
      gap: 8,
    },
    fareModalTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: t.text,
    },
    fareModalSub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      textAlign: 'center',
    },
    fareModalLabel: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.text,
    },
    fareInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? c.stone800 : c.stone100,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 8,
    },
    fareCurrency: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.textSecondary,
    },
    fareInput: {
      flex: 1,
      fontSize: 24,
      fontFamily: font.bold,
      color: t.text,
      paddingVertical: 14,
    },
    fareSubmitBtn: {
      backgroundColor: c.amber500,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    fareSubmitText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: font.bold,
    },
    fareSkipText: {
      color: t.textSecondary,
      fontSize: 13,
      fontFamily: font.regular,
      textAlign: 'center',
    },
  })
}
