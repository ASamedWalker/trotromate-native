// Troski Bot answers for Pulse question posts. Returns null on any failure.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export type BotAnswer =
  | { status: 'not_a_question' }
  | { status: 'no_route'; text: string }
  | { status: 'not_found'; from: string; to: string; text: string }
  | {
      status: 'found'
      from: string
      to: string
      fare: number
      verified: boolean
      updated: string
      reversed: boolean
      text: string
    }

type CacheEntry = { value: BotAnswer | null; until: number }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<BotAnswer | null>>()
const FAIL_TTL_MS = 60_000
const MAX_CACHE = 200

function remember(postId: string, entry: CacheEntry) {
  cache.delete(postId)
  cache.set(postId, entry)
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function fetchBotAnswer(postId: string): Promise<BotAnswer | null> {
  const hit = cache.get(postId)
  if (hit && (hit.value || hit.until > Date.now())) return Promise.resolve(hit.value)
  const pending = inflight.get(postId)
  if (pending) return pending
  const p = request(postId)
    .then((value) => {
      remember(postId, { value, until: value ? Infinity : Date.now() + FAIL_TTL_MS })
      return value
    })
    .finally(() => inflight.delete(postId))
  inflight.set(postId, p)
  return p
}

async function request(postId: string): Promise<BotAnswer | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(
      `${API_URL}/api/tales/bot-answer?post_id=${encodeURIComponent(postId)}`,
      { signal: controller.signal },
    )
    if (!res.ok) return null
    const json = (await res.json()) as BotAnswer
    if (!json || typeof json.status !== 'string') return null
    return json
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
