import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform } from 'react-native'
import { Bus, Bike, ArrowRight, Clock, RefreshCw, Footprints } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import Skeleton from '@/components/Skeleton'
import type { TransferPlan } from '@/lib/services/route-planner'

export interface WalkingEstimate {
  distance_km: number
  duration_mins: number
  from: string
  to: string
}

const TRANSPORT_CONFIG: Record<string, {
  icon: typeof Bus
  label: string
  color: string
  bgLight: string
  bgDark: string
  borderColor: string
  dotColor: string
  lineLight: string
  lineDark: string
}> = {
  trotro: {
    icon: Bus,
    label: 'Trotro',
    color: c.amber600,
    bgLight: 'rgba(245,158,11,0.12)',
    bgDark: 'rgba(245,158,11,0.15)',
    borderColor: c.amber500,
    dotColor: c.amber500,
    lineLight: 'rgba(245,158,11,0.4)',
    lineDark: 'rgba(245,158,11,0.3)',
  },
  okada: {
    icon: Bike,
    label: 'Okada',
    color: c.orange500,
    bgLight: 'rgba(249,115,22,0.12)',
    bgDark: 'rgba(249,115,22,0.15)',
    borderColor: c.orange500,
    dotColor: c.orange500,
    lineLight: 'rgba(249,115,22,0.4)',
    lineDark: 'rgba(249,115,22,0.3)',
  },
}

function getConfig(type: string) {
  return TRANSPORT_CONFIG[type] || TRANSPORT_CONFIG.trotro
}

/* ── Skeleton ─────────────────────────────────────────── */

function ResultCardSkeleton({ isDark }: { isDark: boolean }) {
  const t = themed(isDark)
  return (
    <View style={[skeletonStyles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={skeletonStyles.header}>
        <View style={skeletonStyles.headerLeft}>
          <Skeleton width={28} height={28} borderRadius={8} />
          <Skeleton width={50} height={14} />
          <Skeleton width={56} height={16} borderRadius={6} />
        </View>
        <View style={skeletonStyles.headerRight}>
          <Skeleton width={44} height={12} />
          <Skeleton width={50} height={16} />
        </View>
      </View>
      <View style={skeletonStyles.timeline}>
        <View style={skeletonStyles.timelineCol}>
          <Skeleton width={10} height={10} borderRadius={5} />
          <Skeleton width={2} height={28} borderRadius={1} />
          <Skeleton width={10} height={10} borderRadius={5} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="75%" height={14} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>
    </View>
  )
}

export function RoutePlanSkeleton() {
  const isDark = useColorScheme() === 'dark'
  return (
    <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 16 }}>
      <ResultCardSkeleton isDark={isDark} />
      <ResultCardSkeleton isDark={isDark} />
      <ResultCardSkeleton isDark={isDark} />
    </View>
  )
}

/* ── Results ──────────────────────────────────────────── */

export function RoutePlannerResults({
  plans,
  isLoading,
  walkingEstimate,
  selectedPlanIndex,
  onSelectPlan,
}: {
  plans: TransferPlan[]
  isLoading: boolean
  walkingEstimate?: WalkingEstimate | null
  selectedPlanIndex?: number | null
  onSelectPlan?: (index: number) => void
}) {
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const t = themed(isDark)

  if (isLoading) {
    return <RoutePlanSkeleton />
  }

  if (plans.length === 0 && !walkingEstimate) {
    return (
      <View style={s.emptyState}>
        <View style={s.emptyIcon}>
          <RefreshCw size={24} color={t.textSecondary} />
        </View>
        <Text style={s.emptyTitle}>No routes found</Text>
        <Text style={s.emptyText}>Try different locations or check your spelling</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {plans.map((plan, i) => {
        const primaryType = plan.legs[0]?.transport_type || 'trotro'
        const config = getConfig(primaryType)
        const PrimaryIcon = config.icon

        const isSelected = selectedPlanIndex === i

        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelectPlan?.(i)}
            activeOpacity={0.85}
            style={[
              s.card,
              { borderLeftColor: config.borderColor, borderLeftWidth: 4 },
              isSelected && {
                borderWidth: 2,
                borderColor: c.amber500,
                ...Platform.select({
                  ios: { shadowColor: c.amber500, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8 },
                  android: { elevation: 4 },
                }),
              },
            ]}
          >
            {/* Header — transport mode + badge + stats */}
            <View style={s.cardHeader}>
              <View style={s.headerLeft}>
                <View style={[s.modeIcon, { backgroundColor: isDark ? config.bgDark : config.bgLight }]}>
                  <PrimaryIcon size={16} color={config.color} />
                </View>
                <Text style={[s.modeLabel, { color: config.color }]}>{config.label}</Text>
                {plan.type === 'direct' ? (
                  <View style={s.directBadge}>
                    <Text style={s.directBadgeText}>Direct</Text>
                  </View>
                ) : (
                  <View style={s.transferBadge}>
                    <Text style={s.transferBadgeText}>1 Transfer</Text>
                  </View>
                )}
              </View>
              <View style={s.cardMeta}>
                <Clock size={12} color={t.textSecondary} />
                <Text style={s.metaText}>{plan.total_duration_mins} min</Text>
                <Text style={s.fareText}>₵{plan.total_fare.toFixed(2)}</Text>
              </View>
            </View>

            {/* Legs */}
            {plan.legs.map((leg, j) => {
              const legConfig = getConfig(leg.transport_type)
              const LegIcon = legConfig.icon

              return (
                <View key={j}>
                  <View style={s.legRow}>
                    {/* Timeline */}
                    <View style={s.timeline}>
                      <View style={[s.timelineDot, { backgroundColor: legConfig.dotColor }]} />
                      <View style={[s.timelineLine, { backgroundColor: isDark ? legConfig.lineDark : legConfig.lineLight }]} />
                      <View style={[
                        s.timelineDot,
                        { backgroundColor: j === plan.legs.length - 1 ? '#22c55e' : legConfig.dotColor },
                      ]} />
                    </View>

                    {/* Leg details */}
                    <View style={s.legDetails}>
                      <View style={s.legRoute}>
                        <Text style={s.legLocation} numberOfLines={1}>{leg.from}</Text>
                        <ArrowRight size={12} color={t.textSecondary} />
                        <Text style={s.legLocation} numberOfLines={1}>{leg.to}</Text>
                      </View>
                      <View style={s.legMeta}>
                        <LegIcon size={14} color={legConfig.color} />
                        <Text style={[s.legMetaLabel, { color: legConfig.color }]}>{legConfig.label}</Text>
                        <Text style={s.legMetaText}>
                          · {leg.duration_mins} min · ₵{leg.fare.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Transfer indicator */}
                  {j < plan.legs.length - 1 && plan.transfer_hub && (
                    <View style={s.transferIndicator}>
                      <RefreshCw size={12} color="#0ea5e9" />
                      <Text style={s.transferText}>
                        Transfer at {plan.transfer_hub} · ~{plan.transfer_wait_mins} min wait
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}
          </TouchableOpacity>
        )
      })}

      {/* Walking estimate card */}
      {walkingEstimate && (
        <View style={[s.card, { borderLeftColor: '#22c55e', borderLeftWidth: 4 }]}>
          <View style={s.cardHeader}>
            <View style={s.headerLeft}>
              <View style={[s.modeIcon, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)' }]}>
                <Footprints size={16} color="#16a34a" />
              </View>
              <Text style={[s.modeLabel, { color: '#16a34a' }]}>Walk</Text>
            </View>
            <View style={s.cardMeta}>
              <Clock size={12} color={t.textSecondary} />
              <Text style={s.metaText}>~{walkingEstimate.duration_mins} min</Text>
              <Text style={[s.fareText, { color: '#16a34a' }]}>Free</Text>
            </View>
          </View>
          <View style={s.legRow}>
            <View style={s.timeline}>
              <View style={[s.timelineDot, { backgroundColor: '#22c55e' }]} />
              <View style={[s.timelineLine, { backgroundColor: isDark ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.4)' }]} />
              <View style={[s.timelineDot, { backgroundColor: '#22c55e' }]} />
            </View>
            <View style={s.legDetails}>
              <Text style={s.legLocation}>
                {walkingEstimate.from} → {walkingEstimate.to}
              </Text>
              <Text style={s.legMetaText}>
                Estimated {walkingEstimate.distance_km.toFixed(1)} km walk
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#d6d3d1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeline: { flexDirection: 'row', gap: 12 },
  timelineCol: { alignItems: 'center' },
})

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 12, marginTop: 16 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    emptyText: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, textAlign: 'center' },

    card: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
    },

    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modeIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeLabel: {
      fontSize: 12,
      fontFamily: font.bold,
    },
    directBadge: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    directBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: c.amber600,
      letterSpacing: 0.5,
    },
    transferBadge: {
      backgroundColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    transferBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#0ea5e9',
      letterSpacing: 0.5,
    },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },
    fareText: { fontSize: 14, fontFamily: font.bold, color: c.amber500, marginLeft: 8 },

    legRow: { flexDirection: 'row', gap: 12 },
    timeline: { alignItems: 'center', width: 12 },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    timelineLine: { width: 2, height: 28 },

    legDetails: { flex: 1, paddingBottom: 4 },
    legRoute: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legLocation: { fontSize: 14, fontFamily: font.semibold, color: t.text, flexShrink: 1 },
    legMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    legMetaLabel: { fontSize: 11, fontFamily: font.medium },
    legMetaText: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },

    transferIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 24,
      marginVertical: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.06)',
    },
    transferText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: '#0ea5e9',
    },
  })
}
