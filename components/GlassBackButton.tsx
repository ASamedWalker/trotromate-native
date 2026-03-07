import { TouchableOpacity, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

interface GlassBackButtonProps {
  isDark: boolean
  color?: string
  size?: number
  onPress?: () => void
}

export function GlassBackButton({ isDark, color, size = 40, onPress }: GlassBackButtonProps) {
  const router = useRouter()
  const iconColor = color ?? (isDark ? '#fafaf9' : '#1c1917')
  const borderRadius = size / 2

  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.back())}
      activeOpacity={0.7}
      style={[styles.container, { width: size, height: size, borderRadius }]}
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
      <ChevronLeft size={22} color={iconColor} />
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
