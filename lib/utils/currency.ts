/**
 * Ghana cedi display formatting — the ONLY currency in this app and the single
 * source of truth for how money reads (UX v2 canvas): "GH₵8.70" — symbol, NO
 * space, 2 decimals. Never render "$", "GHS" or a bare "₵" — Ghanaian users read GH₵.
 */
export function formatGHS(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}GH₵${Math.abs(amount).toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "GH₵15–25" / "GH₵3.50–5" — whole cedis drop the pesewas (Lines L7, okada ranges). */
export function formatGHSRange(min: number, max: number): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2))
  return `GH₵${n(min)}–${n(max)}`
}
