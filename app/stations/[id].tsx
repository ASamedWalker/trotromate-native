import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Check, ChevronRight, Users } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { HeroText } from '@/components/HeroText'
import { FreshnessDot } from '@/components/FreshnessDot'
import { QueueGlyph } from '@/components/QueueGlyph'
import { LineBadge } from '@/components/LineBadge'
import { QUEUE_COLOR, QUEUE_WORD } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { formatGHS } from '@/lib/utils/currency'
import { useStationDetail } from '@/lib/hooks/useStationDetail'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { CountText } from '@/components/motion/CountText'
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh'
import { FlashOnChange } from '@/components/motion/FlashOnChange'
import { CARD, ORANGE, ORANGE_SOFT, TEXT, TEXT2 } from '@/components/home/tokens'
import { useLanguage } from '@/lib/i18n'
import { ageT, queueWordT } from '@/lib/i18n/home-format'

/**
 * Station page (redesign wave 2): "is there a queue / which lines leave here?"
 * Queue status as the hero with its age, a report button, the lines from here
 * and the last reports. The map stays opt-in.
 */
export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const { station, isLoading, isError, lines, reports, latestFresh, confirmations, confirm } = useStationDetail(id)
  const { isAuthenticated } = useAuthContext()
  const { refreshing, onRefresh } = usePullToRefresh([['stations'], ['station-lines', id], ['station-reports', id], ['queue-confirmations']])

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#FAFAF9', paddingTop: insets.top + 12, paddingHorizontal: 20 }}><BackButton /></View>
  }
  if (isError || !station) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAF9', paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
        <BackButton />
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: TEXT }}>{isError ? t('stations.loadError') : t('stations.notFound')}</Text>
      </View>
    )
  }

  const stat = station.queue_stats?.[0]
  const kind = stat?.current_status ? freshness(stat.last_report_at) : 'stale'
  const status = stat?.current_status
  const heroColor = kind === 'stale' || !status ? '#6B7280' : QUEUE_COLOR[status]
  const report = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({ pathname: '/report/queue', params: { station_id: station.id, station_name: station.name } } as any)
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
      style={{ flex: 1, backgroundColor: '#FAFAF9' }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 22, lineHeight: 30, color: TEXT }} numberOfLines={2}>{station.name}</Text>
          {station.location ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }} numberOfLines={1}>{station.location}</Text> : null}
        </View>
        {/* Map hidden for now (owner 2026-10-09). */}
      </View>

      {/* Queue hero */}
      <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 16 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 1, color: TEXT2 }}>{t('stations.queueHeader')}</Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}
          accessible
          accessibilityLabel={kind === 'stale' || !status ? t('homeX.queueA11yNone') : t('homeX.queueA11y', { status: queueWordT(status), age: ageT(ageLabel(stat?.last_report_at)) })}
        >
          {kind === 'stale' || !status
            ? <FreshnessDot kind={kind} color={heroColor} size={14} />
            : <QueueGlyph status={status} color={heroColor} size={24} opacity={kind === 'aging' ? 0.8 : 1} />}
          <FlashOnChange token={`${status}:${stat?.last_report_at}`} style={{ flexShrink: 1 }}>
            <HeroText size={32} style={{ color: heroColor }}>{kind === 'stale' || !status ? t('homeX.noRecentReport') : queueWordT(status)}</HeroText>
          </FlashOnChange>
        </View>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: TEXT2 }}>
          {kind === 'stale' || !status
            ? t('stations.beFirst')
            : `${t('stations.reportedAgo', { age: ageT(ageLabel(stat?.last_report_at)) })}${stat?.report_count_last_hour ? ` · ${t(stat.report_count_last_hour === 1 ? 'stations.reportsHourOne' : 'stations.reportsHourMany', { n: stat.report_count_last_hour })}` : ''}`}
        </Text>
        {latestFresh && (confirmations.data ?? 0) > 0 ? (
          <FlashOnChange token={confirmations.data} color="rgba(21,128,61,0.12)" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            <CountText
              value={confirmations.data ?? 0}
              format={(n) => t(n === 1 ? 'stations.confirmedOne' : 'stations.confirmedMany', { n })}
              style={{ fontFamily: font.bold, fontSize: 13, color: '#15803D' }}
            />
          </FlashOnChange>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={report}
          accessibilityRole="button"
          accessibilityLabel={t('homeX.reportQueueAt', { place: station.name })}
          style={{ marginTop: 14, height: 56, borderRadius: 14, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Users size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF' }}>{t('stations.reportHere')}</Text>
        </TouchableOpacity>
        {latestFresh ? (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={confirm.isPending || confirm.isSuccess}
            onPress={() => {
              if (!isAuthenticated) { router.push('/auth/phone' as any); return }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              confirm.mutate()
            }}
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? t('stations.confirmA11y') : t('stations.signInConfirmA11y')}
            style={{ marginTop: 8, height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Check size={18} color={ORANGE} />
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>
              {confirm.isSuccess ? t('stations.thanksConfirmed') : confirm.isError ? t('stations.couldNotConfirm') : isAuthenticated ? t('stations.stillConfirm') : t('stations.signInConfirm')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Lines from here */}
      <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT, marginBottom: 4 }}>{t('stations.linesFromHere')}</Text>
        {lines.isLoading ? (
          <View style={{ height: 40, borderRadius: 10, backgroundColor: '#F3F1EF', marginVertical: 10 }} />
        ) : (lines.data ?? []).length === 0 ? (
          <Text style={{ fontFamily: font.regular, fontSize: 14, color: TEXT2, paddingVertical: 10 }}>{t('stations.noLines')}</Text>
        ) : (lines.data ?? []).map((r, i) => {
          const startsHere = r.from_station_id === station.id ||
            (r.to_station_id !== station.id && r.from_location.trim().toLowerCase() === station.name.trim().toLowerCase())
          const dest = startsHere ? r.to_location : r.from_location
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/routes/[id]', params: { id: r.id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`${t('homeX.routeA11y', { from: r.from_location, to: r.to_location })}${r.official_fare && r.is_gprtu_verified ? `, ${t('homeX.fareGprtu', { fare: formatGHS(Number(r.official_fare)) })}` : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border }}
            >
              <LineBadge from={r.from_location} to={r.to_location} />
              <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: TEXT }} numberOfLines={1}>{t('stations.toDest', { place: dest })}</Text>
              {r.official_fare && r.is_gprtu_verified ? (
                <>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: TEXT }}>{formatGHS(Number(r.official_fare))}</Text>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 10, color: '#15803D' }}>GPRTU</Text>
                </>
              ) : null}
              <ChevronRight size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Recent reports */}
      {(reports.data ?? []).length > 0 ? (
        <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT, marginBottom: 4 }}>{t('stations.recentReports')}</Text>
          {(reports.data ?? []).map((r, i) => {
            const k = freshness(r.reported_at)
            const c = k === 'stale' ? '#6B7280' : QUEUE_COLOR[r.queue_status]
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border }}>
                {k === 'stale' ? <FreshnessDot kind={k} color={c} /> : <QueueGlyph status={r.queue_status} color={c} size={14} opacity={k === 'aging' ? 0.8 : 1} />}
                <Text style={{ fontFamily: font.extrabold, fontSize: 14, color: c }}>{r.queue_status in QUEUE_WORD ? queueWordT(r.queue_status) : r.queue_status}</Text>
                <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, color: TEXT2 }} numberOfLines={1}>
                  {r.source === 'reporter' ? t('stations.srcReporter') : r.source === 'whatsapp' ? t('stations.srcWhatsapp') : r.source === 'rider' ? t('stations.srcRider') : ''}
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }}>{ageT(ageLabel(r.reported_at))}</Text>
              </View>
            )
          })}
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, paddingVertical: 8 }}>{t('stations.greyed')}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={report}
        accessibilityRole="button"
        accessibilityLabel={t('stations.reportTheQueue')}
        style={{ height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>{t('stations.atTell', { name: station.name })}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
