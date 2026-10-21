import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { font, ui, brand } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { LineBadge } from '@/components/LineBadge'
import { formatGHS, formatGHSRange } from '@/lib/utils/currency'
import { titleCase } from '@/lib/utils/title-case'
import { fareSource, FARE_WARN_COLOR } from '@/lib/utils/fare-source'
import type { RouteWithStats } from '@/lib/types'
import { useLanguage } from '@/lib/i18n'

/**
 * One line, one 72 pt row (UX v2 L1/L2/L6/L7/L8, approved canvas "Lines → Proposed").
 * Badge · "→ Circle" (16/700, wraps) over provenance (13/500) · fare (22/800) over
 * exactly one source label (12/800). Ages over 2 h dim the whole row to 60%.
 * Rows sit inside a grouped white card: `first`/`last` round the card's corners.
 */

/** Okada never shows one price (L7): a min–max range from rider reports, or null. */
export function okadaRange(item: RouteWithStats): { min: number; max: number } | null {
  const st = item.fare_stats
  if (!st || (st.report_count ?? 0) < 2) return null
  const min = Number(st.min_reported_fare)
  const max = Number(st.max_reported_fare)
  if (!(min > 0) || !(max > min)) return null
  return { min, max }
}


function monthYear(iso: string | null | undefined, lang: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: 'numeric' })
}

export const LINE_ROW_MIN_H = 72

export function LineRow({
  item,
  saved,
  onPress,
  showFrom = true,
  first = true,
  last = true,
}: {
  item: RouteWithStats
  saved: boolean
  onPress: () => void
  /** Near me groups already name the boarding station, so the row shows only "→ Circle". */
  showFrom?: boolean
  first?: boolean
  last?: boolean
}) {
  const { t, lang } = useLanguage()
  const from = titleCase(item.from_location)
  const to = titleCase(item.to_location)
  const isOkada = item.transport_type === 'okada'
  const src = fareSource(item)

  // ── Right column + provenance by mode ──
  let fareText: string | null = null
  let chip: 'GPRTU' | 'RIDERS' | null = null
  let provenance = src.provenance
  let provColor: string = ui.textTertiary
  let provBold = false
  let aged = src.aged
  if (isOkada) {
    const r = okadaRange(item)
    fareText = r ? formatGHSRange(r.min, r.max) : null
    provenance = r ? t('line.okadaAgree') : t('line.okadaAgreeFare')
    aged = false
  } else {
    if (src.amount != null) fareText = `${src.approx ? '~' : ''}${formatGHS(src.amount)}`
    chip = src.chip
    if (src.kind === 'gprtu') {
      const when = monthYear(item.fare_approved_at, lang)
      provenance = when ? t('line.gprtuFare', { when }) : ''
    }
    if (src.warn) { provColor = FARE_WARN_COLOR; provBold = true }
    if (src.kind === 'none') { provColor = brand.orangeText; provBold = true }
  }

  const name = showFrom ? `${from} → ${to}` : `→ ${to}`
  const a11yFare = isOkada
    ? fareText ? t('line.a11y.okadaPays', { fare: fareText }) : t('line.a11y.okadaNoFare')
    : fareText ? `${src.approx ? t('line.a11y.about') : ''}${formatGHS(src.amount!)}, ${chip === 'GPRTU' ? t('line.a11y.gprtu') : t('line.a11y.riders')}` : t('line.a11y.noFare')

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isOkada ? t('line.a11y.okada') : ''}${t('line.a11y.to', { from, to })}, ${a11yFare}${provenance && !isOkada ? `, ${provenance}` : ''}${saved ? t('line.a11y.saved') : ''}`}
      style={{
        minHeight: LINE_ROW_MIN_H,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: ui.card,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: ui.hairline,
        borderTopColor: first ? ui.hairline : '#F0EFED',
        borderTopLeftRadius: first ? 16 : 0,
        borderTopRightRadius: first ? 16 : 0,
        borderBottomLeftRadius: last ? 16 : 0,
        borderBottomRightRadius: last ? 16 : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, opacity: aged ? 0.6 : 1 }}>
        <LineBadge from={item.from_location} to={item.to_location} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text }}>{name}</Text>
          {provenance ? (
            <Text style={{ fontFamily: provBold ? font.bold : font.medium, fontSize: 13, color: provColor }}>{provenance}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {fareText ? (
            <HeroText size={22} style={{ color: ui.text, fontVariant: ['tabular-nums'] }}>{fareText}</HeroText>
          ) : (
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.textTertiary }}>—</Text>
          )}
          {chip ? (
            <View style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: chip === 'GPRTU' ? '#ECFDF5' : '#F5F5F4' }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6, color: chip === 'GPRTU' ? '#047857' : '#57534E' }}>
                {chip === 'GPRTU' ? 'GPRTU' : t('line.riders')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}
