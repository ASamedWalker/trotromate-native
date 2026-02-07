import type { ReportType, LevelSlug, LevelInfo } from '@/lib/types'

export const REPORT_POINTS: Record<ReportType, number> = {
  fare: 10,
  queue: 5,
  incident: 15,
  train: 10,
  tale: 8,
}

export const STREAK_CONFIG = {
  THRESHOLD_DAYS: 7,
  BONUS_POINTS: 5,
}

export const LEVELS: Record<LevelSlug, LevelInfo> = {
  passenger: {
    slug: 'passenger',
    name: 'Passenger',
    icon: 'user',
    emoji: '🚶',
    min_points: 0,
    max_points: 49,
    color: '#78716c',
  },
  regular: {
    slug: 'regular',
    name: 'Regular',
    icon: 'users',
    emoji: '🚌',
    min_points: 50,
    max_points: 199,
    color: '#3b82f6',
  },
  local_expert: {
    slug: 'local_expert',
    name: 'Local Expert',
    icon: 'map-pin',
    emoji: '📍',
    min_points: 200,
    max_points: 499,
    color: '#8b5cf6',
  },
  troski_legend: {
    slug: 'troski_legend',
    name: 'Troski Legend',
    icon: 'trophy',
    emoji: '🏆',
    min_points: 500,
    max_points: Infinity,
    color: '#f59e0b',
  },
}

export const LEVEL_ORDER: LevelSlug[] = ['passenger', 'regular', 'local_expert', 'troski_legend']

export function calculateLevel(points: number): LevelSlug {
  if (points >= 500) return 'troski_legend'
  if (points >= 200) return 'local_expert'
  if (points >= 50) return 'regular'
  return 'passenger'
}

export function getNextLevel(currentLevel: LevelSlug): LevelInfo | null {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevel)
  if (currentIndex === -1 || currentIndex >= LEVEL_ORDER.length - 1) {
    return null
  }
  return LEVELS[LEVEL_ORDER[currentIndex + 1]]
}

export function calculateProgress(
  points: number,
  currentLevel: LevelSlug
): { pointsNeeded: number; progressPercent: number } | null {
  const nextLevel = getNextLevel(currentLevel)
  if (!nextLevel) return null

  const currentLevelInfo = LEVELS[currentLevel]
  const pointsInCurrentLevel = points - currentLevelInfo.min_points
  const pointsToNextLevel = nextLevel.min_points - currentLevelInfo.min_points
  const pointsNeeded = nextLevel.min_points - points

  return {
    pointsNeeded,
    progressPercent: Math.min(100, Math.round((pointsInCurrentLevel / pointsToNextLevel) * 100)),
  }
}
