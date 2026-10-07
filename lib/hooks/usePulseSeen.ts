import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// When the rider last opened the Pulse tab. The tab-bar dot shows only for post
// activity (likes, comments) newer than this, so opening Pulse clears it.
// Module-level store: one value shared by every consumer, persisted per device.
const KEY = '@troski_pulse_seen_v1'

let lastSeen = 0
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function load() {
  if (loaded) return
  loaded = true
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n > lastSeen) {
        lastSeen = n
        emit()
      }
    })
    .catch(() => {})
}

export function markPulseSeen() {
  lastSeen = Date.now()
  emit()
  AsyncStorage.setItem(KEY, String(lastSeen)).catch(() => {})
}

function subscribe(cb: () => void) {
  load()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function usePulseSeen(): number {
  return useSyncExternalStore(subscribe, () => lastSeen)
}
