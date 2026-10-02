/**
 * Troski rider-app UI primitives. Build screens from these instead of
 * hand-rolling buttons, cards, pills and badges per screen.
 *
 *   import { Button, Card, ListRow, SectionHeader, Chip, Badge } from '@/components/ui'
 *
 * Tokens: lib/theme.ts (brand, ui, space, radius, type, cardShadow).
 * Light-only (dark mode is off app-wide). Sentence case everywhere — no
 * ALL-CAPS tracked labels. Lucide icons only, no emoji as UI.
 */
import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle, type PressableProps } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { brand, ui, space, radius, type, cardShadow, font } from '@/lib/theme'

// ── Tap — Pressable with a pressed style ─────────────────────────────────────
// NativeWind (babel jsxImportSource) wraps Pressable and silently DROPS
// function-form AND array styles — the whole style vanishes. Track pressed state ourselves and pass plain style objects.
export function Tap({
  style,
  pressedStyle,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  children?: React.ReactNode
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { setPressed(true); onPressIn?.(e) }}
      onPressOut={(e) => { setPressed(false); onPressOut?.(e) }}
      // Flattened to ONE plain object: NativeWind's Pressable wrapper also
      // drops array styles (only a plain object survives).
      style={StyleSheet.flatten([style, pressed && !rest.disabled ? (pressedStyle ?? { opacity: 0.85 }) : null])}
    >
      {children}
    </Pressable>
  )
}

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  fullWidth = true,
  style,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  icon?: LucideIcon
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const inactive = disabled || loading
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: brand.orange, fg: ui.onBrand },
    secondary: { bg: ui.surface, fg: ui.text },
    outline: { bg: ui.card, fg: ui.text, border: ui.surfaceStrong },
    ghost: { bg: 'transparent', fg: brand.orangeText },
    danger: { bg: ui.dangerSoft, fg: ui.danger },
  }
  const p = disabled ? { bg: ui.surface, fg: ui.textTertiary } : palette[variant]
  return (
    <Tap
      onPress={() => {
        if (inactive) return
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      pressedStyle={variant === 'primary' ? { backgroundColor: brand.orangePressed } : { opacity: 0.8 }}
      style={[
        {
          height: size === 'lg' ? 56 : 48,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: 'border' in p && p.border ? 1 : 0,
          borderColor: 'border' in p ? p.border : undefined,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {Icon && <Icon size={18} color={p.fg} strokeWidth={2.25} />}
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.semibold, fontSize: size === 'lg' ? 17 : 16, color: p.fg }}>{label}</Text>
        </>
      )}
    </Tap>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({
  children,
  onPress,
  padded = true,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode
  onPress?: () => void
  padded?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const base: ViewStyle = { backgroundColor: ui.card, borderRadius: radius.lg, padding: padded ? space.lg : 0, ...cardShadow }
  if (!onPress) return <View style={[base, style]}>{children}</View>
  return (
    <Tap
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[base, style]}
      pressedStyle={{ opacity: 0.9, transform: [{ scale: 0.99 }] }}
    >
      {children}
    </Tap>
  )
}

// ── SectionHeader — "Services ............ See all" ─────────────────────────
export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string
  action?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      <Text style={[type.title, { color: ui.text }]}>{title}</Text>
      {action && onAction && (
        <Tap onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[type.labelStrong, { color: brand.orangeText }]}>{action}</Text>
        </Tap>
      )}
    </View>
  )
}

// ── ListRow — icon · title/subtitle · value · chevron ───────────────────────
export function ListRow({
  icon: Icon,
  iconColor = ui.text,
  iconBg = ui.surface,
  title,
  subtitle,
  value,
  valueSub,
  onPress,
  chevron,
}: {
  icon?: LucideIcon
  iconColor?: string
  iconBg?: string
  title: string
  subtitle?: string
  value?: string
  valueSub?: string
  onPress?: () => void
  chevron?: boolean
}) {
  const content = (
    <>
      {Icon && (
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyMedium, { color: ui.text }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[type.label, { color: ui.textSecondary, fontFamily: font.regular }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {(value || valueSub) && (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {value && <Text style={[type.labelStrong, { color: ui.text, fontSize: 15 }]}>{value}</Text>}
          {valueSub && <Text style={[type.caption, { color: ui.textSecondary }]}>{valueSub}</Text>}
        </View>
      )}
      {(chevron ?? !!onPress) && <ChevronRight size={18} color={ui.textTertiary} strokeWidth={2} />}
    </>
  )
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, minHeight: 64 }
  if (!onPress) return <View style={row}>{content}</View>
  return (
    <Tap
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
      accessibilityRole="button"
      style={row}
      pressedStyle={{ backgroundColor: ui.surface }}
    >
      {content}
    </Tap>
  )
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: 1, backgroundColor: ui.hairline, marginLeft: inset }} />
}

// ── Chip — filter / mode pill ───────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string
  selected?: boolean
  onPress?: () => void
  icon?: LucideIcon
}) {
  const fg = selected ? ui.onBrand : ui.text
  return (
    <Tap
      onPress={onPress && (() => { Haptics.selectionAsync(); onPress() })}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 38,
          paddingHorizontal: space.lg,
          borderRadius: radius.pill,
          backgroundColor: selected ? brand.orange : ui.surface,
        },
      ]}
    >
      {Icon && <Icon size={16} color={fg} strokeWidth={2} />}
      <Text style={[type.labelStrong, { color: fg }]}>{label}</Text>
    </Tap>
  )
}

// ── Badge — small status tag ("Soon", "Live", "Verified"). Sentence case. ────
type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info' | 'dark'

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: BadgeTone; icon?: LucideIcon }) {
  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: ui.surface, fg: ui.textSecondary },
    brand: { bg: brand.orangeSoft, fg: brand.orangeText },
    success: { bg: ui.successSoft, fg: ui.success },
    danger: { bg: ui.dangerSoft, fg: ui.danger },
    warning: { bg: ui.warningSoft, fg: ui.warning },
    info: { bg: ui.infoSoft, fg: ui.info },
    dark: { bg: 'rgba(10,10,10,0.72)', fg: ui.onBrand },
  }
  const t = tones[tone]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: t.bg, alignSelf: 'flex-start' }}>
      {Icon && <Icon size={12} color={t.fg} strokeWidth={2.5} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: t.fg }}>{label}</Text>
    </View>
  )
}
