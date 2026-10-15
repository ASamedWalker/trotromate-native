import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Banknote, MessageCircleQuestionMark, TrafficCone, TriangleAlert, Sparkles, MessageCircle,
  MoreHorizontal, Image as ImageIcon, Play,
} from 'lucide-react-native'
import { font, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { TrustPill, postTrust, ageState, isTimeSensitive } from '@/components/pulse/PulseTrust'
import { ageLabel } from '@/lib/utils/freshness'
import { formatGHS } from '@/lib/utils/currency'
import { pulseKind, extractRoute, extractAmount, parseComposerFare } from '@/lib/utils/pulse-extract'
import { fetchBotAnswer, type BotAnswer } from '@/lib/services/pulse-bot'
import type { TalePost } from '@/lib/types'
import {
  AgeMeta, KindCircle, cardBase, META, PAD, stripHashtags, firstLine, shortAge,
} from '@/components/pulse/PulseBits'

// Structured Pulse cards (UX v2 Direction A). One trust pill top right (P1),
// an age state on every meta row (P2), no coin amounts on buttons (P3).

export interface CardActions {
  onComment: (postId: string) => void
  onMenu: (post: TalePost) => void
  onOpenImages: (post: TalePost, images: string[], index: number) => void
  onVideo: (post: TalePost) => void
  onFareReport: (from: string, to: string) => void
}

export function photoUrlsOf(post: TalePost): string[] {
  if (!post.image_url) return []
  return post.image_urls && post.image_urls.length > 0 ? post.image_urls : [post.image_url]
}

const isVideo = (p: TalePost) => p.media_type === 'video' && !!p.video_url

const outlineBtn = {
  height: 36, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#D6D3D1',
  backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center',
} as const

const wrap = { ...cardBase, padding: 14, marginHorizontal: PAD, marginTop: 10 } as const

// ── Shared bottom meta row: age · place, optional media link, comments, menu ──
function MetaRow({ post, actions, timeBound, right }: { post: TalePost; actions: CardActions; timeBound: boolean; right?: React.ReactNode }) {
  const urls = photoUrlsOf(post)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
      <View style={{ flex: 1 }}>
        <AgeMeta iso={post.created_at} extra={post.location_name || null} timeBound={timeBound} />
      </View>
      {isVideo(post) ? (
        <IconLink label="Play video" onPress={() => actions.onVideo(post)}><Play size={16} color={META} /></IconLink>
      ) : urls.length > 0 ? (
        <IconLink label="View photo" onPress={() => actions.onOpenImages(post, urls, 0)}><ImageIcon size={16} color={META} /></IconLink>
      ) : null}
      {right ?? (
        <IconLink
          label={post.comment_count > 0 ? `${post.comment_count} comments` : 'Comment'}
          onPress={() => actions.onComment(post.id)}
        >
          <MessageCircle size={16} color={META} />
          {post.comment_count > 0 ? <Text style={{ fontFamily: font.semibold, fontSize: 13, color: META }}>{post.comment_count}</Text> : null}
        </IconLink>
      )}
      <IconLink label="Post options" onPress={() => actions.onMenu(post)}><MoreHorizontal size={18} color={META} /></IconLink>
    </View>
  )
}

function IconLink({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minWidth: 32, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}
    >
      {children}
    </TouchableOpacity>
  )
}

function TitleRow({ icon, title, post, lines = 2 }: { icon?: React.ReactNode; title: string; post: TalePost; lines?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      {icon}
      <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 17, color: ui.text, marginTop: icon ? 4 : 0 }} numberOfLines={lines}>
        {title}
      </Text>
      <View style={{ marginTop: icon ? 6 : 2, maxWidth: '45%' }}>
        <TrustPill tier={postTrust(post)} />
      </View>
    </View>
  )
}

// ── Cards ──

export const PulsePostCard = React.memo(function PulsePostCard({ post, actions }: { post: TalePost; actions: CardActions }) {
  const kind = pulseKind(post)
  if (kind === 'fare') return <FareCard post={post} actions={actions} />
  if (kind === 'question') return <QuestionCard post={post} actions={actions} />
  const caption = stripHashtags(post.caption ?? '')
  if (kind === 'queue') {
    const title = firstLine(caption) || 'Queue update'
    const rest = caption.slice(caption.indexOf(title) + title.length).trim()
    return (
      <View style={wrap}>
        <TitleRow icon={<KindCircle bg="#FFF1EC"><TrafficCone size={18} color="#C2360F" /></KindCircle>} title={title} post={post} />
        {rest ? <Text style={{ fontFamily: font.regular, fontSize: 15, color: ui.text, marginTop: 6 }} numberOfLines={4}>{rest}</Text> : null}
        <MetaRow post={post} actions={actions} timeBound />
      </View>
    )
  }
  // A plain post (or a photo post opened from Earlier): text first, no headline.
  return (
    <View style={wrap}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 16, color: ui.text }} numberOfLines={8}>
          {caption || (photoUrlsOf(post).length ? 'Photo from the road' : isVideo(post) ? 'Video from the road' : '')}
        </Text>
        <View style={{ maxWidth: '45%' }}><TrustPill tier={postTrust(post)} /></View>
      </View>
      <MetaRow post={post} actions={actions} timeBound={false} />
    </View>
  )
})

function FareCard({ post, actions }: { post: TalePost; actions: CardActions }) {
  const caption = post.caption ?? ''
  const composed = parseComposerFare(caption)
  const route = composed ?? extractRoute(caption)
  const amount = composed ? composed.amount : extractAmount(caption)
  const note = stripHashtags(composed ? composed.note : caption)
  // Without both fields this is not a structured fare: show it as text.
  if (!route || amount == null) {
    return (
      <View style={wrap}>
        <TitleRow icon={<KindCircle bg="#ECFDF5"><Banknote size={18} color="#047857" /></KindCircle>} title={firstLine(caption) || 'Fare'} post={post} lines={4} />
        <MetaRow post={post} actions={actions} timeBound />
      </View>
    )
  }
  return (
    <View style={wrap}>
      <TitleRow
        icon={<KindCircle bg="#ECFDF5"><Banknote size={18} color="#047857" /></KindCircle>}
        title={`${route.from} → ${route.to}`}
        post={post}
      />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, marginTop: 6 }}>
        <HeroText size={32} style={{ color: ui.text, fontVariant: ['tabular-nums'] }}>{formatGHS(amount)}</HeroText>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: META }}>paid by a rider</Text>
      </View>
      {note ? <Text style={{ fontFamily: font.regular, fontSize: 15, color: ui.text, marginTop: 2 }} numberOfLines={3}>{note}</Text> : null}
      <MetaRow post={post} actions={actions} timeBound />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => actions.onFareReport(route.from, route.to)}
          accessibilityRole="button"
          accessibilityLabel={`I paid ${formatGHS(amount)} too. Report this fare`}
          style={{ ...outlineBtn, flex: 1, height: 48 }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ui.text }}>I paid this too</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => actions.onFareReport(route.from, route.to)}
          accessibilityRole="button"
          accessibilityLabel="I paid a different fare. Report it"
          style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ui.text }}>I paid different</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

/** Names what the bot answer rests on (P4). Only facts the endpoint returns. */
function botSources(bot: Extract<BotAnswer, { status: 'found' }>): string {
  const base = bot.verified ? 'from the official GPRTU fare' : 'from rider fare reports'
  const when = bot.updated && Number.isFinite(new Date(bot.updated).getTime()) ? ` · updated ${ageLabel(bot.updated)}` : ''
  return `Troski Bot · ${base}${when}`
}

function QuestionCard({ post, actions }: { post: TalePost; actions: CardActions }) {
  const caption = stripHashtags(post.caption ?? '')
  const [bot, setBot] = useState<BotAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBotAnswer(post.id).then((ans) => {
      if (cancelled) return
      setBot(ans)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [post.id])
  const found = bot && bot.status === 'found' ? bot : null
  const missed = !!bot && (bot.status === 'no_route' || bot.status === 'not_found')
  const route = extractRoute(post.caption ?? '') ?? (found ? { from: found.from, to: found.to } : null)

  return (
    <View style={wrap}>
      <TitleRow
        icon={<KindCircle bg="#F3EEFF"><MessageCircleQuestionMark size={18} color="#6D28D9" /></KindCircle>}
        title={caption || 'Question'}
        post={post}
        lines={4}
      />
      {route ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {[`From: ${route.from}`, `To: ${route.to}`].map((t) => (
            <View key={t} style={{ height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ui.text }} numberOfLines={1}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {loading ? (
        <View style={{ marginTop: 10, height: 44, borderRadius: 12, backgroundColor: '#F7F4FF' }} />
      ) : found ? (
        <View style={{ marginTop: 10, backgroundColor: '#F3EEFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Sparkles size={13} color="#6D28D9" />
            <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 12, color: '#6D28D9' }} numberOfLines={2}>{botSources(found)}</Text>
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 15, color: ui.text, marginTop: 4 }}>{found.text}</Text>
        </View>
      ) : missed ? (
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: META, marginTop: 6 }}>Troski Bot didn&apos;t know this one. Can you help?</Text>
      ) : null}
      <MetaRow
        post={post}
        actions={actions}
        timeBound={false}
        right={
          <TouchableOpacity
            onPress={() => actions.onComment(post.id)}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            accessibilityLabel={post.comment_count > 0 ? `Answer this question. ${post.comment_count} answers so far` : 'Answer this question'}
            style={outlineBtn}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: ui.text }}>
              {post.comment_count > 0 ? `Answer · ${post.comment_count}` : 'Answer'}
            </Text>
          </TouchableOpacity>
        }
      />
    </View>
  )
}

// ── Incident (incident_reports): no confirm/clear endpoint yet, so no buttons ──

export interface PulseIncident { id: string; location_name: string | null; incident_type: string; reported_at: string }

const INCIDENT_WORD: Record<string, string> = {
  // Same ids and meaning as app/report/incident.tsx INCIDENT_TYPES.
  traffic: 'Heavy traffic', accident: 'Accident', police_checkpoint: 'Police check',
  road_closure: 'Road closed', flooding: 'Hazard', breakdown: 'Road works',
}

export const PulseIncidentCard = React.memo(function PulseIncidentCard({ incident }: { incident: PulseIncident }) {
  const word = INCIDENT_WORD[incident.incident_type] ??
    (incident.incident_type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) || 'Problem')
  const title = incident.location_name ? `${word} near ${incident.location_name}` : word
  return (
    <View style={wrap} accessible accessibilityLabel={`${title}. Not confirmed yet. ${ageLabel(incident.reported_at)}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <KindCircle bg="#FEE2E2"><TriangleAlert size={18} color="#B91C1C" /></KindCircle>
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 17, color: ui.text, marginTop: 4 }} numberOfLines={3}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <TrustPill tier="unconfirmed" />
        <AgeMeta iso={incident.reported_at} />
      </View>
    </View>
  )
})

// ── Earlier: stale items, one line each; tap opens the full card ──

export const PulseEarlierRow = React.memo(function PulseEarlierRow({ post, onExpand }: { post: TalePost; onExpand: (id: string) => void }) {
  const kind = pulseKind(post)
  const timeBound = isTimeSensitive(kind)
  const composed = kind === 'fare' ? parseComposerFare(post.caption ?? '') : null
  const label = composed
    ? `${formatGHS(composed.amount)} · ${composed.from} → ${composed.to}`
    : firstLine(post.caption ?? '') || (kind === 'moment' ? 'Photo from the road' : 'Post')
  const age = `${shortAge(post.created_at)}${timeBound ? ' · may have changed' : ''}`
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onExpand(post.id)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${age}. Show more`}
      style={{ ...cardBase, marginHorizontal: PAD, marginTop: 6, opacity: 0.6, minHeight: 48, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 14, color: ui.text }} numberOfLines={1}>{label}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: META }} numberOfLines={1}>{age}</Text>
    </TouchableOpacity>
  )
})

// ── From the road: photo/video posts last, 120×90 placeholder until tapped (P10) ──

export const PulseRoadRow = React.memo(function PulseRoadRow({ post, actions }: { post: TalePost; actions: CardActions }) {
  const [loaded, setLoaded] = useState(false)
  const video = isVideo(post)
  const urls = photoUrlsOf(post)
  const thumb = video ? post.video_thumbnail_url : urls[0]
  const caption = stripHashtags(post.caption ?? '')
  const open = () => {
    setLoaded(true)
    if (video) actions.onVideo(post)
    else if (urls.length) actions.onOpenImages(post, urls, 0)
  }
  const hint = video
    ? `Tap to play${post.video_duration_secs ? ` · ${Math.floor(post.video_duration_secs / 60)}:${String(Math.floor(post.video_duration_secs % 60)).padStart(2, '0')}` : ''}`
    : urls.length > 1 ? `Tap to load ${urls.length} photos` : 'Tap to load photo'
  return (
    <View style={{ ...cardBase, marginHorizontal: PAD, marginTop: 6, padding: 10, flexDirection: 'row', gap: 12 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        accessibilityRole="imagebutton"
        accessibilityLabel={video ? 'Play video' : 'Load photo'}
        style={{ width: 120, height: 90, borderRadius: 10, overflow: 'hidden' }}
      >
        <LinearGradient colors={['#B8C4CC', '#8A9AA4']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loaded && thumb ? (
            <ExpoImage source={{ uri: thumb }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" cachePolicy="disk" />
          ) : video ? <Play size={22} color="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" /> : <ImageIcon size={22} color="rgba(255,255,255,0.9)" />}
        </LinearGradient>
        <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#FFFFFF' }}>{shortAge(post.created_at)}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <TrustPill tier={postTrust(post)} />
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: ui.text, marginTop: 4 }} numberOfLines={3}>
          {caption || (video ? 'Video from the road' : 'Photo from the road')}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: META, marginTop: 2 }}>{hint}</Text>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <IconLink label={post.comment_count > 0 ? `${post.comment_count} comments` : 'Comment'} onPress={() => actions.onComment(post.id)}>
            <MessageCircle size={16} color={META} />
            {post.comment_count > 0 ? <Text style={{ fontFamily: font.semibold, fontSize: 13, color: META }}>{post.comment_count}</Text> : null}
          </IconLink>
          <IconLink label="Post options" onPress={() => actions.onMenu(post)}><MoreHorizontal size={18} color={META} /></IconLink>
        </View>
      </View>
    </View>
  )
})

/** Whether a post belongs under Earlier (stale, P2) — moments go to From the road instead. */
export function isEarlier(post: TalePost): boolean {
  return ageState(post.created_at) === 'stale'
}
