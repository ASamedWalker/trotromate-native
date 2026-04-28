/**
 * Shared animation presets for $50M Series A polish.
 * Import these in any screen for consistent, premium feel.
 *
 * Usage:
 *   import { ANIM } from '@/lib/utils/animations'
 *   <Animated.View entering={ANIM.fadeSlide(0)}>  // delay 0
 *   <Animated.View entering={ANIM.fadeSlide(1)}>  // delay 1 = 100ms
 *   <Animated.View entering={ANIM.fadeSlide(2)}>  // delay 2 = 200ms
 */

import { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated'

// Base delay increment (ms) between staggered elements
const STAGGER = 80

export const ANIM = {
  /** Staggered fade + slide up. Pass index (0, 1, 2...) for auto-delay. */
  fadeSlide: (index: number, duration = 400) =>
    FadeInDown.delay(100 + index * STAGGER).duration(duration),

  /** Simple fade in with stagger */
  fade: (index: number, duration = 350) =>
    FadeIn.delay(100 + index * STAGGER).duration(duration),

  /** Slide from right (for list items) */
  slideRight: (index: number, duration = 350) =>
    SlideInRight.delay(100 + index * STAGGER).duration(duration),

  /** Hero entrance — no delay, slightly slower */
  hero: () => FadeInDown.delay(50).duration(500),

  /** Fast entrance for headers */
  header: () => FadeInDown.duration(300),
} as const
