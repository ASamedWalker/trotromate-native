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

// Poppins font family map (weights baked into font names for RN)
export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black',
}

// Helper to get theme-aware colors
export const themed = (isDark: boolean) => ({
  bg: isDark ? c.stone950 : c.stone50,
  card: isDark ? c.stone900 : c.white,
  cardAlt: isDark ? c.stone800 : c.stone100,
  text: isDark ? c.stone50 : c.stone900,
  textSecondary: isDark ? c.stone400 : c.stone500,
  textTertiary: isDark ? c.stone600 : c.stone400,
  border: isDark ? c.stone800 : c.stone200,
  primary: c.amber500,
})
