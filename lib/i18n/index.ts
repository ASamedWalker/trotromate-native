import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { STRINGS, LANGUAGES, type LangCode } from './strings'

/**
 * Minimal i18n — no external deps. A module-level store holds the current
 * language (persisted), `t(key)` looks it up with English fallback, and
 * `useLanguage()` re-renders consumers on change. SCAFFOLD: wire screens to
 * `t()` incrementally; untranslated keys safely show English.
 */
const STORE_KEY = '@troski_language_v1'

let current: LangCode = 'en'
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }

export async function loadLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORE_KEY)
    if (saved && saved in STRINGS) { current = saved as LangCode; emit() }
  } catch { /* default en */ }
}

export async function setLanguage(code: LangCode): Promise<void> {
  current = code
  emit()
  try { await AsyncStorage.setItem(STORE_KEY, code) } catch { /* ignore */ }
}

export function getLanguage(): LangCode { return current }

/** Translate a key. Falls back to English, then the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

/** Hook: returns { t, lang, setLanguage, languages } and re-renders on change. */
export function useLanguage() {
  const lang = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
  return { t, lang, setLanguage, languages: LANGUAGES }
}
