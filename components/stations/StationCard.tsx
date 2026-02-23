import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Navigation, Users, Clock } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { QueueStatusBar } from './QueueStatusBar'
import { formatDistance } from '@/lib/utils/distance'
import { openDirections } from '@/lib/utils/navigation'

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const QUEUE_CONFIG: Record<QueueStatus, { label: string; estimate: string }> = {
  empty: { label: 'Empty', estimate: 'No wait' },
  short: { label: 'Short', estimate: '~5 min' },
  moderate: { label: 'Moderate', estimate: '~15 min' },
  long: { label: 'Long', estimate: '~30 min' },
  very_long: { label: 'Very Long', estimate: '45+ min' },
}

// Display name: "37 Military Hospital" → "37 Station", others append "Station"
function stationLabel(name: string): string {
  if (name === '37 Military Hospital') return '37 Station'
  if (name.endsWith('Station')) return name
  return `${name} Station`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

interface StationCardProps {
  station: {
    id: string
    name: string
    location: string
    is_major: boolean
    _lat: number
    _lng: number
    queue_stats?: {
      current_status: string
      report_count_last_hour: number
      last_report_at: string
    }[]
  }
  distanceKm: number | null
  isSelected: boolean
  onPress: () => void
  isDark: boolean
}

export function StationCard({ station, distanceKm, isSelected, onPress, isDark }: StationCardProps) {
  const t = themed(isDark)
  const queueStatus = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  const queueConfig = queueStatus ? QUEUE_CONFIG[queueStatus] : null
  const queueColor = queueStatus ? QUEUE_COLORS[queueStatus] : undefined
  const reportCount = station.queue_stats?.[0]?.report_count_last_hour ?? 0
  const lastReport = station.queue_stats?.[0]?.last_report_at

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: isSelected ? c.amber500 : t.border,
          borderLeftWidth: isSelected ? 3 : 1,
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isSelected ? 0.12 : 0.06,
            shadowRadius: 8,
          },
          android: { elevation: isSelected ? 4 : 2 },
        }),
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header: name + distance */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.text }]}>
            {stationLabel(station.name)}
          </Text>
          <Text style={[styles.location, { color: t.textSecondary }]}>
            {station.location}
          </Text>
        </View>
        {distanceKm !== null && (
          <Text style={[styles.distance, { color: t.textSecondary }]}>
            {formatDistance(distanceKm)}
          </Text>
        )}
      </View>

      {/* Queue status bar */}
      <View style={styles.barRow}>
        <QueueStatusBar status={queueStatus ?? null} isDark={isDark} />
      </View>

      {/* Queue label + estimate */}
      {queueConfig && queueColor ? (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: queueColor }]} />
          <Text style={[styles.statusLabel, { color: queueColor }]}>
            {queueConfig.label}
          </Text>
          <Clock size={12} color={t.textSecondary} />
          <Text style={[styles.statusEstimate, { color: t.textSecondary }]}>
            {queueConfig.estimate}
          </Text>
        </View>
      ) : (
        <Text style={[styles.noReports, { color: t.textTertiary }]}>
          No reports yet
        </Text>
      )}

      {/* Footer: reports + navigate */}
      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          {reportCount > 0 && lastReport && (
            <View style={styles.reportsRow}>
              <Users size={11} color={t.textTertiary} />
              <Text style={[styles.reportsText, { color: t.textTertiary }]}>
                {reportCount} report{reportCount !== 1 ? 's' : ''} · {timeAgo(lastReport)}
              </Text>
            </View>
          )}
          {station.is_major && (
            <Text style={[styles.majorBadge, { color: t.textTertiary }]}>
              MAJOR TERMINAL
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => openDirections(station._lat, station._lng, stationLabel(station.name))}
          activeOpacity={0.7}
        >
          <Navigation size={14} color={c.white} />
          <Text style={styles.navText}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontFamily: font.bold,
  },
  location: {
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 1,
  },
  distance: {
    fontSize: 13,
    fontFamily: font.semibold,
    marginLeft: 8,
  },
  barRow: {
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: font.semibold,
  },
  statusEstimate: {
    fontSize: 12,
    fontFamily: font.regular,
  },
  noReports: {
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  reportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportsText: {
    fontSize: 11,
    fontFamily: font.regular,
  },
  majorBadge: {
    fontSize: 9,
    fontFamily: font.semibold,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.amber500,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  navText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: c.white,
  },
})
