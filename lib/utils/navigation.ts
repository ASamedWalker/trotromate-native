import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

/**
 * Open native maps app showing a station location with a pin.
 * The user can then tap "Directions" within the maps app if nearby.
 * This avoids "Directions Not Available" when far from the destination.
 */
export function openDirections(lat: number, lon: number, label: string) {
  const encodedLabel = encodeURIComponent(label)

  if (Platform.OS === 'ios') {
    // Show pin on Apple Maps — user can tap Directions from there
    Linking.openURL(`https://maps.apple.com/?ll=${lat},${lon}&q=${encodedLabel}`)
  } else {
    // geo: intent opens default maps app with a labeled pin
    Linking.openURL(`geo:${lat},${lon}?q=${lat},${lon}(${encodedLabel})`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`)
    })
  }
}
