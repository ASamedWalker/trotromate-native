/**
 * copy of trotromate/lib/services/pulse-extract.ts — keep in sync
 */

export type PulseKind = "fare" | "question" | "queue" | "moment" | "post"

const STOP = "which|what|how|where|when|and|is|are|for|please|abeg|pls|today|this|now|but|so|because|y'?all|was|were|cost|costs|the fare|fare"
const PLACE = `([A-Za-z0-9][A-Za-z0-9'’ .\\-]{1,40}?)`
// The destination ends at punctuation, a sentence break (". "), an
// emoji/symbol, the end, or a stop word.
const ROUTE = new RegExp(`\\bfrom\\s+${PLACE}\\s+(?:to|-|→)\\s+${PLACE}(?=\\.(?:\\s|$)|\\s*(?:[^\\p{L}\\p{N}'’ .\\-]|$)|\\s+(?:${STOP})\\b)`, "iu")
const AMOUNT = /(?:(?:gh[s₵c]?|¢|₵)\s*(\d{1,4}(?:\.\d{1,2})?))|(?:(\d{1,4}(?:\.\d{1,2})?)\s*(?:gh[s₵c]?|cedis?|¢|₵)(?![a-z]))/i
const PAID = /\b(paid|pay|paying|charged|charge|fare)\b/i
const QUESTION = /\?|\b(which|how much|where do|what is the fare|can (?:you|someone|anyone)|help)\b/i

const tidy = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").replace(/(^|[\s\-(])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase())

/**
 * The app composer's own fare format: "Paid ₵{amount} from {From} to {To}"
 * with an optional note on the following line(s). The line break is the
 * delimiter, so place names may contain dots ("St. John's") safely.
 */
const COMPOSER_FARE = /^Paid ₵(\d{1,3}(?:\.\d{1,2})?) from (.+?) to ([^\n]+?)\.?[ \t]*(?:\n([\s\S]*))?$/

export function parseComposerFare(caption: string): { amount: number; from: string; to: string; note: string } | null {
  const m = caption.match(COMPOSER_FARE)
  if (!m) return null
  const from = m[2].trim(), to = m[3].trim()
  if (!from || !to) return null
  return { amount: Number(m[1]), from, to, note: (m[4] ?? "").trim() }
}

export function extractRoute(text: string): { from: string; to: string } | null {
  const m = text.match(ROUTE)
  if (!m) return null
  const from = tidy(m[1]), to = tidy(m[2])
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return null
  return { from, to }
}

export function extractAmount(text: string): number | null {
  const m = text.match(AMOUNT)
  const v = m ? Number(m[1] ?? m[2]) : NaN
  return Number.isFinite(v) && v > 0 && v < 1000 ? v : null
}

/** Kind for display. Stored post_type wins when it is specific. */
export function pulseKind(p: { post_type?: string | null; caption?: string | null; media_type?: string | null }): PulseKind {
  if (p.post_type === "fare" || p.post_type === "question" || p.post_type === "queue") return p.post_type
  const t = p.caption ?? ""
  if (QUESTION.test(t) && extractRoute(t)) return "question"
  if (PAID.test(t) && extractAmount(t) && extractRoute(t)) return "fare"
  if (p.media_type === "video" || p.media_type === "image") return "moment"
  // A bare "?" ("How's your Sunday?") is chat, not a transit question.
  if (QUESTION.test(t) && /\b(which|how much|where|fare|trotro|troski|station|route|help)\b/i.test(t)) return "question"
  return "post"
}
