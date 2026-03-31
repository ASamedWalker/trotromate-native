import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet, useColorScheme } from 'react-native'
import { Check, MapPin } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { ScheduleStop } from '@/lib/constants/train-schedule'

// ── Types ──

interface StationStatus {
  station: { id: string; name: string }
  status: 'passed' | 'current' | 'upcoming'
  distanceKm?: number
}

interface Props {
  stationStatuses: StationStatus[]
  lineColor: string
  scheduleStopMap?: Map<string, ScheduleStop>
  /** Format distance helper from trip service */
  formatDistance: (km: number) => string
}

// ── Component ──

export function TrainTimeline({ stationStatuses, lineColor, scheduleStopMap, formatDistance }: Props) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark, lineColor)

  const currentIndex = stationStatuses.findIndex(ss => ss.status === 'current')
  const passedCount = stationStatuses.filter(ss => ss.status === 'passed').length
  const remainingCount = stationStatuses.length - passedCount - 1

  return (
    <View style={s.container}>
      {/* Header: stops away badge */}
      {currentIndex >= 0 && remainingCount > 0 && (
        <View style={s.stopsAwayBadge}>
          <MapPin size={12} color={lineColor} />
          <Text style={s.stopsAwayText}>
            {remainingCount} stop{remainingCount !== 1 ? 's' : ''} away
          </Text>
        </View>
      )}

      {/* Timeline */}
      {stationStatuses.map((ss, i) => {
        const isPassed = ss.status === 'passed'
        const isCurrent = ss.status === 'current'
        const isUpcoming = ss.status === 'upcoming'
        const isFirst = i === 0
        const isLast = i === stationStatuses.length - 1

        // Schedule time lookup
        const sched = scheduleStopMap?.get(ss.station.name.toLowerCase())
        const arriveTime = sched?.arrive ?? sched?.depart

        // Is the next station also passed? (for coloring the bottom track)
        const nextIsPassed = i < stationStatuses.length - 1 &&
          stationStatuses[i + 1].status === 'passed'
        const nextIsCurrent = i < stationStatuses.length - 1 &&
          stationStatuses[i + 1].status === 'current'

        return (
          <View key={ss.station.id} style={s.row}>
            {/* Left column: track + dot */}
            <View style={s.trackColumn}>
              {/* Top track segment */}
              {!isFirst && (
                <View style={[
                  s.trackSegment,
                  (isPassed || isCurrent) && { backgroundColor: lineColor },
                ]} />
              )}

              {/* Station dot */}
              {isPassed ? (
                <View style={[s.dotPassed, { backgroundColor: lineColor }]}>
                  <Check size={10} color="#fff" strokeWidth={3} />
                </View>
              ) : isCurrent ? (
                <PulsingDot lineColor={lineColor} isDark={isDark} />
              ) : (
                <View style={s.dotUpcoming}>
                  <View style={s.dotUpcomingInner} />
                </View>
              )}

              {/* Bottom track segment */}
              {!isLast && (
                <View style={[
                  s.trackSegment,
                  (isPassed && (nextIsPassed || nextIsCurrent)) && { backgroundColor: lineColor },
                ]} />
              )}
            </View>

            {/* Right column: station info */}
            <View style={[
              s.stationInfo,
              isCurrent && s.stationInfoCurrent,
            ]}>
              <View style={s.stationNameRow}>
                <View style={{ flex: 1 }}>
                  {isCurrent && (
                    <Text style={[s.currentLabel, { color: lineColor }]}>NEXT</Text>
                  )}
                  <Text
                    style={[
                      s.stationName,
                      isPassed && s.stationNamePassed,
                      isCurrent && s.stationNameCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    {ss.station.name}
                  </Text>
                  {isCurrent && ss.distanceKm != null && (
                    <Text style={[s.distanceText, { color: lineColor }]}>
                      {formatDistance(ss.distanceKm)}
                    </Text>
                  )}
                </View>

                {/* Time — right aligned like MTA */}
                {arriveTime && (
                  <Text style={[
                    s.timeText,
                    isPassed && s.timeTextPassed,
                    isCurrent && [s.timeTextCurrent, { color: lineColor }],
                  ]}>
                    {arriveTime}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ── Pulsing dot for current station ──

function PulsingDot({ lineColor, isDark }: { lineColor: string; isDark: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: lineColor + '20',
          transform: [{ scale: pulseAnim }],
        }}
      />
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          borderWidth: 3,
          borderColor: lineColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: lineColor,
          }}
        />
      </View>
    </View>
  )
}

// ── Styles ──

const getStyles = (isDark: boolean, lineColor: string) => {
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const trackDefault = isDark ? 'rgba(255,255,255,0.1)' : '#e0dbd8'

  return StyleSheet.create({
    container: {
      paddingVertical: 4,
    },

    // Stops away badge
    stopsAwayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: lineColor + '15',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      marginBottom: 8,
      marginLeft: 40,
    },
    stopsAwayText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: lineColor,
    },

    // Row
    row: {
      flexDirection: 'row',
      minHeight: 48,
    },

    // Track column
    trackColumn: {
      width: 32,
      alignItems: 'center',
    },
    trackSegment: {
      flex: 1,
      width: 4,
      backgroundColor: trackDefault,
      borderRadius: 2,
    },

    // Dots
    dotPassed: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotUpcoming: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: isDark ? '#2a2a2c' : '#f0edeb',
      borderWidth: 3,
      borderColor: trackDefault,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotUpcomingInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: trackDefault,
    },

    // Station info
    stationInfo: {
      flex: 1,
      paddingLeft: 14,
      paddingVertical: 6,
      justifyContent: 'center',
    },
    stationInfoCurrent: {
      backgroundColor: lineColor + '0D',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginLeft: 8,
    },
    stationNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // Labels
    currentLabel: {
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 2,
      marginBottom: 2,
    },
    stationName: {
      fontSize: 14,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    stationNamePassed: {
      color: lineColor,
      fontFamily: font.semibold,
    },
    stationNameCurrent: {
      color: onSurface,
      fontFamily: font.bold,
      fontSize: 16,
    },
    distanceText: {
      fontSize: 12,
      fontFamily: font.semibold,
      marginTop: 2,
    },

    // Time (right-aligned)
    timeText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginLeft: 8,
    },
    timeTextPassed: {
      color: lineColor + '80',
      textDecorationLine: 'line-through',
    },
    timeTextCurrent: {
      fontFamily: font.bold,
      fontSize: 14,
    },
  })
}
