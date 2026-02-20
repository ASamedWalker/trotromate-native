import { useState } from 'react'
import { TouchableOpacity, Text, Share, useColorScheme, StyleSheet } from 'react-native'
import { Share2, Check, Loader2 } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { createTripShare } from '@/lib/services/safety'

interface TripShareButtonProps {
  routeId?: string
  from: string
  to: string
  estimatedMins?: number
}

export function TripShareButton({ routeId, from, to, estimatedMins }: TripShareButtonProps) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const { deviceId } = useApp()
  const [isSharing, setIsSharing] = useState(false)
  const [shared, setShared] = useState(false)

  async function handleShare() {
    if (!deviceId) return
    setIsSharing(true)
    try {
      const trip = await createTripShare(deviceId, from, to, routeId, estimatedMins)
      if (!trip) throw new Error('Failed')

      const shareUrl = `https://troski.app/share/${trip.share_token}`
      const message = `I'm taking a trotro from ${from} to ${to}. Track my trip: ${shareUrl}`

      await Share.share({ message, title: 'My Troski Trip' })
      setShared(true)
      setTimeout(() => setShared(false), 3000)
    } catch {
      // User cancelled
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <TouchableOpacity
      onPress={handleShare}
      disabled={isSharing}
      activeOpacity={0.7}
      style={[s.button, shared && s.buttonShared]}
    >
      {isSharing ? (
        <Loader2 size={16} color="#0ea5e9" />
      ) : shared ? (
        <Check size={16} color="#fff" />
      ) : (
        <Share2 size={16} color="#0ea5e9" />
      )}
      <Text style={[s.text, shared && s.textShared]}>
        {shared ? 'Shared!' : 'Share Trip'}
      </Text>
    </TouchableOpacity>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.15)',
    },
    buttonShared: {
      backgroundColor: '#22c55e',
      borderColor: '#22c55e',
    },
    text: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: '#0ea5e9',
    },
    textShared: {
      color: '#fff',
    },
  })
}
