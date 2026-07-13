import { useCallback, useEffect, useState } from 'react'
import {
  getDepartureReminders,
  setDepartureReminder,
  cancelDepartureReminder,
  type DepartureReminder,
  type ReminderFailure,
} from '@/lib/services/trainReminders'

/**
 * Shared state for train departure reminders. Reads the persisted set on mount
 * and exposes toggle helpers; the board and the line cards both use this so a
 * reminder armed in one place reflects in the other.
 */
export function useDepartureReminders() {
  const [reminders, setReminders] = useState<Record<string, DepartureReminder>>({})

  const refresh = useCallback(async () => {
    setReminders(await getDepartureReminders())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isSet = useCallback(
    (scheduleId: string) => !!reminders[scheduleId],
    [reminders],
  )

  /** Toggle: arms if off, cancels if on. Returns the resulting on/off state. */
  const toggle = useCallback(
    async (params: {
      scheduleId: string
      lineCode: string
      origin: string
      destination: string
      departTime: string
      secondsUntilDeparture: number
    }): Promise<{ on: boolean; failure?: ReminderFailure }> => {
      if (reminders[params.scheduleId]) {
        await cancelDepartureReminder(params.scheduleId)
        await refresh()
        return { on: false }
      }
      const result = await setDepartureReminder(params)
      await refresh()
      if (result === 'too-soon' || result === 'denied') return { on: false, failure: result }
      return { on: true }
    },
    [reminders, refresh],
  )

  return { reminders, isSet, toggle, refresh }
}
