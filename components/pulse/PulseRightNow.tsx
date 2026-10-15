import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, type Href } from 'expo-router'
import { font, ui } from '@/lib/theme'
import { useStations } from '@/lib/hooks/useStations'
import { useLocation } from '@/lib/hooks/useLocation'
import { useLatestQueueReport } from '@/lib/hooks/useStationDetail'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { haversineKm } from '@/lib/utils/distance'
import { freshness } from '@/lib/utils/freshness'
import type { StationWithQueue, QueueStatus } from '@/lib/services/stations'
import { AgeMeta, QueuePill, SectionTitle, cardBase, META, PAD } from '@/components/pulse/PulseBits'

const NEAR_KM = 3

type Source = 'saved' | 'near' | 'latest'
export interface PulseStation { station: StationWithQueue; source: Source }

/** Read-only: the rider's saved routes and commutes (AsyncStorage), for "saved first". */
function useSavedPlaceNames(): string[] {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    Promise.all([
      AsyncStorage.getItem('troski-favorite-routes').catch(() => null),
      AsyncStorage.getItem('troski-my-commutes').catch(() => null),
    ]).then((raws) => {
      const out: string[] = []
      for (const raw of raws) {
        try {
          const list = raw ? JSON.parse(raw) : []
          if (Array.isArray(list)) for (const r of list) {
            if (typeof r?.from === 'string') out.push(r.from)
            if (typeof r?.to === 'string') out.push(r.to)
          }
        } catch { /* ignore a bad entry */ }
      }
      if (alive) setNames(out.map((n) => n.trim().toLowerCase()).filter(Boolean))
    })
    return () => { alive = false }
  }, [])
  return names
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Up to 3 stations for the "Right now" strip: saved first, then nearest (≤3 km).
 * With neither, the stations with the newest live reports. `focusId` pins a station first.
 */
export function usePulseStations(focusId: string | null) {
  const { stations } = useStations()
  const { location } = useLocation()
  const saved = useSavedPlaceNames()

  return useMemo(() => {
    const picked: PulseStation[] = []
    const seen = new Set<string>()
    const add = (s: StationWithQueue, source: Source) => {
      if (seen.has(s.id) || picked.length >= 5) return
      seen.add(s.id)
      picked.push({ station: s, source })
    }
    const focus = focusId ? stations.find((s) => s.id === focusId) : undefined
    if (focus) add(focus, 'saved')
    if (saved.length) {
      for (const s of stations) {
        const n = norm(s.name)
        if (saved.some((p) => p === n || n.startsWith(p) || p.startsWith(n))) add(s, 'saved')
      }
    }
    if (location) {
      stations
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ s, km: haversineKm(location.latitude, location.longitude, s.latitude!, s.longitude!) }))
        .filter((x) => x.km <= NEAR_KM)
        .sort((a, b) => a.km - b.km)
        .forEach((x) => add(x.s, 'near'))
    }
    const known = picked.length > 0
    if (!known) {
      stations
        .filter((s) => s.queue_stats?.[0] && freshness(s.queue_stats[0].last_report_at) !== 'stale')
        .sort((a, b) => new Date(b.queue_stats![0].last_report_at).getTime() - new Date(a.queue_stats![0].last_report_at).getTime())
        .forEach((s) => add(s, 'latest'))
    }
    return { candidates: picked, known, place: known ? picked[0].station : null, saved }
  }, [stations, location, saved, focusId])
}

export function PulseRightNow({ rows, known }: { rows: PulseStation[]; known: boolean }) {
  const { isAuthenticated } = useAuthContext()
  const shown = rows.slice(0, 3)
  if (shown.length === 0) return null
  // "Still like this?" sits on the first station with a live report (mockup: one prompt, not three).
  const promptId = shown.find((r) => statusOf(r.station).status)?.station.id
  // All quiet: one compact card instead of identical "No recent report" rows.
  if (!promptId) return <NoReportsCard station={shown[0].station} />
  return (
    <View style={{ paddingHorizontal: PAD, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle>Right now</SectionTitle>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: META }}>
          {known ? `${shown.length} ${shown.length === 1 ? 'station' : 'stations'}` : 'Latest reports'}
        </Text>
      </View>
      <View style={{ ...cardBase, marginTop: 6 }}>
        {shown.map((r, i) => (
          <StationRow
            key={r.station.id}
            station={r.station}
            first={i === 0}
            showPrompt={r.station.id === promptId}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </View>
    </View>
  )
}

function NoReportsCard({ station }: { station: StationWithQueue }) {
  const router = useRouter()
  return (
    <View style={{ paddingHorizontal: PAD, marginTop: 14 }}>
      <SectionTitle>Right now</SectionTitle>
      <View style={{ ...cardBase, marginTop: 6, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: META }}>
          No queue reports near {station.name} in the last 2 hours
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/report/queue', params: { station_id: station.id, station_name: station.name } } as unknown as Href)}
          accessibilityRole="button"
          accessibilityLabel={`Report the queue at ${station.name}`}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#C2360F' }}>Report queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function statusOf(s: StationWithQueue): { status: QueueStatus | null; at: string | null; waitMins: number | null } {
  const st = s.queue_stats?.[0]
  if (!st || freshness(st.last_report_at) === 'stale') return { status: null, at: null, waitMins: null }
  return { status: st.current_status, at: st.last_report_at, waitMins: st.avg_wait_mins }
}

const StationRow = React.memo(function StationRow({
  station, first, showPrompt, isAuthenticated,
}: { station: StationWithQueue; first: boolean; showPrompt: boolean; isAuthenticated: boolean }) {
  const router = useRouter()
  const haptics = useHaptics()
  const { status, at, waitMins } = statusOf(station)
  const { latestFresh, confirmations, confirm } = useLatestQueueReport(station.id, station.name, !!status)
  const count = latestFresh ? confirmations.data ?? 0 : 0

  const reportChanged = () => {
    haptics.light()
    router.push({ pathname: '/report/queue', params: { station_id: station.id, station_name: station.name } } as unknown as Href)
  }
  // Only real numbers: the wait shows when reports carry one, never a guess from the status.
  const wait = waitMins != null && waitMins > 0 ? `~${Math.round(waitMins)} min wait` : null
  const extra = [wait, count > 0 ? `confirmed by ${count}` : null].filter(Boolean).join(' · ') || null

  return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: '#F0EFED' }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/stations/${station.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${station.name}. ${status ? `Queue ${status.replace('_', ' ')}` : 'No recent report'}. Open station`}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: ui.text }} numberOfLines={1}>{station.name}</Text>
          <QueuePill status={status} />
        </View>
        {status ? (
          <View style={{ marginTop: 2 }}><AgeMeta iso={at} extra={extra} /></View>
        ) : (
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: META, marginTop: 2 }}>Be the first to say how the queue looks.</Text>
        )}
      </TouchableOpacity>

      {showPrompt && latestFresh ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Text style={{ flexGrow: 1, flexShrink: 1, fontFamily: font.semibold, fontSize: 14, color: ui.text }}>
            {confirm.isSuccess ? 'Thanks, confirmed' : confirm.isError ? 'Could not confirm' : 'Still like this?'}
          </Text>
          {!isAuthenticated ? (
            <Btn label="Sign in to confirm" tone="soft" onPress={() => router.push('/auth/phone' as Href)} />
          ) : confirm.isSuccess ? null : (
            <>
              <Btn
                label="Yes, still"
                tone="dark"
                disabled={confirm.isPending}
                onPress={() => { haptics.light(); confirm.mutate() }}
              />
              <Btn label="No, it changed" tone="soft" onPress={reportChanged} />
            </>
          )}
        </View>
      ) : !status ? (
        <TouchableOpacity onPress={reportChanged} accessibilityRole="button" accessibilityLabel={`Report the queue at ${station.name}`} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#C2360F' }}>Report queue</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
})

function Btn({ label, tone, onPress, disabled }: { label: string; tone: 'dark' | 'soft'; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={{
        height: 36, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: tone === 'dark' ? '#0A0A0A' : '#F3F4F6', opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: tone === 'dark' ? '#FFFFFF' : ui.text }}>{label}</Text>
    </TouchableOpacity>
  )
}
