import { supabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Shared, reference-counted Realtime channels for corridor position
 * broadcasts (`gps:trip:{routeId}`).
 *
 * Supabase tracks topic subscriptions per socket: if the GO-Mode producer
 * and a watching screen each create their own channel on the same topic,
 * removing either one sends phx_leave and silently kills the other's
 * subscription. One channel per topic, shared by everyone, fixes the
 * whole hazard class. self:true so same-device rider/watcher cases work.
 */

type PosListener = (payload: Record<string, unknown>) => void

interface Entry {
  channel: RealtimeChannel
  refs: number
  listeners: Set<PosListener>
}

const entries = new Map<string, Entry>()

function topicFor(routeId: string) {
  return `gps:trip:${routeId}`
}

/** Take a reference. Pass a listener to receive 'pos' broadcasts. */
export function acquireTripChannel(routeId: string, listener?: PosListener): RealtimeChannel {
  const topic = topicFor(routeId)
  let entry = entries.get(topic)
  if (!entry) {
    const listeners = new Set<PosListener>()
    const channel = supabase
      .channel(topic, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        if (!payload) return
        listeners.forEach((l) => {
          try { l(payload) } catch { /* listener errors stay local */ }
        })
      })
    // First join can time out on a cold socket — supabase-js auto-rejoins
    channel.subscribe()
    entry = { channel, refs: 0, listeners }
    entries.set(topic, entry)
  }
  entry.refs++
  if (listener) entry.listeners.add(listener)
  return entry.channel
}

/** Drop a reference; the channel closes when the last holder releases. */
export function releaseTripChannel(routeId: string, listener?: PosListener) {
  const topic = topicFor(routeId)
  const entry = entries.get(topic)
  if (!entry) return
  if (listener) entry.listeners.delete(listener)
  entry.refs--
  if (entry.refs <= 0) {
    entries.delete(topic)
    Promise.resolve(supabase.removeChannel(entry.channel)).catch(() => {})
  }
}
