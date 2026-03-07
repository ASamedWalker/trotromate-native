import { TouchableOpacity, StyleSheet, View, type ViewStyle } from 'react-native'

interface GlassActionButtonProps {
  isDark: boolean
  onPress: () => void
  size?: number
  style?: ViewStyle
  children: React.ReactNode
}

export function GlassActionButton({ isDark, onPress, size = 40, style, children }: GlassActionButtonProps) {
  const borderRadius = size / 2

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { width: size, height: size, borderRadius }, style]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: isDark ? 'rgba(28,25,23,0.75)' : 'rgba(231,229,227,0.65)',
          },
        ]}
      />
      {children}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
})
