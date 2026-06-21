import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Biometric unlock (Face ID / Touch ID / fingerprint) for wallet payments,
 * layered on top of the PIN (always the fallback).
 *
 * expo-local-authentication is loaded LAZILY via require() inside try/catch so
 * this module is safe on a dev client that hasn't been rebuilt with the native
 * module yet — every call degrades to "unavailable" instead of crashing.
 */
const PREF_KEY = '@troski_biometric_enabled_v1'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LA(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication')
  } catch {
    return null
  }
}

export interface BiometricCapability {
  available: boolean
  enrolled: boolean
  type: 'face' | 'fingerprint' | 'iris' | 'none'
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const mod = LA()
  if (!mod) return { available: false, enrolled: false, type: 'none' }
  try {
    const hasHardware = await mod.hasHardwareAsync()
    const enrolled = await mod.isEnrolledAsync()
    const types = await mod.supportedAuthenticationTypesAsync()
    let type: BiometricCapability['type'] = 'none'
    if (types.includes(mod.AuthenticationType.FACIAL_RECOGNITION)) type = 'face'
    else if (types.includes(mod.AuthenticationType.FINGERPRINT)) type = 'fingerprint'
    else if (types.includes(mod.AuthenticationType.IRIS)) type = 'iris'
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
  const mod = LA()
  if (!mod) return false
  try {
    const res = await mod.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true,
      cancelLabel: 'Cancel',
    })
    return res.success
  } catch {
    return false
  }
}
