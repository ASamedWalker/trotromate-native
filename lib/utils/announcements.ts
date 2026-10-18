// Which official_announcements rows may be shown (notifications + bulletin).
// Fare truth applies here too: a notice "from" GPRTU, GRDA, MoT etc. needs a
// link to that body's own publication, and nothing stays up forever.

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Sources that speak for a public body; their notices must link to it. */
const OFFICIAL_SOURCES = new Set(['GPRTU', 'GRDA', 'GRA', 'MMTL', 'MOT'])

export interface AnnouncementLike {
  source?: string | null
  published_at: string
  expires_at?: string | null
  attachment_url?: string | null
}

export function isShowableAnnouncement(a: AnnouncementLike, now: number = Date.now()): boolean {
  const published = new Date(a.published_at).getTime()
  if (Number.isNaN(published) || published > now) return false
  if (a.expires_at) {
    if (new Date(a.expires_at).getTime() < now) return false
  } else if (now - published > MAX_AGE_MS) {
    return false
  }
  const source = (a.source || 'TROSKI').toUpperCase()
  if (OFFICIAL_SOURCES.has(source) && !/^https:\/\//i.test(a.attachment_url ?? '')) return false
  return true
}

/** "GPRTU: New fare chart"; Troski's own notices need no prefix. */
export function announcementTitle(source: string | null | undefined, title: string): string {
  const s = (source || 'TROSKI').toUpperCase()
  return s === 'TROSKI' ? title : `${s}: ${title}`
}
