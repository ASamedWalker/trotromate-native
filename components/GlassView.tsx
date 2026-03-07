import { StyleSheet, View } from 'react-native'

interface GlassViewProps {
  intensity?: number
  isDark?: boolean
  style?: any
  children?: React.ReactNode
}

export function GlassView({
  isDark = false,
  style,
  children,
}: GlassViewProps) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(250,250,249,0.92)',
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
