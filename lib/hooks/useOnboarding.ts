import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_KEY = 'troski_onboarding_complete'
const ONBOARDING_VERSION = '4' // v4: Kelly's redesign — illustrations, 5 slides, auth buttons

export function useOnboarding() {
  const [isComplete, setIsComplete] = useState(true) // Default to true so it doesn't flash
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setIsComplete(value === ONBOARDING_VERSION)
      setIsLoading(false)
    })
  }, [])

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION)
    setIsComplete(true)
  }, [])

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY)
    setIsComplete(false)
  }, [])

  return {
    isComplete,
    isLoading,
    showOnboarding: !isLoading && !isComplete,
    completeOnboarding,
    resetOnboarding,
  }
}
