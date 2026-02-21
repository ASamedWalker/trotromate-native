// Troski Core Types

// Transport types supported
export type TransportType = 'trotro' | 'okada'

// Route represents a trotro/okada route (e.g., Circle → Madina)
export interface Route {
  id: string
  from_location: string
  to_location: string
  via?: string
  official_fare: number
  estimated_duration_mins: number
  distance_km?: number
  is_popular: boolean
  transport_type?: TransportType
  created_at: string
  updated_at: string
}

// Station represents a trotro station/terminal
export interface Station {
  id: string
  name: string
  location: string
  latitude?: number
  longitude?: number
  is_major: boolean
  created_at: string
}

// Crowdsourced fare report
export interface FareReport {
  id: string
  route_id: string
  reported_fare: number
  reporter_id?: string
  reported_at: string
  is_verified: boolean
}

// Crowdsourced queue status
export interface QueueReport {
  id: string
  station_id: string | null
  station_name: string | null
  queue_status: 'empty' | 'short' | 'moderate' | 'long' | 'very_long'
  wait_time_estimate_mins?: number
  reporter_id?: string
  reported_at: string
  route_id?: string
}

// Aggregated fare data for a route (from route_fare_stats view)
export interface RouteFareStats {
  route_id: string
  official_fare: number
  avg_reported_fare: number
  min_reported_fare: number
  max_reported_fare: number
  report_count: number
  last_report_at: string | null
}

// Route with merged fare statistics
export interface RouteWithStats extends Route {
  fare_stats: RouteFareStats | null
}

// === Rewards System ===

export type ReportType = 'fare' | 'queue' | 'incident' | 'train' | 'tale'
export type LevelSlug = 'passenger' | 'regular' | 'local_expert' | 'troski_legend'

export interface LevelInfo {
  slug: LevelSlug
  name: string
  icon: string
  emoji: string
  min_points: number
  max_points: number
  color: string
}

export interface ContributorProfile {
  id: string
  device_id: string
  display_name: string | null
  total_points: number
  current_level: LevelSlug
  current_streak: number
  longest_streak: number
  last_report_date: string | null
  total_reports: number
  fare_reports: number
  queue_reports: number
  incident_reports: number
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  criteria_type: string
  criteria_value: Record<string, unknown>
  points_bonus: number
  created_at: string
}

export interface EarnedBadge extends Badge {
  earned_at: string
  metadata?: Record<string, unknown>
}

export interface RewardResult {
  points_awarded: number
  new_total: number
  level_up: boolean
  new_level?: LevelSlug
  previous_level?: LevelSlug
  badges_earned: Badge[]
  streak_bonus?: number
  new_streak: number
  profile: ContributorProfile
}

export interface LeaderboardEntry {
  rank: number
  id: string
  device_id: string
  display_name: string | null
  current_level: string
  weekly_points: number
  total_points: number
  badge_count: number
}

export interface PointsHistoryEntry {
  id: string
  contributor_id: string
  report_id?: string
  report_type?: string
  points: number
  reason: string
  metadata?: Record<string, unknown>
  created_at: string
}

// === Train/Rail Module ===

export type {
  TrainLine,
  TrainStation,
  TrainReport,
  TrainReportType,
  CrowdLevel,
  TrainDirection,
  TrainReportStats,
  TrainLineWithStats,
  TrainReportWithNames,
} from './train'

// === Incident Reports ===

export type IncidentType = 'traffic' | 'accident' | 'police' | 'roadwork'

export interface IncidentReport {
  id: string
  location_name: string
  incident_type: IncidentType
  latitude?: number | null
  longitude?: number | null
  reporter_id?: string
  reported_at: string
  confirmations: number
  expires_at: string
}

// === Trotro Tales ===

export type TalePostType = 'trip' | 'queue' | 'tale'

export interface TalePost {
  id: string
  device_id: string
  display_name: string | null
  is_anonymous: boolean
  image_url: string
  image_urls: string[] | null
  caption: string | null
  post_type: TalePostType
  location_name: string
  like_count: number
  comment_count: number
  created_at: string
  is_hidden: boolean
}

export interface TalePostWithMeta extends TalePost {
  is_liked: boolean
  is_own: boolean
}
