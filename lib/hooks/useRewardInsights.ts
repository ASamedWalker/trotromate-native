import { useQuery } from '@tanstack/react-query'

// Adapter between the Rewards screen and the impact/streak/station/league RPCs
// (Troski UX v2, RW1–RW4). The RPC wrapper lives in lib/services/insights.ts
// (owned by another workstream). Until it lands, every loader returns null and
// the screen hides the matching card. Never fill these with estimates: a null
// means "the backend can't say yet", and the UI must show nothing rather than
// a made-up number.

/** RW1: riders who viewed one of your reports while it was fresh, this month. */
export interface ImpactInsight {
  ridersHelped: number
  queueReports: number
  fareReports: number
  problemReports: number
}

/** RW2: Mon–Fri streak. `week` = Mon..Fri for the current week. */
export interface WeekdayStreakInsight {
  streakDays: number
  week: boolean[] // length 5, Mon..Fri
}

/** RW3: your rank at the stations you report from, 30-day window. */
export interface StationRankInsight {
  stationName: string
  rank: number
  reports30d: number
  legendReports30d: number // reports by #1 at this station
  isLegend: boolean
}

/** RW4: weekly corridor league rows (around your rank), paid reporters excluded. */
export interface CorridorLeagueInsight {
  corridorName: string
  daysLeft: number | null
  rows: { rank: number; name: string; reports: number; isMe: boolean }[]
}

export interface RewardInsights {
  impact: ImpactInsight | null
  streak: WeekdayStreakInsight | null
  stations: StationRankInsight[] | null
  league: CorridorLeagueInsight | null
}

const EMPTY: RewardInsights = { impact: null, streak: null, stations: null, league: null }

// Swap this body for calls into lib/services/insights.ts once it exists
// (myImpact / myWeekdayStreak / myStationRanks / corridorLeague), mapping each
// result into the shapes above and keeping null for "not available".
async function loadInsights(_deviceId: string): Promise<RewardInsights> {
  return EMPTY
}

export function useRewardInsights(deviceId: string | null) {
  const { data, refetch } = useQuery({
    queryKey: ['reward-insights', deviceId],
    queryFn: () => loadInsights(deviceId!),
    enabled: !!deviceId,
    staleTime: 5 * 60 * 1000,
  })
  return { insights: data ?? EMPTY, refetch }
}
