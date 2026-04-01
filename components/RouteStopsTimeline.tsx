import React from 'react'
import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import { MapPin, Navigation } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { RouteStop } from '@/lib/types'

interface Props {
  stops: RouteStop[]
  accentColor?: string
}

export function RouteStopsTimeline({ stops, accentColor = '#815100' }: Props) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark, accentColor)

  if (!stops || stops.length < 2) return null

  const terminalStops = stops.filter(s => s.is_terminal)
  const intermediateCount = stops.length - terminalStops.length

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Navigation size={14} color={accentColor} />
        <Text style={s.headerText}>
          {stops.length} stops along this route
        </Text>
        {intermediateCount > 0 && (
          <Text style={s.headerSub}>
            {intermediateCount} junction{intermediateCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Timeline */}
      {stops.map((stop, i) => {
        const isFirst = i === 0
        const isLast = i === stops.length - 1
        const isTerminal = stop.is_terminal

        return (
          <View key={`${stop.stop_order}-${stop.stop_name}`} style={s.row}>
            {/* Track column */}
            <View style={s.trackColumn}>
              {/* Top segment */}
              {!isFirst && <View style={s.trackSegment} />}

              {/* Dot */}
              {isTerminal ? (
                <View style={[s.dotTerminal, { backgroundColor: accentColor }]}>
                  <MapPin size={10} color="#fff" />
                </View>
              ) : (
                <View style={s.dotIntermediate}>
                  <View style={[s.dotInner, { backgroundColor: accentColor + '60' }]} />
                </View>
              )}

              {/* Bottom segment */}
              {!isLast && <View style={s.trackSegment} />}
            </View>

            {/* Stop info */}
            <View style={[s.stopInfo, isTerminal && s.stopInfoTerminal]}>
              <Text
                style={[s.stopName, isTerminal && s.stopNameTerminal]}
                numberOfLines={1}
              >
                {stop.stop_name}
              </Text>

              {/* Distance + duration */}
              {stop.distance_from_origin_km != null && stop.distance_from_origin_km > 0 && (
                <Text style={s.meta}>
                  {stop.distance_from_origin_km.toFixed(1)} km
                  {stop.duration_from_origin_mins != null && stop.duration_from_origin_mins > 0
                    ? ` · ~${stop.duration_from_origin_mins} min`
                    : ''
                  }
                </Text>
              )}

              {isFirst && <Text style={s.terminalLabel}>BOARD HERE</Text>}
              {isLast && <Text style={s.terminalLabel}>ALIGHT HERE</Text>}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const getStyles = (isDark: boolean, accent: string) => {
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const trackColor = isDark ? 'rgba(255,255,255,0.12)' : '#e0dbd8'

  return StyleSheet.create({
    container: {
      marginTop: 16,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    headerText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurface,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },

    row: {
      flexDirection: 'row',
      minHeight: 40,
    },

    trackColumn: {
      width: 28,
      alignItems: 'center',
    },
    trackSegment: {
      flex: 1,
      width: 3,
      backgroundColor: trackColor,
      borderRadius: 1.5,
    },

    dotTerminal: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotIntermediate: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: isDark ? '#2a2a2c' : '#f5f3f1',
      borderWidth: 2,
      borderColor: trackColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotInner: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },

    stopInfo: {
      flex: 1,
      paddingLeft: 10,
      paddingVertical: 4,
      justifyContent: 'center',
    },
    stopInfoTerminal: {
      paddingVertical: 6,
    },
    stopName: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    stopNameTerminal: {
      fontSize: 15,
      fontFamily: font.bold,
      color: onSurface,
    },
    meta: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 1,
    },
    terminalLabel: {
      fontSize: 9,
      fontFamily: font.bold,
      color: accent,
      letterSpacing: 1.5,
      marginTop: 2,
    },
  })
}
