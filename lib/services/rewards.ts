import { supabase } from '@/lib/supabase/client'
import { REPORT_POINTS, TRIP_POINTS, STREAK_CONFIG, calculateLevel } from '@/lib/constants/rewards'
import type {
  ContributorProfile,
  Badge,
  EarnedBadge,
  RewardResult,
  LeaderboardEntry,
  PointsHistoryEntry,
  LevelSlug,
  ReportType,
} from '@/lib/types'

// Get or create a contributor profile by device ID
export async function getOrCreateProfile(deviceId: string): Promise<ContributorProfile | null> {
  let { data: profile, error } = await supabase
    .from('contributor_profiles')
    .select('*')
    .eq('device_id', deviceId)
    .single()

  if (error && error.code === 'PGRST116') {
    const displayName = `Troski Fan #${deviceId.substring(0, 4).toUpperCase()}`
    const { data: newProfile, error: createError } = await supabase
      .from('contributor_profiles')
      .insert({ device_id: deviceId, display_name: displayName })
      .select()
      .single()

    if (createError) {
      console.error('Error creating profile:', createError)
      return null
    }
    profile = newProfile
  } else if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return profile
}

// Award points after a report submission (ported from PWA server logic)
export async function awardPointsForReport(params: {
  deviceId: string
  reportType: ReportType
  reportId: string
  routeId?: string
}): Promise<RewardResult | null> {
  const { deviceId, reportType, reportId, routeId } = params

  if (!deviceId) return null

  try {
    const profile = await getOrCreateProfile(deviceId)
    if (!profile) return null

    // Calculate base points with multipliers
    let basePoints = REPORT_POINTS[reportType]
    let bonusReason = ''

    // Coverage gap 3X bonus — route/station has no reports in last 4 hours
    if (reportType === 'fare' && routeId) {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('fare_reports')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', routeId)
        .gte('reported_at', fourHoursAgo)

      if ((count ?? 0) === 0) {
        basePoints = basePoints * 3
        bonusReason = '3X First Report'
      }
    } else if (reportType === 'queue') {
      // For queue reports, check by the report ID's station
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      const { data: thisReport } = await supabase
        .from('queue_reports')
        .select('station_name')
        .eq('id', reportId)
        .single()

      if (thisReport?.station_name) {
        const { count } = await supabase
          .from('queue_reports')
          .select('id', { count: 'exact', head: true })
          .eq('station_name', thisReport.station_name)
          .gte('reported_at', fourHoursAgo)

        if ((count ?? 0) <= 1) {
          basePoints = basePoints * 3
          bonusReason = '3X First Report'
        }
      }
    }

    // Peak hour 2X bonus (6-9 AM, 4-7 PM Ghana time = UTC)
    // Stacks with coverage gap: 3X * 2X = 6X during peak with no data
    const hour = new Date().getUTCHours()
    const isPeakHour = (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19)
    if (isPeakHour && !bonusReason) {
      basePoints = basePoints * 2
      bonusReason = '2X Peak Hour'
    } else if (isPeakHour && bonusReason) {
      // Already has coverage gap bonus — don't stack, but note it
      bonusReason += ' + Peak Hour'
    }

    // Calculate streak
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const lastReportDate = profile.last_report_date

    let newStreak = 1
    let streakBonus = 0

    if (lastReportDate === yesterday) {
      newStreak = profile.current_streak + 1
    } else if (lastReportDate === today) {
      newStreak = profile.current_streak
    } else {
      newStreak = 1
    }

    if (newStreak >= STREAK_CONFIG.THRESHOLD_DAYS) {
      streakBonus = STREAK_CONFIG.BONUS_POINTS
    }

    const totalPoints = basePoints + streakBonus
    const newTotalPoints = profile.total_points + totalPoints

    // Calculate level
    const previousLevel = profile.current_level as LevelSlug
    const newLevel = calculateLevel(newTotalPoints)
    const levelUp = newLevel !== previousLevel

    // Update profile
    const updateData: Record<string, unknown> = {
      total_points: newTotalPoints,
      total_reports: profile.total_reports + 1,
      current_streak: newStreak,
      longest_streak: Math.max(profile.longest_streak, newStreak),
      last_report_date: today,
      current_level: newLevel,
      updated_at: new Date().toISOString(),
    }

    if (reportType === 'fare') updateData.fare_reports = profile.fare_reports + 1
    else if (reportType === 'queue') updateData.queue_reports = profile.queue_reports + 1
    else if (reportType === 'incident') updateData.incident_reports = profile.incident_reports + 1

    const { data: updatedProfile, error: updateError } = await supabase
      .from('contributor_profiles')
      .update(updateData)
      .eq('id', profile.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return null
    }

    // Update route counts if route_id provided
    if (routeId) {
      const { error: routeCountError } = await supabase
        .from('contributor_route_counts')
        .upsert(
          { contributor_id: profile.id, route_id: routeId, report_count: 1 },
          { onConflict: 'contributor_id,route_id' }
        )

      if (routeCountError) {
        await supabase.rpc('increment_route_count', {
          p_contributor_id: profile.id,
          p_route_id: routeId,
        })
      }
    }

    // Log points in history
    await supabase.from('points_history').insert({
      contributor_id: profile.id,
      report_id: reportId,
      report_type: reportType,
      points: totalPoints,
      reason: bonusReason ? `${reportType}_report (${bonusReason})` : `${reportType}_report`,
      metadata: {
        ...(streakBonus > 0 ? { streak_bonus: streakBonus } : {}),
        ...(bonusReason ? { bonus: bonusReason } : {}),
      },
    })

    // Check and award badges
    const badgesEarned = await checkAndAwardBadges(profile.id, {
      totalReports: updatedProfile.total_reports,
      fareReports: updatedProfile.fare_reports,
      queueReports: updatedProfile.queue_reports,
      incidentReports: updatedProfile.incident_reports,
      streak: newStreak,
      routeId,
      reportType,
      reportedAt: new Date().toISOString(),
    })

    // Add badge bonus points
    if (badgesEarned.length > 0) {
      const badgeBonus = badgesEarned.reduce((sum, b) => sum + b.points_bonus, 0)
      if (badgeBonus > 0) {
        await supabase
          .from('contributor_profiles')
          .update({ total_points: newTotalPoints + badgeBonus })
          .eq('id', profile.id)

        await supabase.from('points_history').insert({
          contributor_id: profile.id,
          points: badgeBonus,
          reason: 'badge_bonus',
          metadata: { badges: badgesEarned.map((b) => b.slug) },
        })
      }
    }

    return {
      points_awarded: totalPoints,
      new_total: newTotalPoints + badgesEarned.reduce((sum, b) => sum + b.points_bonus, 0),
      level_up: levelUp,
      new_level: levelUp ? newLevel : undefined,
      previous_level: levelUp ? previousLevel : undefined,
      badges_earned: badgesEarned,
      streak_bonus: streakBonus > 0 ? streakBonus : undefined,
      new_streak: newStreak,
      profile: updatedProfile,
    }
  } catch (error) {
    console.error('Error awarding points:', error)
    return null
  }
}

// Award points after completing a GO Mode trip
export async function awardPointsForTrip(params: {
  deviceId: string
  tripId: string
  withFare: boolean
}): Promise<RewardResult | null> {
  const { deviceId, tripId, withFare } = params

  if (!deviceId) return null

  try {
    const profile = await getOrCreateProfile(deviceId)
    if (!profile) return null

    // Calculate points: base + optional fare bonus
    const basePoints = TRIP_POINTS.completed
    const fareBonus = withFare ? TRIP_POINTS.fare_bonus : 0

    // Streak logic (same as reports — a trip counts as daily activity)
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const lastReportDate = profile.last_report_date

    let newStreak = 1
    let streakBonus = 0

    if (lastReportDate === yesterday) {
      newStreak = profile.current_streak + 1
    } else if (lastReportDate === today) {
      newStreak = profile.current_streak
    } else {
      newStreak = 1
    }

    if (newStreak >= STREAK_CONFIG.THRESHOLD_DAYS) {
      streakBonus = STREAK_CONFIG.BONUS_POINTS
    }

    const totalPoints = basePoints + fareBonus + streakBonus
    const newTotalPoints = profile.total_points + totalPoints

    // Calculate level
    const previousLevel = profile.current_level as LevelSlug
    const newLevel = calculateLevel(newTotalPoints)
    const levelUp = newLevel !== previousLevel

    // Update profile — increment points, streak, level. Do NOT increment total_reports.
    const { data: updatedProfile, error: updateError } = await supabase
      .from('contributor_profiles')
      .update({
        total_points: newTotalPoints,
        current_streak: newStreak,
        longest_streak: Math.max(profile.longest_streak, newStreak),
        last_report_date: today,
        current_level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile for trip:', updateError)
      return null
    }

    // Log points in history
    await supabase.from('points_history').insert({
      contributor_id: profile.id,
      report_id: tripId,
      report_type: 'trip',
      points: totalPoints,
      reason: withFare ? 'trip_with_fare' : 'trip_completed',
      metadata: {
        base_points: basePoints,
        ...(fareBonus > 0 ? { fare_bonus: fareBonus } : {}),
        ...(streakBonus > 0 ? { streak_bonus: streakBonus } : {}),
      },
    })

    // Check badges (forward-compatible — no trip-specific criteria yet)
    const badgesEarned = await checkAndAwardBadges(profile.id, {
      totalReports: updatedProfile.total_reports,
      fareReports: updatedProfile.fare_reports,
      queueReports: updatedProfile.queue_reports,
      incidentReports: updatedProfile.incident_reports,
      streak: newStreak,
      reportType: 'trip',
      reportedAt: new Date().toISOString(),
    })

    if (badgesEarned.length > 0) {
      const badgeBonus = badgesEarned.reduce((sum, b) => sum + b.points_bonus, 0)
      if (badgeBonus > 0) {
        await supabase
          .from('contributor_profiles')
          .update({ total_points: newTotalPoints + badgeBonus })
          .eq('id', profile.id)

        await supabase.from('points_history').insert({
          contributor_id: profile.id,
          points: badgeBonus,
          reason: 'badge_bonus',
          metadata: { badges: badgesEarned.map((b) => b.slug) },
        })
      }
    }

    return {
      points_awarded: totalPoints,
      new_total: newTotalPoints + badgesEarned.reduce((sum, b) => sum + b.points_bonus, 0),
      level_up: levelUp,
      new_level: levelUp ? newLevel : undefined,
      previous_level: levelUp ? previousLevel : undefined,
      badges_earned: badgesEarned,
      streak_bonus: streakBonus > 0 ? streakBonus : undefined,
      new_streak: newStreak,
      profile: updatedProfile,
    }
  } catch (error) {
    console.error('Error awarding trip points:', error)
    return null
  }
}

// Check badge criteria and award any newly earned badges
async function checkAndAwardBadges(
  contributorId: string,
  stats: {
    totalReports: number
    fareReports: number
    queueReports: number
    incidentReports: number
    streak: number
    routeId?: string
    reportType: string
    reportedAt?: string
  }
): Promise<Badge[]> {
  const earnedBadges: Badge[] = []

  try {
    const { data: allBadges } = await supabase.from('badges').select('*')
    if (!allBadges) return earnedBadges

    const { data: existingBadges } = await supabase
      .from('contributor_badges')
      .select('badge_id')
      .eq('contributor_id', contributorId)

    const earnedBadgeIds = new Set((existingBadges || []).map((b) => b.badge_id))

    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue

      const criteria = badge.criteria_value as Record<string, unknown>
      let earned = false
      let metadata: Record<string, unknown> | undefined

      switch (badge.criteria_type) {
        case 'count':
          if (criteria.total_reports && stats.totalReports >= (criteria.total_reports as number)) {
            earned = true
          }
          break

        case 'streak':
          if (criteria.days && stats.streak >= (criteria.days as number)) {
            earned = true
          }
          break

        case 'type': {
          const targetType = criteria.type as string
          const targetCount = criteria.count as number
          if (targetType === 'fare' && stats.fareReports >= targetCount) earned = true
          else if (targetType === 'queue' && stats.queueReports >= targetCount) earned = true
          else if (targetType === 'incident' && stats.incidentReports >= targetCount) earned = true
          break
        }

        case 'time':
          if (stats.reportedAt) {
            const reportHour = new Date(stats.reportedAt).getHours()
            if (criteria.hour_before && reportHour < (criteria.hour_before as number)) earned = true
            if (criteria.hour_after && reportHour >= (criteria.hour_after as number)) earned = true
          }
          break

        case 'route':
          if (stats.routeId) {
            const { data: routeCount } = await supabase
              .from('contributor_route_counts')
              .select('report_count')
              .eq('contributor_id', contributorId)
              .eq('route_id', stats.routeId)
              .single()

            if (routeCount && routeCount.report_count >= (criteria.count as number)) {
              earned = true
              metadata = { route_id: stats.routeId }
            }
          }
          break
      }

      if (earned) {
        await supabase.from('contributor_badges').insert({
          contributor_id: contributorId,
          badge_id: badge.id,
          metadata,
        })
        earnedBadges.push(badge)
      }
    }
  } catch (error) {
    console.error('Error checking badges:', error)
  }

  return earnedBadges
}

// Fetch full profile with badges and rank
export async function fetchProfile(
  deviceId: string
): Promise<{ profile: ContributorProfile; badges: EarnedBadge[]; rank?: number } | null> {
  const profile = await getOrCreateProfile(deviceId)
  if (!profile) return null

  // Get earned badges
  const { data: badgeData } = await supabase
    .from('contributor_badges')
    .select('earned_at, metadata, badge:badges(*)')
    .eq('contributor_id', profile.id)
    .order('earned_at', { ascending: false })

  const badges: EarnedBadge[] = (badgeData || [])
    .filter((b: any) => b.badge)
    .map((b: any) => ({
      ...b.badge,
      earned_at: b.earned_at,
      metadata: b.metadata,
    }))

  // Get rank from leaderboard
  const { data: leaderboard } = await supabase
    .from('weekly_leaderboard')
    .select('device_id')
    .order('weekly_points', { ascending: false })
    .limit(100)

  let rank: number | undefined
  if (leaderboard) {
    const idx = leaderboard.findIndex((e: any) => e.device_id === deviceId)
    if (idx !== -1) rank = idx + 1
  }

  return { profile, badges, rank }
}

// Fetch weekly leaderboard
export async function fetchLeaderboard(
  deviceId?: string
): Promise<{ entries: LeaderboardEntry[]; userRank?: number }> {
  const { data, error } = await supabase
    .from('weekly_leaderboard')
    .select('*')
    .limit(50)

  if (error || !data) return { entries: [] }

  const entries: LeaderboardEntry[] = data.map((entry: any, index: number) => ({
    rank: index + 1,
    id: entry.id,
    device_id: entry.device_id,
    display_name: entry.display_name,
    current_level: entry.current_level,
    weekly_points: entry.weekly_points || 0,
    total_points: entry.total_points || 0,
    badge_count: entry.badge_count || 0,
  }))

  let userRank: number | undefined
  if (deviceId) {
    const idx = entries.findIndex((e) => e.device_id === deviceId)
    if (idx !== -1) userRank = idx + 1
  }

  return { entries, userRank }
}

// Fetch all available badges
export async function fetchAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data
}

// Fetch points history for a contributor
export async function fetchPointsHistory(
  deviceId: string,
  limit = 20
): Promise<PointsHistoryEntry[]> {
  const profile = await getOrCreateProfile(deviceId)
  if (!profile) return []

  const { data, error } = await supabase
    .from('points_history')
    .select('*')
    .eq('contributor_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data
}
