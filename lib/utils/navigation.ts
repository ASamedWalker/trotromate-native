import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

/**
 * Open native maps app with directions to a location.
 */
export function openDirections(lat: number, lon: number, label: string) {
  const encodedLabel = encodeURIComponent(label)

  if (Platform.OS === 'ios') {
    // https://maps.apple.com always opens Apple Maps on iOS
    const appleMaps = `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodedLabel}&dirflg=d`
    Linking.openURL(appleMaps)
  } else {
    // Try Google Maps navigation first, fall back to web
    Linking.openURL(`google.navigation:q=${lat},${lon}&mode=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodedLabel}`)
    })
  }
}
