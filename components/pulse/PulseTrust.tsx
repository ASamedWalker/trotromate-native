import { View, Text } from 'react-native'
import { BadgeCheck, Megaphone, User, CircleDashed } from 'lucide-react-native'
import { font } from '@/lib/theme'
import type { TalePost } from '@/lib/types'
import type { PulseKind } from '@/lib/utils/pulse-extract'

// ── Trust (UX v2 P1): exactly one pill, top right of every Pulse card ──
// Tiers we can derive from data today. "Troski reporter" (needs a reporter flag on
// profiles) and "Confirmed by N" (no confirmations on tale posts) are not shown yet.
export type TrustTier = 'official' | 'team' | 'rider' | 'unconfirmed'

/** The Troski account's device id (md5 "troski-official"). Same constant as the web's lib/types/tales.ts. */
export const TROSKI_OFFICIAL_DEVICE_ID = 'e2ba385bb2d7c69ca654761206cfd461'

/**
 * A post from the Troski account. Device ids are public, so the id alone is not
 * enough: user-made posts get auth_user_id from the tale_posts_owner trigger and
 * only server-made posts have none (mirrors the web's isOfficialTale).
 */
export function isTroskiTeamPost(post: Pick<TalePost, 'device_id' | 'auth_user_id'>): boolean {
  return post.device_id === TROSKI_OFFICIAL_DEVICE_ID && !post.auth_user_id
}

export function postTrust(post: Pick<TalePost, 'device_id' | 'auth_user_id' | 'is_anonymous'>): TrustTier {
  if (isTroskiTeamPost(post)) return 'team'
  // An anonymous post has nobody standing behind it yet.
  if (post.is_anonymous) return 'unconfirmed'
  return 'rider'
}

const TIER_STYLE: Record<TrustTier, { bg: string; fg: string; border?: string }> = {
  official: { bg: '#E6EEFF', fg: '#1E3A8A' },
  team: { bg: '#FFF1EC', fg: '#B4320B' },
  rider: { bg: '#F3F1EF', fg: '#44403C' },
  unconfirmed: { bg: '#FFFFFF', fg: '#57534E', border: '#D6D3D1' },
}

export function TrustPill({ tier, source }: { tier: TrustTier; source?: string }) {
  const st = TIER_STYLE[tier]
  const label =
    tier === 'official' ? `Official${source ? ` · ${source}` : ''}`
      : tier === 'team' ? 'Troski team'
        : tier === 'rider' ? 'Rider'
          : 'Unconfirmed'
  const Icon = tier === 'official' ? BadgeCheck : tier === 'team' ? Megaphone : tier === 'rider' ? User : CircleDashed
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
        backgroundColor: st.bg, borderWidth: st.border ? 1 : 0, borderColor: st.border,
      }}
    >
      <Icon size={13} color={st.fg} />
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: st.fg, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </View>
  )
}

// ── Age state (UX v2 P2): on every card's meta row. Relative time only. ──
export type AgeState = 'live' | 'recent' | 'ageing' | 'stale'

const MIN = 60 * 1000

export function ageState(createdAt: string | null | undefined, now: number = Date.now()): AgeState {
  if (!createdAt) return 'stale'
  const age = now - new Date(createdAt).getTime()
  if (!Number.isFinite(age)) return 'stale'
  if (age < 15 * MIN) return 'live'
  if (age < 60 * MIN) return 'recent'
  if (age < 120 * MIN) return 'ageing'
  return 'stale'
}

/** Kinds whose content goes out of date (a queue or a fare is a moment-in-time fact). */
export function isTimeSensitive(kind: PulseKind): boolean {
  return kind === 'queue' || kind === 'fare'
}

export const LIVE_GREEN = '#15803D'

/** Small green dot for "Live · under 15 min". Never animated: crowd posts are not a live feed. */
export function LiveDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_GREEN }} accessibilityElementsHidden importantForAccessibility="no" />
}
