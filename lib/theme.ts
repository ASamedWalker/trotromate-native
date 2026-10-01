// ─────────────────────────────────────────────────────────────────────────────
// Troski design tokens (rider app). ONE source of truth — screens should import
// these instead of declaring local `const BRAND = '#FF4D1C'` or raw hex.
// Identity: orange brand + Baloo 2 + light UI (dark mode is off app-wide).
// Values follow the Uber Base table in CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────

/** Brand */
export const brand = {
  orange: '#FF4D1C',
  orangePressed: '#E23F12',
  orangeSoft: '#FFF1EC', // tinted backgrounds, selected chips
  orangeText: '#C2360F', // orange text on white that passes contrast
} as const

/** Semantic colours — use these, not raw hex. One grey scale (Tailwind gray). */
export const ui = {
  bg: '#FAFAF9',
  card: '#FFFFFF',
  surface: '#F3F4F6', // grey fills: inputs, tiles, secondary buttons
  surfaceStrong: '#E5E7EB',
  hairline: '#EEEEEE',
  text: '#0A0A0A',
  textSecondary: '#6B7280',
  textTertiary: '#7C828C', // ~4:1 on white — readable outdoors (was #9CA3AF, 2.5:1)
  onBrand: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#ECFDF5',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  info: '#2563EB',
  infoSoft: '#EFF6FF',
} as const

/** Spacing — 24 is the screen gutter, 28 between sections */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, gutter: 24, section: 28, xxl: 32 } as const

/** Corner radii */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const

// TrotroMate shared color palette (legacy scale — prefer `ui` / `brand` above)
export const c = {
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber900: '#78350f',

  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e3',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  slate500: '#6b7280',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  stone950: '#0c0a09',

  violet50: '#f5f3ff',
  violet500: '#8b5cf6',
  violet900: '#2e1065',

  orange500: '#f97316',
  emerald500: '#10b981',
  red500: '#ef4444',
  pink500: '#ec4899',
  white: '#ffffff',
  black: '#000000',
}

// Baloo 2 font family map (weights baked into font names for RN).
// App-wide font — owner decision, June 2026 (was Plus Jakarta Sans).
export const font = {
  regular: 'Baloo2_400Regular',
  medium: 'Baloo2_500Medium',
  semibold: 'Baloo2_600SemiBold',
  bold: 'Baloo2_700Bold',
  extrabold: 'Baloo2_800ExtraBold',
  black: 'Baloo2_800ExtraBold', // No 900 weight — use 800
  // Display aliases (kept so screens can diverge from body text later)
  display: 'Baloo2_700Bold',
  displaySemi: 'Baloo2_600SemiBold',
  displayHeavy: 'Baloo2_800ExtraBold',
}

// Glass surface constants
export const glass = {
  dark: {
    background: 'rgba(12,10,9,0.65)',
    border: 'rgba(255,255,255,0.08)',
    tint: 'rgba(12,10,9,0.3)',
    fallback: '#1c1917',
  },
  light: {
    background: 'rgba(250,250,249,0.55)',
    border: 'rgba(0,0,0,0.06)',
    tint: 'rgba(255,255,255,0.25)',
    fallback: '#ffffff',
  },
  blur: {
    card: 50,
    nav: 80,
    sheet: 70,
  },
}

// Helper to get theme-aware colors
export const themed = (isDark: boolean) => ({
  bg: isDark ? c.stone950 : c.stone50,
  card: isDark ? c.stone900 : c.white,
  cardAlt: isDark ? c.stone800 : c.stone100,
  sheetBg: isDark ? '#1c1c1e' : '#f7f5f0',
  text: isDark ? c.white : c.stone950,
  textSecondary: isDark ? c.stone400 : c.stone600,
  textTertiary: isDark ? c.stone500 : c.stone400,
  border: isDark ? c.stone700 : c.stone300,
  primary: brand.orange, // was amber500 — the brand has been orange since 2026; nothing read this
})

// Shadow presets — Uber/DoorDash level (subtle, barely visible)
export const shadow = {
  /** Default card shadow — barely there, just enough depth */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  /** Elevated card — modal-like presence */
  cardStrong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  /** Floating elements — FABs, overlays */
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  /** No shadow — for dark mode */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
}

// Adaptive shadow — use in components: isDark ? shadow.none : shadow.card
export const adaptiveShadow = (isDark: boolean, level: keyof typeof shadow = 'card') =>
  isDark ? shadow.none : shadow[level]

/**
 * Type scale (Baloo 2). No lineHeight on purpose — Baloo clips glyph tops when
 * lineHeight < ~1.3× size (see CLAUDE.md). For display sizes (≥ 24) prefer
 * <HeroText size={…}>; these presets are for titles/body in normal flow.
 */
export const type = {
  title: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.5 },
  headline: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 16 },
  bodyMedium: { fontFamily: font.medium, fontSize: 16 },
  label: { fontFamily: font.medium, fontSize: 14 },
  labelStrong: { fontFamily: font.semibold, fontSize: 14 },
  caption: { fontFamily: font.medium, fontSize: 12 },
} as const

/** Card shadow per the Uber Base table (0 4 16 / 0.12 was heavy — softened to match the app) */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 3,
} as const
