import { supabase } from '@/lib/supabase/client'
import type {
  TrainLine,
  TrainStation,
  TrainReport,
  TrainReportStats,
  TrainLineWithStats,
  TrainReportWithNames,
} from '@/lib/types'
import {
  validateEnum,
  validateFare,
  validateIntRange,
  validateNotes,
  TRAIN_REPORT_TYPES,
  TRAIN_DIRECTIONS,
  CROWD_LEVELS,
} from '@/lib/security/validate'

export async function fetchTrainLines(): Promise<TrainLineWithStats[]> {
  const { data: lines, error } = await supabase
    .from('train_lines')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error || !lines) return []

  // Get stats for all lines
  const { data: stats } = await supabase.from('train_report_stats').select('*')

  // Get station counts per line
  const { data: stationCounts } = await supabase
    .from('train_stations')
    .select('line_id')
    .eq('is_active', true)

  const countMap: Record<string, number> = {}
  if (stationCounts) {
    for (const s of stationCounts) {
      countMap[s.line_id] = (countMap[s.line_id] || 0) + 1
    }
  }

  return lines.map((line: TrainLine) => ({
    ...line,
    stats: stats?.find((s: TrainReportStats) => s.line_id === line.id) || null,
    station_count: countMap[line.id] || 0,
  }))
}

export async function fetchTrainLineDetail(lineId: string): Promise<{
  line: TrainLine
  stations: TrainStation[]
  recentReports: TrainReportWithNames[]
} | null> {
  const { data: line, error } = await supabase
    .from('train_lines')
    .select('*')
    .eq('id', lineId)
    .single()

  if (error || !line) return null

  const { data: stations } = await supabase
    .from('train_stations')
    .select('*')
    .eq('line_id', lineId)
    .eq('is_active', true)
    .order('order_index')

  const { data: reports } = await supabase
    .from('train_reports')
    .select('*, train_stations(name), train_lines(name)')
    .eq('line_id', lineId)
    .order('reported_at', { ascending: false })
    .limit(20)

  const recentReports: TrainReportWithNames[] = (reports || []).map((r: any) => ({
    ...r,
    station_name: r.train_stations?.name,
    line_name: r.train_lines?.name,
    train_stations: undefined,
    train_lines: undefined,
  }))

  return {
    line,
    stations: stations || [],
    recentReports,
  }
}

export async function fetchStationReports(
  stationId: string,
  limit = 10
): Promise<TrainReport[]> {
  const { data, error } = await supabase
    .from('train_reports')
    .select('*')
    .eq('station_id', stationId)
    .order('reported_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data
}

export async function submitTrainReport(params: {
  lineId: string
  stationId: string
  reportType: string
  direction?: string
  crowdLevel?: string
  reportedFare?: number
  delayMins?: number
  notes?: string
  deviceId: string
}): Promise<{ reportId: string } | null> {
  const reportType = validateEnum(params.reportType, TRAIN_REPORT_TYPES)
  if (!reportType) return null

  const direction = params.direction ? validateEnum(params.direction, TRAIN_DIRECTIONS) : null
  const crowdLevel = params.crowdLevel ? validateEnum(params.crowdLevel, CROWD_LEVELS) : null
  const reportedFare = params.reportedFare != null ? validateFare(params.reportedFare) : null
  const delayMins = params.delayMins != null ? validateIntRange(params.delayMins, 0, 300) : null
  const notes = validateNotes(params.notes)

  const { data: report, error } = await supabase
    .from('train_reports')
    .insert({
      line_id: params.lineId,
      station_id: params.stationId,
      report_type: reportType,
      direction,
      crowd_level: crowdLevel,
      reported_fare: reportedFare,
      delay_mins: delayMins,
      notes,
      device_id: params.deviceId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting train report:', error)
    return null
  }

  return { reportId: report.id }
}
