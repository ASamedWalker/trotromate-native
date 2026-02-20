import { View, Text, ActivityIndicator, useColorScheme, StyleSheet } from 'react-native'
import { Bus, Bike, ArrowRight, Clock, RefreshCw } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import type { TransferPlan } from '@/lib/services/route-planner'

export function RoutePlannerResults({
  plans,
  isLoading,
}: {
  plans: TransferPlan[]
  isLoading: boolean
}) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="large" color={c.amber500} />
        <Text style={s.emptyText}>Finding routes...</Text>
      </View>
    )
  }

  if (plans.length === 0) {
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
      {plans.map((plan, i) => (
        <View
          key={i}
          style={[
            s.card,
            plan.type === 'direct' ? s.directCard : s.transferCard,
          ]}
        >
          {/* Header */}
          <View style={s.cardHeader}>
            <View style={plan.type === 'direct' ? s.directBadge : s.transferBadge}>
              <Text style={plan.type === 'direct' ? s.directBadgeText : s.transferBadgeText}>
                {plan.type === 'direct' ? 'DIRECT' : '1 TRANSFER'}
              </Text>
            </View>
            <View style={s.cardMeta}>
              <Clock size={12} color={t.textSecondary} />
              <Text style={s.metaText}>{plan.total_duration_mins} min</Text>
              <Text style={s.fareText}>₵{plan.total_fare.toFixed(2)}</Text>
            </View>
          </View>

          {/* Legs */}
          {plan.legs.map((leg, j) => (
            <View key={j}>
              <View style={s.legRow}>
                {/* Timeline */}
                <View style={s.timeline}>
                  <View style={s.timelineDot} />
                  <View style={s.timelineLine} />
                  <View style={[
                    s.timelineDot,
                    j === plan.legs.length - 1 && s.timelineDotEnd,
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
                    {leg.transport_type === 'okada'
                      ? <Bike size={14} color={t.textSecondary} />
                      : <Bus size={14} color={t.textSecondary} />
                    }
                    <Text style={s.legMetaText}>
                      {leg.duration_mins} min · ₵{leg.fare.toFixed(2)}
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
          ))}
        </View>
      ))}
    </View>
  )
}

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

    card: { padding: 16, borderRadius: 16, borderWidth: 1 },
    directCard: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
    },
    transferCard: {
      backgroundColor: t.card,
      borderColor: t.border,
    },

    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
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
      color: c.amber500,
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
      backgroundColor: c.amber500,
    },
    timelineDotEnd: { backgroundColor: '#22c55e' },
    timelineLine: { width: 2, height: 28, backgroundColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.4)' },

    legDetails: { flex: 1, paddingBottom: 4 },
    legRoute: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legLocation: { fontSize: 14, fontFamily: font.semibold, color: t.text, flexShrink: 1 },
    legMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
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
