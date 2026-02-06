import { useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DEVICE_ID_KEY = 'trotromate_device_id'

function generateDeviceId(): string {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () => {
    return Math.floor(Math.random() * 16).toString(16)
  })
}

async function getStoredDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(DEVICE_ID_KEY)
    }
    return await SecureStore.getItemAsync(DEVICE_ID_KEY)
  } catch {
    return null
  }
}

async function storeDeviceId(id: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(DEVICE_ID_KEY, id)
    } else {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id)
    }
  } catch (error) {
    console.error('Failed to store device ID:', error)
  }
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initDeviceId() {
      let id = await getStoredDeviceId()

      if (!id) {
        id = generateDeviceId()
        await storeDeviceId(id)
      }

      setDeviceId(id)
      setIsLoading(false)
    }

    initDeviceId()
  }, [])

  return { deviceId, isLoading }
}
