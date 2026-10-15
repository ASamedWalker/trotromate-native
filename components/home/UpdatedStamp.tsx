import { useEffect, useState } from 'react'
import { Text, type TextStyle } from 'react-native'
import { useIsFetching, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { font } from '@/lib/theme'

/** Newest successful fetch time across the given query keys (prefix match), 0 if none yet. */
export function useLastUpdated(keys: QueryKey[]): number {
  const qc = useQueryClient()
  // Re-render when one of these queries starts/ends a fetch, and once a minute so the age keeps counting.
  useIsFetching({ predicate: (q) => keys.some((k) => k.every((part, i) => q.queryKey[i] === part)) })
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  let latest = 0
  for (const queryKey of keys) {
    for (const query of qc.getQueryCache().findAll({ queryKey })) {
      latest = Math.max(latest, query.state.dataUpdatedAt)
    }
  }
  return latest
}

export function updatedLabel(at: number, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - at) / 60000))
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Updated ${hours} h ago`
  return 'Updated over a day ago'
}

/** "Updated 2 min ago" — from the last successful refresh of Home's data (UX v2 H4). */
export function UpdatedStamp({ keys, style }: { keys: QueryKey[]; style?: TextStyle }) {
  const at = useLastUpdated(keys)
  if (!at) return null
  return (
    <Text style={[{ fontFamily: font.medium, fontSize: 12 }, style]} numberOfLines={1}>
      {updatedLabel(at)}
    </Text>
  )
}
