import { View, Text, StyleSheet } from 'react-native'
import { font } from '@/lib/theme'

// Deterministic color from string (same input = same color always)
const AVATAR_COLORS = [
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#ec4899', // pink
  '#f97316', // orange
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#a855f7', // purple
]

function getColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string | null, deviceId?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  // Fallback to device ID last 2 chars
  if (deviceId) {
    return deviceId.slice(-2).toUpperCase()
  }
  return '??'
}

interface InitialsAvatarProps {
  name?: string | null
  deviceId?: string
  size?: number
  fontSize?: number
}

export default function InitialsAvatar({
  name,
  deviceId,
  size = 40,
  fontSize,
}: InitialsAvatarProps) {
  const seed = deviceId ?? name ?? 'default'
  const color = getColor(seed)
  const initials = getInitials(name ?? null, deviceId)
  const computedFontSize = fontSize ?? Math.round(size * 0.4)
  const borderRadius = size / 2

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: color,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: computedFontSize }]}>
        {initials}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontFamily: font.bold,
  },
})
