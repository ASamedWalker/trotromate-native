import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Bell, BellRing, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { nextDepartures, formatRemaining, LINE_COLORS } from '@/lib/utils/train-stations'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { REMINDER_LEAD_MINUTES, showReminderFailureAlert } from '@/lib/services/trainReminders'

const BOARD = '#0C1220'

/**
 * Store-release Train top (redesign): the next departure as one big countdown (real
 * GRDA timetable, so a countdown is honest here — unlike trotros), a "Remind me"
 * button, then every line's next departure. Info only: no booking.
 */
export function ReleaseTrainTop({ lineIdByCode }: { lineIdByCode: Record<string, string> }) {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const { isSet, toggle } = useDepartureReminders()

  const deps = nextDepartures(now)
  const next = deps[0]
  if (!next) return null
  const mins = next.remainingMinutes ?? 0
  const key = `${next.lineCode}:${next.runCode}:${next.departTime}`
  const armed = isSet(key)
  const canRemind = next.offset === 0 && mins > REMINDER_LEAD_MINUTES

  const remind = async () => {
    Haptics.selectionAsync()
    const { on, failure } = await toggle({
      scheduleId: key,
      lineCode: next.lineCode,
      origin: next.origin,
      destination: next.destination,
      departTime: next.departTime,
      secondsUntilDeparture: mins * 60,
    })
    if (failure) showReminderFailureAlert(failure)
    else if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16, gap: 14 }}>
      {/* Next departure */}
      <View style={{ backgroundColor: BOARD, borderRadius: 20, padding: 20, overflow: 'hidden' }}>
        <AdinkraWallpaper width={width - 40} height={320} size={28} color="rgba(255,255,255,0.06)" />
        <Text style={{ fontFamily: font.extrabold, fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.65)' }}>
          NEXT DEPARTURE · {next.lineName.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: font.extrabold, fontSize: 20, color: '#FFFFFF', marginTop: 6 }} numberOfLines={2}>
          {next.origin} → {next.destination}
        </Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }}
          accessible
          accessibilityLabel={next.offset === 0 ? `Departs in ${formatRemaining(mins)}, at ${next.departTime}` : `${next.when} at ${next.departTime}`}
        >
          {next.offset === 0 && mins < 60 ? (
            <>
              <HeroText size={56} style={{ color: '#FFFFFF' }}>{mins}</HeroText>
              <Text style={{ fontFamily: font.medium, fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>min · departs {next.departTime}</Text>
            </>
          ) : (
            <>
              <HeroText size={40} style={{ color: '#FFFFFF' }}>{next.offset === 0 ? formatRemaining(mins) : next.when}</HeroText>
              <Text style={{ fontFamily: font.medium, fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>· departs {next.departTime}</Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 12, color: '#FFFFFF' }}>SCHEDULED</Text>
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>GRDA timetable · {next.fareLabel}</Text>
        </View>
        {canRemind ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={remind}
            accessibilityRole="button"
            accessibilityState={{ selected: armed }}
            accessibilityLabel={armed ? 'Reminder set. Tap to cancel' : `Remind me ${REMINDER_LEAD_MINUTES} minutes before departure`}
            style={{ marginTop: 14, height: 46, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {armed ? <BellRing size={16} color={BOARD} /> : <Bell size={16} color={BOARD} />}
            <Text style={{ fontFamily: font.extrabold, fontSize: 14, color: BOARD }}>
              {armed ? `Reminder set · ${REMINDER_LEAD_MINUTES} min before` : `Remind me ${REMINDER_LEAD_MINUTES} min before`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* All lines */}
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#ECEAE7', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: '#111111', marginBottom: 4 }}>All lines</Text>
        {deps.map((d, i) => {
          const color = LINE_COLORS[d.lineCode]?.main ?? '#334155'
          const today = d.offset === 0
          const id = lineIdByCode[d.lineCode]
          return (
            <TouchableOpacity
              key={d.lineCode}
              activeOpacity={0.7}
              disabled={!id}
              onPress={() => id && router.push({ pathname: '/train/[lineId]', params: { lineId: id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`${d.lineName}, ${d.origin} to ${d.destination}, next ${today ? `in ${formatRemaining(d.remainingMinutes ?? 0)}` : d.when} at ${d.departTime}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#ECEAE7' }}
            >
              <View style={{ backgroundColor: color, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: '#FFFFFF' }}>{d.lineCode}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#111111' }} numberOfLines={1}>{d.origin} → {d.destination}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#5F6670' }}>Scheduled · next {today ? '' : `${d.when} `}{d.departTime}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <HeroText size={22} style={{ color: '#111111' }}>{today ? formatRemaining(d.remainingMinutes ?? 0) : '—'}</HeroText>
              </View>
              {id ? <ChevronRight size={16} color="#9CA3AF" /> : null}
            </TouchableOpacity>
          )
        })}
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#5F6670' }}>
        Fares are GRDA station prices, paid at the station. Troski does not sell train tickets.
      </Text>
    </View>
  )
}
