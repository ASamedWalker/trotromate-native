/**
 * Ghana cedi display formatting — the ONLY currency in this app.
 * Matches the Route screens' "GH₵ 8.00" style (symbol, space, 2 decimals).
 * Never render "$" or "GHS" — Ghanaian users read GH₵.
 */
export function formatGHS(amount: number): string {
  return `GH₵ ${amount.toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
