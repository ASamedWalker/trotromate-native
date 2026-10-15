import React from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Bell, BellRing } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { AdinkraAccent } from '@/components/AdinkraAccent'
import { LINE_META, toMinutes } from '@/lib/utils/train-stations'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { REMINDER_LEAD_MINUTES, showReminderFailureAlert } from '@/lib/services/trainReminders'
import {
  BOARD_NAVY, BigCountdown, TimetableChips, WEEKDAY_NAMES, departuresBoard, type DepartureRow,
} from '@/components/train/trainTime'

/** Seconds from this instant to a row's departure (recomputed at tap time). */
function secondsUntil(row: DepartureRow, dayOffset: number): number {
  const n = new Date()
  const nowSec = n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds()
  return dayOffset * 86400 + toMinutes(row.depart) * 60 - nowSec
}

/**
 * Next-train card (Troski UX v2, Train "Proposed", decisions T1–T3, T7). Used by
 * BOTH Train layouts (store RELEASE_MODE and full). Navy board: line kicker,
 * route, one countdown that never shows seconds, one "Timetable" chip, and a
 * white "Remind me" button. The reminder offers the first train outside the
 * 15-minute lead (same route first). Timetable only — never live, never booking.
 */
export function ReleaseTrainTop({ now }: { now: Date }) {
  const { width } = useWindowDimensions()
  const { isSet, toggle } = useDepartureReminders()

  const board = departuresBoard(now)
  const upcoming = board.rows.filter((r) => !r.departed)
  const next = upcoming[0]
  if (!next) return null

  const lead = REMINDER_LEAD_MINUTES
  const sameRoute = (r: DepartureRow) => r.origin === next.origin && r.destination === next.destination
  const target =
    upcoming.find((r) => r.remainingMin > lead && sameRoute(r)) ??
    upcoming.find((r) => r.remainingMin > lead) ??
    null
  // A train already armed (e.g. the hero, now inside the lead) stays visible so it can be cancelled.
  const armedRow = upcoming.find((r) => isSet(r.schedule.id) && r.remainingMin > 0)
  const remindRow = armedRow ?? target
  const armed = remindRow ? isSet(remindRow.schedule.id) : false

  const remind = async () => {
    if (!remindRow) return
    Haptics.selectionAsync()
    const { on, failure } = await toggle({
      scheduleId: remindRow.schedule.id,
      lineCode: remindRow.schedule.code,
      origin: remindRow.origin,
      destination: remindRow.destination,
      departTime: remindRow.depart,
      secondsUntilDeparture: secondsUntil(remindRow, board.offset),
    })
    if (failure) showReminderFailureAlert(failure)
    else if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const lineName = (LINE_META[next.lineCode]?.name ?? next.lineCode).replace(/ – /g, '–')
  const today = board.offset === 0
  const dayWord = board.offset === 1 ? 'Tomorrow' : WEEKDAY_NAMES[(now.getUTCDay() + board.offset) % 7]
  const remindSuffix = remindRow && !sameRoute(remindRow) ? ` to ${remindRow.destination}` : ''
  const remindLabel = armed
    ? `Reminder set · ${lead} min before the ${remindRow!.depart}`
    : `Remind me before the ${remindRow?.depart ?? ''}${remindSuffix}`

  return (
    <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: BOARD_NAVY, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, overflow: 'hidden' }}>
      <AdinkraWallpaper width={width - 40} height={360} size={28} color="rgba(255,255,255,0.075)" />
      {/* One larger Adinkrahene (greatness) rising off the top-right corner, above the faint pattern. */}
      <AdinkraAccent symbol="adinkrahene" size={120} color="#FFFFFF" opacity={0.08} position="topRight" inset={-34} />
      <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>
        {today ? `NEXT TRAIN · ${lineName.toUpperCase()} LINE` : `${lineName.toUpperCase()} LINE`}
      </Text>

      {today ? (
        <>
          <HeroText size={20} style={{ color: '#FFFFFF', marginTop: 2 }} numberOfLines={2}>
            {next.origin} → {next.destination}
          </HeroText>
          <BigCountdown minutes={next.remainingMin} departTime={next.depart} />
        </>
      ) : (
        <>
          {/* Sunday / after the last train: name the next service day honestly. */}
          <HeroText size={20} style={{ color: '#FFFFFF', marginTop: 2 }}>
            {board.noServiceToday ? `No trains on ${WEEKDAY_NAMES[now.getUTCDay()]}` : 'No more trains today'}
          </HeroText>
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>
            Next: {dayWord} {next.depart} from {next.origin}
          </Text>
        </>
      )}

      <TimetableChips />

      {remindRow ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={remind}
          accessibilityRole="button"
          accessibilityState={{ selected: armed }}
          accessibilityLabel={
            armed
              ? `Reminder set for the ${remindRow.depart} from ${remindRow.origin}. Tap to cancel`
              : `Remind me ${lead} minutes before the ${remindRow.depart} from ${remindRow.origin} to ${remindRow.destination}`
          }
          style={{ marginTop: 14, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}
        >
          {armed ? <BellRing size={18} color={BOARD_NAVY} /> : <Bell size={18} color={BOARD_NAVY} />}
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: BOARD_NAVY, flexShrink: 1 }} numberOfLines={1}>
            {remindLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
