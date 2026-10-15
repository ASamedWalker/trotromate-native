/** Device-clock time strings (24 h, as on the UX v2 mockups). Work offline. */
const p2 = (n: number) => String(n).padStart(2, '0')

/** "14:10" */
export function hhmm(d: Date | string | number): string {
  const x = d instanceof Date ? d : new Date(d)
  return isNaN(x.getTime()) ? '' : `${p2(x.getHours())}:${p2(x.getMinutes())}`
}

/** "13:58:21" */
export function hhmmss(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}
