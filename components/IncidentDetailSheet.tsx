import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native'
import {
  X,
  MapPin,
  ShieldCheck,
  ThumbsUp,
  Clock,
  AlertTriangle,
} from 'lucide-react-native'
import { font, themed } from '@/lib/theme'
import { timeAgo } from '@/lib/utils/time'
import type { ActiveIncident } from '@/lib/hooks/useActiveIncidents'

const SHEET_HEIGHT = 420

/* ── Incident configs ────────────────────────────── */

const INCIDENT_META: Record<string, { label: string; color: string; darkColor: string; description: string }> = {
  traffic:           { label: 'HEAVY TRAFFIC',      color: '#f59e0b', darkColor: '#d97706', description: 'Slow-moving traffic reported in this area. Consider alternate routes.' },
  accident:          { label: 'ACCIDENT',            color: '#dc2626', darkColor: '#991b1b', description: 'An accident has been reported. Drive carefully and expect delays.' },
  police:            { label: 'POLICE CHECKPOINT',   color: '#3b82f6', darkColor: '#2563eb', description: 'Police checkpoint ahead. Have your documents ready.' },
  police_checkpoint: { label: 'POLICE CHECKPOINT',   color: '#3b82f6', darkColor: '#2563eb', description: 'Police checkpoint ahead. Have your documents ready.' },
  roadwork:          { label: 'ROAD WORK',           color: '#f97316', darkColor: '#ea580c', description: 'Road construction or maintenance in progress. Expect detours.' },
  road_closure:      { label: 'ROAD CLOSED',         color: '#f97316', darkColor: '#ea580c', description: 'This road is currently closed. Find an alternative route.' },
  flooding:          { label: 'FLOODING / HAZARD',   color: '#0d9488', darkColor: '#0f766e', description: 'Flooding or road hazard reported. Proceed with caution.' },
  breakdown:         { label: 'BREAKDOWN / WORK',    color: '#d97706', darkColor: '#b45309', description: 'Vehicle breakdown or road work reported in this area.' },
}

const DEFAULT_META = { label: 'INCIDENT', color: '#ef4444', darkColor: '#dc2626', description: 'An incident has been reported in this area.' }

/* ── Component ───────────────────────────────────── */

interface Props {
  incident: ActiveIncident
  onClose: () => void
}

export function IncidentDetailSheet({ incident, onClose }: Props) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const meta = INCIDENT_META[incident.incident_type] ?? DEFAULT_META
  const s = getStyles(isDark, meta.color)

  // Time remaining until expiry
  const expiresAt = new Date(incident.expires_at)
  const minsRemaining = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60_000))

  // Slide-up entrance + swipe-down dismiss animation
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 25,
        stiffness: 300,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start()
  }, [translateY, backdropOpacity])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose())
  }

  // PanResponder for swipe-down-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx * 1.5),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.4) {
          dismiss()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 300,
          }).start()
        }
      },
    }),
  ).current

  return (
    <View style={s.container}>
      {/* Backdrop — tap to dismiss */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <View style={s.liveBadgeRow}>
              <View style={[s.liveBadge, { backgroundColor: meta.color + '18' }]}>
                <View style={[s.liveDot, { backgroundColor: meta.color }]} />
                <Text style={[s.liveText, { color: meta.color }]}>LIVE</Text>
              </View>
              <Text style={s.title}>{meta.label}</Text>
            </View>
            <View style={s.locationRow}>
              <MapPin size={14} color={isDark ? '#a8a29e' : '#7a7674'} />
              <Text style={s.locationText} numberOfLines={1}>{incident.location_name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={dismiss} activeOpacity={0.7} style={s.closeBtn}>
            <X size={20} color={isDark ? '#a8a29e' : '#7a7674'} />
          </TouchableOpacity>
        </View>

        {/* Context */}
        <View style={s.contextCard}>
          <View style={[s.contextIcon, { backgroundColor: meta.color + '15' }]}>
            <AlertTriangle size={18} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.contextLabel}>WHAT'S HAPPENING</Text>
            <Text style={s.contextText}>{meta.description}</Text>
          </View>
        </View>

        {/* Time info */}
        <View style={s.timeRow}>
          <Clock size={14} color={isDark ? '#a8a29e' : '#7a7674'} />
          <Text style={s.timeText}>
            Reported {timeAgo(incident.reported_at)} · {minsRemaining > 0 ? `Expires in ${minsRemaining}m` : 'Expiring soon'}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity activeOpacity={0.85} style={s.confirmBtn}>
            <ShieldCheck size={18} color="#fff" />
            <View>
              <Text style={s.confirmText}>Still Active</Text>
              <Text style={s.confirmSub}>Confirm this report</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={s.clearBtn}>
            <ThumbsUp size={18} color="#fff" />
            <View>
              <Text style={s.clearText}>It's Clear!</Text>
              <Text style={s.clearSub}>Mark as resolved</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* XP reward hint */}
        <View style={s.xpRow}>
          <Text style={s.xpText}>Confirming earns you <Text style={s.xpBold}>+2 XP</Text></Text>
        </View>
      </Animated.View>
    </View>
  )
}

/* ── Styles ───────────────────────────────────────── */

const getStyles = (isDark: boolean, accentColor: string) => {
  const surface = themed(isDark).sheetBg
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#fafaf9' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'

  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: surface,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      paddingHorizontal: 24,
      paddingBottom: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.08,
      shadowRadius: 40,
      elevation: 8,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#d6d3d1',
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 20,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    liveBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    liveText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 1.5,
    },
    title: {
      fontSize: 22,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    // Context
    contextCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: surfaceLow,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },
    contextIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contextLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: accentColor,
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    contextText: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurface,
      lineHeight: 20,
    },

    // Time
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 24,
    },
    timeText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },

    // Actions
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    confirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#15803d',
      paddingVertical: 16,
      borderRadius: 20,
      shadowColor: '#15803d',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    confirmText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
    },
    confirmSub: {
      fontSize: 10,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.7)',
    },
    clearBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#b02500',
      paddingVertical: 16,
      borderRadius: 20,
      shadowColor: '#b02500',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    clearText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
    },
    clearSub: {
      fontSize: 10,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.7)',
    },

    // XP
    xpRow: {
      alignItems: 'center',
    },
    xpText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    xpBold: {
      fontFamily: font.bold,
      color: accentColor,
    },
  })
}
