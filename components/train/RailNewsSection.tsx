import React from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { ExternalLink, ShieldAlert, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import {
  MEDIA_REPORT_LABEL, RAIL_LINE_STATUS, RAIL_NEWS_KIND_LABEL, RAIL_SAFETY, latestRailNews, newsDateLabel,
  type RailNewsItem, type RailNewsKind,
} from '@/lib/constants/train-news'
import { RAIL_CONTACTS } from '@/lib/constants/train-schedule'

/**
 * Rail news + line status + safety notice for the Train tab and line pages.
 * Static curated data (lib/constants/train-news.ts) — no fetching, so it costs
 * no data and works offline. Titles/summaries are Troski's own words; only
 * official sources (GRDA/GRCL/MoT) are named, and a tap opens them. Rows with
 * no official link are not tappable. Core RN only (no reanimated in ScrollView).
 */

const BOARD = '#0C1220'
const INK = '#1C1917'
const MUTED = '#57534E'
const LINE = '#ECEAE7'

const KIND_COLORS: Record<RailNewsKind, { bg: string; fg: string }> = {
  disruption: { bg: '#FDE8E8', fg: '#B91C1C' },
  service: { bg: '#E8F1FD', fg: '#1D4ED8' },
  project: { bg: '#EFE9E3', fg: '#44403C' },
  safety: { bg: '#FFF3D6', fg: '#92400E' },
}

function openSource(url: string) {
  Linking.openURL(url).catch(() => {})
}

function NewsRow({ n, first }: { n: RailNewsItem; first: boolean }) {
  const k = KIND_COLORS[n.kind]
  const date = newsDateLabel(n.date, n.datePrecision)
  const url = n.url
  const sourceLabel = n.source ?? MEDIA_REPORT_LABEL
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={!url}
      onPress={() => url && openSource(url)}
      accessibilityRole={url ? 'link' : 'text'}
      accessibilityLabel={`${RAIL_NEWS_KIND_LABEL[n.kind]}, ${date}. ${n.title}. ${sourceLabel}.${url ? ' Opens in browser.' : ''}`}
      style={{ paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: LINE, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: k.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6, color: k.fg }}>
            {RAIL_NEWS_KIND_LABEL[n.kind].toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: MUTED }}>{date}</Text>
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 16, color: INK }}>{n.title}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#44403C' }}>{n.summary}</Text>
      {url ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#C2410C' }}>{sourceLabel}</Text>
          <ExternalLink size={13} color="#C2410C" />
        </View>
      ) : (
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: MUTED }}>{sourceLabel}</Text>
      )}
    </TouchableOpacity>
  )
}

/** Latest rail news (newest first). Pass lineCode for one line's items only. */
export function RailNewsList({ lineCode, limit = 4, title = 'Rail news' }: { lineCode?: string; limit?: number; title?: string }) {
  const items = latestRailNews(limit, lineCode)
  if (!items.length) return null
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: LINE, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: '#111111' }}>{title}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 4 }}>
        In our own words. Official sources open when tapped.
      </Text>
      {items.map((n, i) => <NewsRow key={n.id} n={n} first={i === 0} />)}
    </View>
  )
}

const STATE_DOT: Record<string, string> = {
  running: '#22C55E',
  'not-running': '#F87171',
  planned: 'rgba(255,255,255,0.45)',
}

/** Line status on the navy station-board look. Running lines link to their page. */
export function RailLineStatusCard({ lineIdByCode = {}, onOpenLine }: { lineIdByCode?: Record<string, string>; onOpenLine?: (lineId: string) => void }) {
  return (
    <View style={{ backgroundColor: BOARD, borderRadius: 20, padding: 18, gap: 2 }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.65)' }}>LINE STATUS</Text>
      {RAIL_LINE_STATUS.map((l, i) => {
        const id = l.lineCode ? lineIdByCode[l.lineCode] : undefined
        const tappable = !!(id && onOpenLine)
        return (
          <TouchableOpacity
            key={l.id}
            activeOpacity={0.7}
            disabled={!tappable}
            onPress={() => id && onOpenLine?.(id)}
            accessibilityRole={tappable ? 'button' : 'text'}
            accessibilityLabel={`${l.name}: ${l.stateLabel}. ${l.detail}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.08)' }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF', flexShrink: 1 }} numberOfLines={1}>{l.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: STATE_DOT[l.state] }} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{l.stateLabel}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: font.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {l.detail} · {l.source}
              </Text>
            </View>
            {tappable ? <ChevronRight size={16} color="rgba(255,255,255,0.4)" /> : null}
          </TouchableOpacity>
        )
      })}
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
        Running = a published timetable exists. Not live tracking.
      </Text>
    </View>
  )
}

/** Keep animals and people off the tracks + GRDA/GRCL contacts as plain text. */
export function RailSafetyCard() {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.5, borderColor: '#F5A300', padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={20} color="#B45309" />
        <Text style={{ fontFamily: font.extrabold, fontSize: 17, color: INK }}>{RAIL_SAFETY.title}</Text>
      </View>
      {RAIL_SAFETY.points.map((p) => (
        <View key={p} style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#B45309', marginTop: 9 }} />
          <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 15, color: '#44403C' }}>{p}</Text>
        </View>
      ))}
      <View style={{ borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, gap: 4 }}>
        {RAIL_CONTACTS.map((c) => (
          <Text key={c.org} selectable style={{ fontFamily: font.regular, fontSize: 13, color: MUTED }}>
            <Text style={{ fontFamily: font.bold, color: INK }}>{c.org}</Text> {c.phone} · {c.email}
          </Text>
        ))}
      </View>
    </View>
  )
}
