import { Easing } from 'react-native'

/**
 * Motion tokens — single source of truth for animation timing.
 * Derived from Material 3 motion specs, snapped to the durations this
 * codebase already converged on (300/400/500). Use these instead of
 * magic numbers; see docs/DESIGN_DIRECTION.md §3.
 *
 * Reanimated entering/exiting: FadeInDown.duration(dur.entrance)
 * Core Animated: Animated.timing(v, { duration: dur.base, easing: ease.standard })
 * Respect reduce-motion for decorative animation:
 *   import { useReducedMotion } from 'react-native-reanimated'
 */
export const dur = {
  /** press feedback, color/opacity ticks */
  tap: 150,
  /** toggles, chips, small reveals */
  fast: 200,
  /** standard transitions — sheets, fades, segment switches */
  base: 300,
  /** card/section entrances (the app-wide default) */
  entrance: 400,
  /** hero moments — gauges, celebrations, count-ups lead-in */
  emphasized: 500,
  /** ambient loops — skeleton pulse, breathing markers */
  pulse: 800,
} as const

// M3 cubic-bezier control points (also usable with reanimated's Easing.bezier)
export const bezier = {
  standard: [0.2, 0, 0, 1],
  /** entrances — fast start, soft landing */
  decelerate: [0.05, 0.7, 0.1, 1],
  /** exits — soft start, fast leave */
  accelerate: [0.3, 0, 0.8, 0.15],
} as const

export const ease = {
  standard: Easing.bezier(...bezier.standard),
  decelerate: Easing.bezier(...bezier.decelerate),
  accelerate: Easing.bezier(...bezier.accelerate),
}
