import { useState, useEffect, useRef } from 'react'
import { formatCountdown } from '@/lib/utils/ticket'

interface TicketTimerReturn {
  timeLeft: number        // ms remaining
  isExpired: boolean
  formatted: string       // "01:45:30"
  hours: number
  minutes: number
  seconds: number
}

/**
 * Countdown timer for ticket expiry.
 * Updates every second. Returns 0 when expired.
 */
export function useTicketTimer(expiresAt: string): TicketTimerReturn {
  const expiryMs = new Date(expiresAt).getTime()
  const [timeLeft, setTimeLeft] = useState(Math.max(0, expiryMs - Date.now()))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, expiryMs - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [expiryMs])

  const totalSecs = Math.floor(timeLeft / 1000)

  return {
    timeLeft,
    isExpired: timeLeft <= 0,
    formatted: formatCountdown(timeLeft),
    hours: Math.floor(totalSecs / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
  }
}
