import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { Alert, Linking, Platform } from 'react-native'

// Persisted set of active departure reminders, keyed by schedule id.
// One reminder per schedule (a given train run) — re-arming replaces it.
const STORE_KEY = '@troski_train_reminders_v1'

// How long before departure the reminder fires.
export const REMINDER_LEAD_MINUTES = 15

export interface DepartureReminder {
  scheduleId: string
  notifId: string
  lineCode: string
  origin: string
  destination: string
  departTime: string // "HH:MM" label, for display
  fireAt: number // epoch ms the notification fires
}

type ReminderMap = Record<string, DepartureReminder>

async function readAll(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as ReminderMap) : {}
  } catch {
    return {}
  }
}

async function writeAll(map: ReminderMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(map))
  } catch {
    // best-effort; reminder still fires from the OS schedule
  }
}

/** Drop reminders whose fire time has passed so the UI doesn't show stale "set" state */
async function prune(map: ReminderMap): Promise<ReminderMap> {
  const now = Date.now()
  let changed = false
  for (const [id, r] of Object.entries(map)) {
    if (r.fireAt <= now) {
      delete map[id]
      changed = true
    }
  }
  if (changed) await writeAll(map)
  return map
}

export async function getDepartureReminders(): Promise<ReminderMap> {
  return prune(await readAll())
}

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  let final = status
  if (status !== 'granted') {
    final = (await Notifications.requestPermissionsAsync()).status
  }
  if (final !== 'granted') return false

  // Train reminders ride the existing trip-alerts channel (high priority, no
  // need for a new channel just for this).
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trip-alerts', {
      name: 'Trip Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0891b2',
    })
  }
  return true
}

/**
 * Arm a reminder that fires REMINDER_LEAD_MINUTES before departure.
 * `secondsUntilDeparture` comes straight from the board countdown so the
 * fire time always matches what the rider sees ticking down.
 * Returns the stored reminder, or a failure reason: 'too-soon' when the
 * departure is already inside the lead window, 'denied' when the OS
 * notification permission is not granted.
 */
export type ReminderFailure = 'too-soon' | 'denied'

export async function setDepartureReminder(params: {
  scheduleId: string
  lineCode: string
  origin: string
  destination: string
  departTime: string
  secondsUntilDeparture: number
}): Promise<DepartureReminder | ReminderFailure> {
  const leadSeconds = REMINDER_LEAD_MINUTES * 60
  const fireInSeconds = Math.round(params.secondsUntilDeparture - leadSeconds)
  if (fireInSeconds <= 0) return 'too-soon'

  const ok = await ensurePermission()
  if (!ok) return 'denied'

  // Replace any existing reminder for this schedule first
  await cancelDepartureReminder(params.scheduleId)

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${params.lineCode} departs in ${REMINDER_LEAD_MINUTES} min`,
      body: `${params.origin} → ${params.destination} · leaves ${params.departTime}. Head to the platform.`,
      data: { screen: 'train', lineCode: params.lineCode },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: fireInSeconds,
      repeats: false,
      channelId: 'trip-alerts',
    },
  })

  const reminder: DepartureReminder = {
    scheduleId: params.scheduleId,
    notifId,
    lineCode: params.lineCode,
    origin: params.origin,
    destination: params.destination,
    departTime: params.departTime,
    fireAt: Date.now() + fireInSeconds * 1000,
  }

  const map = await readAll()
  map[params.scheduleId] = reminder
  await writeAll(map)
  return reminder
}

/**
 * Explain a reminder failure to the rider. 'denied' means the OS-level
 * notification permission is off (the in-app Settings toggle is a separate
 * preference and can't grant it) — deep-link to the system settings so they
 * can flip it without hunting.
 */
export function showReminderFailureAlert(failure: ReminderFailure): void {
  if (failure === 'too-soon') {
    Alert.alert(
      'Departure too close',
      `This train leaves within ${REMINDER_LEAD_MINUTES} minutes — too late for a ${REMINDER_LEAD_MINUTES}-minute heads-up. Pick a later departure.`,
    )
    return
  }
  Alert.alert(
    'Notifications are off',
    'Troski needs notification permission from your phone to remind you. Turn it on in system Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  )
}

export async function cancelDepartureReminder(scheduleId: string): Promise<void> {
  const map = await readAll()
  const existing = map[scheduleId]
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing.notifId)
    } catch {
      // already fired / unknown id — fine
    }
    delete map[scheduleId]
    await writeAll(map)
  }
}
