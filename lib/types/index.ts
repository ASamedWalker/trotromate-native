// Troski Core Types

// Transport types supported
export type TransportType = 'trotro' | 'okada' | 'train'

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
  region?: string // e.g., 'greater_accra', 'central', 'ashanti'
  // GPRTU fare verification
  fare_approved_at: string | null
  fare_approved_by: string | null
  is_gprtu_verified: boolean
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

// Intermediate stop along a trotro route
export interface RouteStop {
  id: string
  route_id: string
  transport_stop_id: string | null
  stop_name: string
  latitude: number
  longitude: number
  stop_order: number
  is_terminal: boolean
  distance_from_origin_km: number | null
  duration_from_origin_mins: number | null
  source: 'osm' | 'community' | 'admin'
  is_verified: boolean
}

// Cached traffic info for a route
export interface RouteTraffic {
  duration_in_traffic_mins: number
  traffic_condition: 'light' | 'moderate' | 'heavy' | 'severe'
  delay_mins: number
}

// Per-route rider rating aggregates (route_rating_stats view)
export interface RouteRatingStats {
  route_id: string
  avg_rating: number
  rating_count: number
  last_rated_at: string | null
}

// Route with merged fare statistics
export interface RouteWithStats extends Route {
  fare_stats: RouteFareStats | null
  rating_stats?: RouteRatingStats | null
  traffic?: RouteTraffic | null
  stops?: RouteStop[]
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
  bio: string | null
  avatar_url: string | null
  home_route_id: string | null
  home_route_label: string | null
  follower_count: number
  following_count: number
  is_public: boolean
  total_points: number
  current_level: LevelSlug
  current_streak: number
  longest_streak: number
  last_report_date: string | null
  view_streak: number
  longest_view_streak: number
  last_checkin_date: string | null
  total_reports: number
  fare_reports: number
  queue_reports: number
  incident_reports: number
  created_at: string
  updated_at: string
}

export interface PublicProfile {
  device_id: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  current_level: string
  total_points: number
  total_reports: number
  current_streak: number
  follower_count: number
  following_count: number
  home_route_label: string | null
  home_route_id: string | null
  is_public: boolean
  is_following?: boolean
  tale_count?: number
  created_at?: string
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
  profile?: ContributorProfile
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

// === Completed Trips (Data Collection) ===

export interface CompletedTrip {
  id: string
  device_id: string
  route_id: string | null
  train_line_id: string | null
  transport_type: 'trotro' | 'train'
  from_location: string
  to_location: string
  from_lat: number | null
  from_lng: number | null
  to_lat: number | null
  to_lng: number | null
  started_at: string
  ended_at: string
  duration_mins: number | null
  distance_km: number | null
  fare_paid: number | null
  fare_currency: string
  station_count: number | null
  reached_destination: boolean
  created_at: string
}

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

export type TalePostType = 'trip' | 'queue' | 'tale' | 'text'

export type TaleMediaType = 'image' | 'video' | 'text'

export interface TalePost {
  id: string
  device_id: string
  display_name: string | null
  is_anonymous: boolean
  image_url: string | null
  image_urls: string[] | null
  caption: string | null
  post_type: TalePostType
  location_name: string
  like_count: number
  comment_count: number
  created_at: string
  is_hidden: boolean
  media_type: TaleMediaType
  video_url: string | null
  video_thumbnail_url: string | null
  video_duration_secs: number | null
  /** Author's real rewards tier, merged client-side from contributor_profiles */
  author_level?: LevelSlug
}

export interface TalePostWithMeta extends TalePost {
  is_liked: boolean
  is_own: boolean
  reaction_summary: Record<string, number>
  user_reactions: string[]
}

export interface TaleComment {
  id: string
  post_id: string
  device_id: string
  display_name: string | null
  content: string
  created_at: string
  parent_comment_id: string | null
  reply_count: number
  /** Author's real rewards tier, merged client-side from contributor_profiles */
  author_level?: LevelSlug
}

export interface TaleCommentWithMeta extends TaleComment {
  is_own: boolean
}
