import { View, Text, TouchableOpacity } from 'react-native'
import { WifiOff, RefreshCw } from 'lucide-react-native'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

/**
 * Shared honest-state views (UX-14). A failed fetch must never masquerade as
 * an empty dataset — "couldn't load, retry" and "none yet" are different
 * truths and get different UI.
 */

export function LoadErrorState({
  message = "Couldn't load this. Check your connection and try again.",
  onRetry,
  compact = false,
}: {
  message?: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 20 : 40, paddingHorizontal: 24 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <WifiOff size={22} color="#6B7280" />
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#374151', textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={{
            marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF3EE',
          }}
        >
          <RefreshCw size={14} color={BRAND} />
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: BRAND }}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

/** Small inline banner variant for screens that still show cached content. */
export function StaleDataBanner({ message = "Couldn't update — showing saved data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <TouchableOpacity
      disabled={!onRetry}
      onPress={onRetry}
      accessibilityRole={onRetry ? 'button' : undefined}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 24, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 9,
        borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(180,83,9,0.15)',
      }}
    >
      <WifiOff size={14} color="#B45309" />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 12, color: '#B45309' }}>{message}</Text>
      {onRetry && <RefreshCw size={13} color="#B45309" />}
    </TouchableOpacity>
  )
}
