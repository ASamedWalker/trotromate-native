import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Modal } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Users, Banknote, HeartOff, WifiOff } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, ui } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { HeroText } from '@/components/HeroText'
import { QueueGlyph } from '@/components/QueueGlyph'
import { queueA11y } from '@/components/QueueStatusLine'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { corridorFor } from '@/lib/constants/corridors'
import { PressableScale } from '@/components/motion/PressableScale'
import { EnterIn } from '@/components/motion/EnterIn'
import { FlashOnChange } from '@/components/motion/FlashOnChange'
import { AdinkraCardPattern } from '@/components/AdinkraAccent'
import type { QueueStatus } from '@/lib/services/stations'
import { useLanguage } from '@/lib/i18n'
import { ageT, queueWordT } from '@/lib/i18n/home-format'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
const MAX_ROUTES = 3
// One faint symbol per line block (by position), so three saved lines don't look stamped.

export type CommuteVariant = 'morning' | 'afternoon'

// Same shape as the web's describeCommute (trotromate lib/services/commute-card.ts),
// which also writes the 05:45 / 16:30 push, so the card and the push always agree.
export interface CommuteInfo {
  routeId: string
  from: string
  to: string
  fare: { amount: number; source: 'gprtu' | 'reported' } | null
  queue: { station: string; status: QueueStatus; label: string; reportedAt: string; reportId?: string; confirmations?: number } | null
  alert?: { id: string; title: string; severity: string; source: string } | null
}

interface CommuteResponse {
  variant: CommuteVariant
  items: CommuteInfo[]
}

// Ghana is UTC+0: before noon riders head out, after noon they head home (same rule as the push)
export function currentVariant(): CommuteVariant {
  return new Date().getUTCHours() < 12 ? 'morning' : 'afternoon'
}

async function fetchCommute(ids: string[], variant: CommuteVariant): Promise<CommuteResponse> {
  // ids sorted so the CDN cache is shared regardless of saved order (the card keeps its own order)
  const res = await fetch(`${API_URL}/api/commute?variant=${variant}&ids=${ids.map(encodeURIComponent).join(',')}`)
  if (!res.ok) throw new Error(`commute ${res.status}`)
  return res.json()
}

/** Saved routes + their live card data. Shared by the line blocks and Home's Work/Home chips. */
export function useCommute() {
  const { favorites, isLoaded, reload, toggleFavorite } = useFavorites()
  // Home stays mounted; pick up hearts tapped on a route page
  useFocusEffect(useCallback(() => { reload() }, [reload]))
  const saved = favorites.slice(0, MAX_ROUTES)
  const ids = saved.map((f) => f.id).sort()
  const variant = currentVariant()
  const q = useQuery({
    queryKey: ['home-commute', variant, ids.join(',')],
    queryFn: () => fetchCommute(ids, variant),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    retry: 1,
  })
  const infoById = new Map((q.data?.items ?? []).map((i) => [i.routeId, i]))
  return { saved, isLoaded, variant, q, infoById, toggleFavorite }
}

// Launch corridors offered on the empty state (canvas "Empty · no saved lines").
const STARTER_LINES: { from: string; to: string }[] = [
  { from: 'Madina', to: 'Circle' },
  { from: 'Kasoa', to: 'Circle' },
  { from: 'Accra', to: 'Tema' },
]

const WHITE_SOFT = 'rgba(255,255,255,0.9)'

interface SheetLine { id: string; code: string; from: string; to: string; color: string }

/** Small white "Report" pill at the end of a queue strip (stale / none states). */
function ReportPill({ onPress, label }: { onPress: () => void; label: string }) {
  const { t } = useLanguage()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ marginLeft: 'auto', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 }}
    >
      <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: ui.text }}>{t('homeX.report')}</Text>
    </Pressable>
  )
}

/** Long-press sheet on a line block: Report queue / Report fare / Unsave (UX v2 H1). */
function LineActionsSheet({ line, onClose, onUnsave }: { line: SheetLine | null; onClose: () => void; onUnsave: (id: string) => void }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const go = (fn: () => void) => { onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fn() }
  const rows = line ? [
    { key: 'queue', Icon: Users, label: t('homeX.reportQueue'), color: ui.text, onPress: () => go(() => router.push({ pathname: '/report/queue', params: { station_name: line.from } } as any)) },
    { key: 'fare', Icon: Banknote, label: t('homeX.reportFare'), color: ui.text, onPress: () => go(() => router.push({ pathname: '/report/fare', params: { from: line.from, to: line.to, route_id: line.id, transport_type: 'trotro' } } as any)) },
    { key: 'unsave', Icon: HeartOff, label: t('homeX.unsaveLine'), color: '#B91C1C', onPress: () => go(() => onUnsave(line.id)) },
  ] : []
  return (
    <Modal visible={!!line} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose} accessibilityLabel={t('homeX.close')}>
        <Pressable style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }} onPress={() => {}}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
          {line ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 8 }}>
              <View style={{ backgroundColor: line.color, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: '#FFFFFF', letterSpacing: 0.6 }}>{line.code}</Text>
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text, flexShrink: 1 }} numberOfLines={1}>{line.from} → {line.to}</Text>
            </View>
          ) : null}
          {rows.map(({ key, Icon, label, color, onPress }) => (
            <Pressable
              key={key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 }}
            >
              <Icon size={20} color={color} />
              <Text style={{ fontFamily: font.bold, fontSize: 16, color }}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={{ height: 52, marginHorizontal: 20, marginTop: 8, borderRadius: 12, backgroundColor: ui.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text }}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/**
 * Home "Commute Board" line blocks (UX v2 H1/H2): each saved line is an edge-to-edge
 * block in its corridor colour — code + fare at 32, destination + boarding stop, one
 * fare-source label, and a queue strip (glyph, word, age). Six data states: fresh,
 * aging (dimmed glyph), stale / none (words + Report pill), loading (words only),
 * offline (cache + "Offline · saved HH:MM"). Long-press opens Report queue / fare / Unsave.
 * No saved lines → "Save your trotro line" with the three launch corridors.
 */
export default function MyRoutesCard({ commute, style }: { commute: ReturnType<typeof useCommute>; style?: object }) {
  const router = useRouter()
  const { t } = useLanguage()
  const { saved, isLoaded, variant, q, infoById, toggleFavorite } = commute
  const [sheet, setSheet] = useState<SheetLine | null>(null)
  // Lines present when Home first loads stay put; a line saved later slides in.
  const seen = useRef<Set<string> | null>(null)
  const savedIds = saved.map((f) => f.id).join(',')
  // Record what has been shown after each render (never during it). The first pass seeds
  // the set, so only lines added later count as new.
  useEffect(() => {
    if (!isLoaded) return
    const ids = savedIds ? savedIds.split(',') : []
    if (seen.current === null) seen.current = new Set(ids)
    else ids.forEach((id) => seen.current!.add(id))
  }, [isLoaded, savedIds])

  const unsave = (id: string) => {
    const f = saved.find((s) => s.id === id)
    if (f) toggleFavorite({ id: f.id, from: f.from, to: f.to })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  if (!isLoaded) return null

  if (saved.length === 0) {
    return (
      <View style={[{ marginHorizontal: 20, marginTop: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D6D3D1', borderRadius: 18, padding: 16 }, style]}>
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text }}>{t('homeX.saveYourLine')}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary, marginTop: 2 }}>{t('homeX.saveYourLineSub')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {STARTER_LINES.map((l) => (
            <Pressable
              key={`${l.from}-${l.to}`}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/search', params: { from: l.from, to: l.to } } as any) }}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={t('homeX.findLineA11y', { from: l.from, to: l.to })}
              style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: corridorFor(l.from, l.to).color, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#FFFFFF' }}>{l.from} → {l.to}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  // No network → react-query pauses the fetch ("Offline"); a server error while online is
  // "Couldn't refresh". Either way the persisted cache still holds the last answer.
  const offline = q.fetchStatus === 'paused'
  const failed = q.isError && !offline
  const savedAt = q.dataUpdatedAt
    ? new Date(q.dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' })
    : ''

  return (
    <View style={[{ marginHorizontal: 20, marginTop: 14 }, style]}>
      {(offline || failed) && q.data ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }} accessibilityRole="text">
          <WifiOff size={14} color={ui.textTertiary} />
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>{t(offline ? 'homeX.offlineSaved' : 'homeX.failedSaved', { time: savedAt })}</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {saved.map((f, i) => {
          const info = infoById.get(f.id)
          // Keep the saved names even before the server answers (or if it fails).
          const out = variant === 'morning'
          const from = info?.from ?? (out ? f.from : f.to)
          const to = info?.to ?? (out ? f.to : f.from)
          const { code, color } = corridorFor(from, to)
          const fare = info?.fare
          const queue = info?.queue
          const age = queue ? freshness(queue.reportedAt) : 'stale'
          const loading = q.isLoading
          const noAnswer = (offline || failed) && !q.data
          const isNew = !!seen.current && !seen.current.has(f.id)
          const reportQueue = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/report/queue', params: { station_name: from } } as any) }

          let strip: React.ReactNode
          let stripDark = false
          if (loading) {
            strip = <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' }} numberOfLines={1}>{t('homeX.checking', { place: from })}</Text>
          } else if (noAnswer) {
            strip = <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' }} numberOfLines={1}>{t(offline ? 'homeX.offlineCheck' : 'homeX.failedCheck', { place: from })}</Text>
          } else if (queue && age !== 'stale') {
            const dim = age === 'aging'
            strip = (
              <FlashOnChange token={`${queue.status}:${queue.reportedAt}:${queue.confirmations ?? 0}`} color="rgba(255,255,255,0.18)">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <QueueGlyph status={queue.status} color="#FFFFFF" size={15} opacity={dim ? 0.6 : 1} />
                  <Text style={{ fontFamily: dim ? font.semibold : font.bold, fontSize: 15, color: '#FFFFFF' }}>{queueWordT(queue.status)}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 15, color: WHITE_SOFT, flexShrink: 1 }} numberOfLines={1}>· {ageT(ageLabel(queue.reportedAt))}</Text>
                </View>
              </FlashOnChange>
            )
          } else if (queue) {
            // Stale: over 2 h. The "Usually long 6–8 am" history line needs the H7 aggregate
            // (not built yet), so say how old the last report is instead of a blank.
            stripDark = true
            strip = (
              <>
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#FFFFFF', flexShrink: 1 }} numberOfLines={1}>{t('homeX.staleLast', { age: ageT(ageLabel(queue.reportedAt)) })}</Text>
                <ReportPill onPress={reportQueue} label={t('homeX.reportQueueAt', { place: from })} />
              </>
            )
          } else {
            strip = (
              <>
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF', flexShrink: 1 }} numberOfLines={1}>{t('homeX.noReportsYet')}</Text>
                <ReportPill onPress={reportQueue} label={t('homeX.reportQueueAt', { place: from })} />
              </>
            )
          }

          return (
            <EnterIn key={f.id} animate={isNew}>
              <PressableScale
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/[id]', params: { id: f.id } } as any) }}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSheet({ id: f.id, code, from, to, color }) }}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityHint={t('homeX.longPressHint')}
                accessibilityActions={[
                  { name: 'reportQueue', label: t('homeX.reportQueue') },
                  { name: 'reportFare', label: t('homeX.reportFare') },
                  { name: 'unsave', label: t('homeX.unsaveLine') },
                ]}
                onAccessibilityAction={(e) => {
                  const name = e.nativeEvent.actionName
                  if (name === 'reportQueue') reportQueue()
                  else if (name === 'reportFare') router.push({ pathname: '/report/fare', params: { from, to, route_id: f.id, transport_type: 'trotro' } } as any)
                  else if (name === 'unsave') unsave(f.id)
                }}
                accessibilityLabel={`${t('homeX.routeA11y', { from, to })}${fare ? `, ${t(fare.source === 'reported' ? 'homeX.fareRiders' : 'homeX.fareGprtu', { fare: formatGHS(fare.amount) })}` : ''}${q.data ? `, ${queueA11y(queue?.status, queue?.reportedAt)}` : ''}`}
                style={{ backgroundColor: color, borderRadius: 18, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, gap: 6, overflow: 'hidden' }}
              >
                {/* Faint white Adinkra wallpaper across the block (decoration only). */}
                <AdinkraCardPattern height={220} ink="rgba(255,255,255,0.10)" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <HeroText size={32} numberOfLines={1} style={{ color: '#FFFFFF', letterSpacing: 0.3 }}>{code}</HeroText>
                    <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#FFFFFF' }} numberOfLines={1}>
                      → {to}
                      <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}> {t('homeX.fromPlace', { place: from })}</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    {loading && !fare ? (
                      <HeroText size={32} style={{ color: '#FFFFFF', opacity: 0.55 }}>GH₵…</HeroText>
                    ) : fare ? (
                      <>
                        <HeroText size={32} numberOfLines={1} style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
                          {fare.source === 'reported' ? '~' : ''}{formatGHS(fare.amount)}
                        </HeroText>
                        <Text style={{ fontFamily: font.extrabold, fontSize: 12, color: WHITE_SOFT, letterSpacing: 0.7 }}>
                          {fare.source === 'gprtu' ? 'GPRTU' : t('homeX.ridersSay')}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <View style={{
                  backgroundColor: stripDark ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)', borderRadius: 10, minHeight: 38,
                  paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  {strip}
                </View>
              </PressableScale>
            </EnterIn>
          )
        })}
      </View>

      <LineActionsSheet
        line={sheet}
        onClose={() => setSheet(null)}
        onUnsave={unsave}
      />
    </View>
  )
}
