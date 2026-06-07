// TrotroMate shared color palette
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

// Plus Jakarta Sans font family map (weights baked into font names for RN)
export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  black: 'PlusJakartaSans_800ExtraBold', // No 900 weight — use 800
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
  primary: c.amber500,
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
