import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Biometric unlock (Face ID / Touch ID / fingerprint) for wallet payments,
 * layered on top of the PIN. The PIN is always the fallback. A user opts in
 * after setting their PIN. Requires a native build with expo-local-authentication.
 */
const PREF_KEY = '@troski_biometric_enabled_v1'

export interface BiometricCapability {
  available: boolean
  enrolled: boolean
  type: 'face' | 'fingerprint' | 'iris' | 'none'
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    let type: BiometricCapability['type'] = 'none'
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) type = 'face'
    else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) type = 'fingerprint'
    else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) type = 'iris'
    return { available: hasHardware, enrolled, type }
  } catch {
    return { available: false, enrolled: false, type: 'none' }
  }
}

/** Human label for the device's biometric, e.g. "Face ID". */
export function biometricLabel(type: BiometricCapability['type']): string {
  switch (type) {
    case 'face': return 'Face ID'
    case 'fingerprint': return 'Fingerprint'
    case 'iris': return 'Iris'
    default: return 'Biometrics'
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === '1'
  } catch {
    return false
  }
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, on ? '1' : '0')
  } catch { /* ignore */ }
}

/** Prompt the biometric scanner. Returns true on success. */
export async function authenticateBiometric(reason = 'Authorise payment'): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true, // we handle PIN fallback ourselves
      cancelLabel: 'Cancel',
    })
    return res.success
  } catch {
    return false
  }
}
