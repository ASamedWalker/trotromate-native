// Train/Rail Module Types

export interface TrainLine {
  id: string
  name: string
  code: string
  color: string
  official_fare: number | null
  is_active: boolean
  created_at: string
}

export interface TrainStation {
  id: string
  name: string
  line_id: string
  order_index: number
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
}

export type TrainReportType = 'schedule' | 'crowd' | 'fare' | 'delay'
export type CrowdLevel = 'empty' | 'few_seats' | 'standing' | 'packed'
export type TrainDirection = 'inbound' | 'outbound'

export interface TrainReport {
  id: string
  line_id: string
  station_id: string
  report_type: TrainReportType
  direction: TrainDirection | null
  crowd_level: CrowdLevel | null
  reported_fare: number | null
  delay_mins: number | null
  notes: string | null
  device_id: string
  reported_at: string
}

export interface TrainReportStats {
  line_id: string
  line_name: string
  total_reports: number
  fare_reports: number
  avg_fare: number | null
  crowd_reports: number
  schedule_reports: number
  delay_reports: number
  avg_delay_mins: number | null
  last_report_at: string | null
}

export interface TrainLineWithStats extends TrainLine {
  stats: TrainReportStats | null
  station_count?: number
}

// Train report with joined station/line names (for activity feed, detail views)
export interface TrainReportWithNames extends TrainReport {
  station_name?: string
  line_name?: string
}
