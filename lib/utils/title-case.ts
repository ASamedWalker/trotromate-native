// Display-only: capitalise the first letter of each word, keep existing capitals.
export function titleCase(s: string | null | undefined): string {
  return (s ?? '').replace(/(^|[\s(\-/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
