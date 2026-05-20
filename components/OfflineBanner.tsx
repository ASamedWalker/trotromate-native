import { useMemo } from 'react'
import { View, Text, useColorScheme, StyleSheet } from 'react-native'
import { WifiOff, CloudUpload } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'

export default function OfflineBanner() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { isOnline, pendingReports } = useApp()

  if (isOnline && pendingReports === 0) return null

  const s = useMemo(() => getStyles(isDark), [isDark])

  if (!isOnline) {
    return (
      <View style={s.offlineBanner}>
        <WifiOff size={14} color={c.white} />
        <Text style={s.bannerText}>
          You're offline{pendingReports > 0 ? ` · ${pendingReports} pending` : ''}
        </Text>
      </View>
    )
  }

  // Online but has pending reports (syncing)
  return (
    <View style={s.syncBanner}>
      <CloudUpload size={14} color={c.white} />
      <Text style={s.bannerText}>Syncing {pendingReports} report{pendingReports !== 1 ? 's' : ''}...</Text>
    </View>
  )
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.stone600,
      paddingVertical: 6,
      paddingHorizontal: 16,
      gap: 8,
    },
    syncBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.amber600,
      paddingVertical: 6,
      paddingHorizontal: 16,
      gap: 8,
    },
    bannerText: {
      color: c.white,
      fontSize: 12,
      fontFamily: font.medium,
    },
  })
