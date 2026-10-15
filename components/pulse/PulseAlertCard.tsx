import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { TriangleAlert, ChevronDown } from 'lucide-react-native'
import { font, ui } from '@/lib/theme'
import { TrustPill } from '@/components/pulse/PulseTrust'
import { ageLabel } from '@/lib/utils/freshness'
import type { ServiceAlert } from '@/lib/hooks/useAlerts'
import { cardBase, META, PAD } from '@/components/pulse/PulseBits'

const SEEN_KEY = '@troski_pulse_alerts_seen_v1'
const BLUE = '#1D4ED8'

/** Short organisation code for the pill ("GPRTU Kaneshie branch" → "GPRTU"); none when the source has no acronym. */
function sourceCode(source: string): string | undefined {
  const first = source.trim().split(/\s+/)[0] ?? ''
  return /^[A-Z]{2,8}$/.test(first) ? first : undefined
}

async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Pinned official alerts (UX v2 P8): blue rule, plain body, "Posted N min ago · Source: X",
 * Official pill. Shown in full the first time; collapses to one line once seen.
 */
export function PulseAlerts({ alerts }: { alerts: ServiceAlert[] }) {
  // null = storage not read yet (render collapsed-free nothing to avoid a flash)
  const [seenAtLoad, setSeenAtLoad] = useState<Set<string> | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    readSeen().then((ids) => setSeenAtLoad(new Set(ids)))
  }, [])

  // Everything visible now counts as seen for the next visit.
  const ids = alerts.map((a) => a.id).join(',')
  useEffect(() => {
    if (!seenAtLoad || !ids) return
    readSeen().then((prev) => {
      const next = Array.from(new Set([...ids.split(','), ...prev])).slice(0, 50)
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {})
    })
  }, [ids, seenAtLoad])

  if (!seenAtLoad || alerts.length === 0) return null
  return (
    <View style={{ paddingHorizontal: PAD, marginTop: 12, gap: 8 }}>
      {alerts.slice(0, 3).map((a) => {
        const expanded = !seenAtLoad.has(a.id) || open.has(a.id)
        return (
          <AlertCardBody
            key={a.id}
            alert={a}
            expanded={expanded}
            onToggle={() => setOpen((prev) => {
              const n = new Set(prev)
              if (n.has(a.id)) n.delete(a.id)
              else n.add(a.id)
              return n
            })}
          />
        )
      })}
    </View>
  )
}

function AlertCardBody({ alert, expanded, onToggle }: { alert: ServiceAlert; expanded: boolean; onToggle: () => void }) {
  const posted = ageLabel(alert.starts_at || alert.created_at)
  const a11y = `Official alert: ${alert.title}. ${alert.body ?? ''} Posted ${posted}. Source: ${alert.source}`
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded }}
      style={{ ...cardBase, borderLeftWidth: 4, borderLeftColor: BLUE, paddingVertical: expanded ? 12 : 10, paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TriangleAlert size={18} color={BLUE} />
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: ui.text }} numberOfLines={expanded ? 2 : 1}>
          {alert.title}
        </Text>
        {!expanded ? <ChevronDown size={18} color={META} /> : null}
      </View>
      {expanded ? (
        <>
          {alert.body ? (
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: ui.text, marginTop: 4 }}>{alert.body}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 12, color: META }}>
              Posted {posted} · Source: {alert.source}
            </Text>
            <TrustPill tier="official" source={sourceCode(alert.source)} />
          </View>
        </>
      ) : null}
    </TouchableOpacity>
  )
}
