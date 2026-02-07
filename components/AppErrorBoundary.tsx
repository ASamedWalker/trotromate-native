import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AlertTriangle, RotateCcw } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AppErrorBoundary caught:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? '#292524' : '#fef2f2' }]}>
          <AlertTriangle size={40} color={c.red500} />
        </View>
        <Text style={[styles.title, { color: t.text }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: t.textSecondary }]}>
          The app ran into an unexpected error. You can try again or restart the app.
        </Text>
        {__DEV__ && error && (
          <View style={[styles.errorBox, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
            <Text style={[styles.errorText, { color: c.red500 }]} numberOfLines={4}>
              {error.message}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn} activeOpacity={0.8}>
          <RotateCcw size={18} color={c.white} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: font.bold,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    fontFamily: font.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 12,
    fontFamily: font.regular,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.amber500,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  retryText: {
    color: c.white,
    fontSize: 16,
    fontFamily: font.semibold,
  },
})
