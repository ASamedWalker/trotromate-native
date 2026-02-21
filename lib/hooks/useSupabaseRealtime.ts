import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type TableName = 'fare_reports' | 'queue_reports' | 'incident_reports' | 'tale_posts'

interface RealtimeEvent {
  table: TableName
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

interface UseRealtimeOptions {
  /** Tables to subscribe to */
  tables: TableName[]
  /** Optional filter: only events matching this route_id */
  routeId?: string
  /** Called when any subscribed table gets an INSERT */
  onInsert?: (event: RealtimeEvent) => void
  /** Called for any change */
  onChange?: (event: RealtimeEvent) => void
  /** Whether subscription is active */
  enabled?: boolean
}

/**
 * Subscribe to Supabase Realtime postgres_changes on specified tables.
 * Uses the singleton supabase client from lib/supabase/client.
 */
export function useSupabaseRealtime(options: UseRealtimeOptions) {
  const { tables, routeId, onInsert, onChange, enabled = true } = options
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onInsertRef = useRef(onInsert)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onInsertRef.current = onInsert
    onChangeRef.current = onChange
  }, [onInsert, onChange])

  useEffect(() => {
    if (!enabled || tables.length === 0) return

    const channelName = `live-${tables.join('-')}${routeId ? `-${routeId}` : ''}`

    let channel = supabase.channel(channelName)

    for (const table of tables) {
      const filter = routeId ? `route_id=eq.${routeId}` : undefined

      channel = channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const event: RealtimeEvent = {
            table,
            eventType: 'INSERT',
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          }
          onInsertRef.current?.(event)
          onChangeRef.current?.(event)
        }
      )
    }

    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [tables.join(','), routeId, enabled])
}

/**
 * Track new update count from realtime events.
 */
export function useNewUpdatesCount(tables: TableName[], routeId?: string) {
  const [count, setCount] = useState(0)

  const handleInsert = useCallback(() => {
    setCount((c) => c + 1)
  }, [])

  const clear = useCallback(() => setCount(0), [])

  useSupabaseRealtime({
    tables,
    routeId,
    onInsert: handleInsert,
  })

  return { count, clear }
}
