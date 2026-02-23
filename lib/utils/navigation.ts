import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

/**
 * Open native maps app with directions to a location.
 */
export function openDirections(lat: number, lon: number, label: string) {
  if (Platform.OS === 'ios') {
    const appleMaps = `maps://app?daddr=${lat},${lon}&dirflg=d`
    const googleMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
    Linking.canOpenURL(appleMaps).then((canOpen) => {
      Linking.openURL(canOpen ? appleMaps : googleMaps)
    })
  } else {
    Linking.openURL(`google.navigation:q=${lat},${lon}&mode=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`)
    })
  }
}
