import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Gauge, ArrowRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { fetchTrafficSummary } from '@/lib/services/traffic-api'

const BRAND = '#FF4D1C'

type Condition = 'light' | 'moderate' | 'heavy' | 'severe'

// Visual metadata per Google traffic condition
const COND_META: Record<Condition, { label: string; color: string; bg: string; capacity: number }> = {
  light:    { label: 'Clear',    color: '#15803d', bg: '#dcfce7', capacity: 22 },
  moderate: { label: 'Moderate', color: '#b45309', bg: '#fef3c7', capacity: 55 },
  heavy:    { label: 'Heavy',    color: '#c2410c', bg: '#ffedd5', capacity: 82 },
  severe:   { label: 'Severe',   color: '#dc2626', bg: '#fee2e2', capacity: 96 },
}

// Google's live traffic_condition is often null off-peak; fall back to the
// (also Google-derived) busyness level so corridors still show a real signal.
const BUSYNESS_TO_COND: Record<string, Condition> = {
  low: 'light', moderate: 'moderate', busy: 'heavy', very_busy: 'severe',
}

type TrafficRoute = NonNullable<Awaited<ReturnType<typeof fetchTrafficSummary>>>[number]

function effectiveCondition(r: TrafficRoute): Condition {
  if (r.traffic_condition) return r.traffic_condition as Condition
  return BUSYNESS_TO_COND[r.busyness?.level ?? 'low'] ?? 'light'
}

export default function TrafficStatusScreen() {
  const router = useRouter()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trafficSummary'],
    queryFn: fetchTrafficSummary,
    staleTime: 5 * 60 * 1000,
  })

  const rank: Record<Condition, number> = { severe: 4, heavy: 3, moderate: 2, light: 1 }
  const corridors = (data ?? [])
    .slice()
    .sort((a, b) => rank[effectiveCondition(b)] - rank[effectiveCondition(a)])

  const count = (conds: Condition[]) =>
    corridors.filter((r) => conds.includes(effectiveCondition(r))).length

  const stats = [
    { n: count(['heavy', 'severe']), label: 'Heavy', color: '#dc2626' },
    { n: count(['moderate']), label: 'Moderate', color: '#b45309' },
    { n: count(['light']), label: 'Clear', color: '#16a34a' },
    { n: corridors.length, label: 'Total', color: '#111' },
  ]

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} colors={[BRAND]} />}
      >
        {/* Header — Troski station hero photo with a frosted-glass info panel */}
        <View style={s.hero}>
          <Image
            source={require('@/assets/images/traffic_status.png')}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
          />
          {/* Scrim so white text stays legible over the photo */}
          <LinearGradient
            colors={['rgba(0,0,0,0.30)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.60)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={s.heroBar}>
              {/* Glass back button */}
              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} hitSlop={12} style={s.backBtnClip} activeOpacity={0.85}>
                <BlurView intensity={30} tint="dark" style={s.backBtn}>
                  <ChevronLeft size={22} color="#fff" />
                </BlurView>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />

            {/* Frosted-glass info panel */}
            <View style={s.glassWrap}>
              <View style={s.glassClip}>
                <BlurView intensity={40} tint="dark" style={s.glassPanel}>
                  <View style={s.liveRow}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>LIVE · GOOGLE TRAFFIC</Text>
                  </View>
                  <Text style={s.title}>Traffic Status</Text>
                  <Text style={s.subtitle}>Across Accra corridors</Text>
                </BlurView>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Frosted-glass summary chips — overlap the hero's bottom edge so the
            blur picks up the photo (matches the Queue Status screen) */}
        <View style={s.statsRow}>
          {stats.map((st) => (
            <View key={st.label} style={s.statCardWrap}>
              <BlurView intensity={40} tint="light" style={s.statCard}>
                <Text style={[s.statNum, { color: st.color }]}>{st.n}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </BlurView>
            </View>
          ))}
        </View>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator color={BRAND} /></View>
        ) : corridors.length === 0 ? (
          <View style={s.empty}>
            <Gauge size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>Traffic data unavailable</Text>
            <Text style={s.emptySub}>Live corridor conditions could not be loaded right now. Pull to retry.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text style={s.sectionLabel}>Major Corridors</Text>
            {corridors.map((r) => {
              const cond = effectiveCondition(r)
              const meta = COND_META[cond]
              const showMins = r.duration_in_traffic_mins ?? r.estimated_duration_mins
              return (
                <View key={r.route_id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={s.routeRow}>
                      <Text style={s.routeName} numberOfLines={1}>{r.from_location}</Text>
                      <ArrowRight size={14} color="#9CA3AF" />
                      <Text style={s.routeName} numberOfLines={1}>{r.to_location}</Text>
                    </View>
                    <View style={[s.condPill, { backgroundColor: meta.bg }]}>
                      <Text style={[s.condText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${meta.capacity}%`, backgroundColor: meta.color }]} />
                  </View>

                  <View style={s.metaRow}>
                    {showMins != null && (
                      <Text style={s.metaText}>~{showMins} min</Text>
                    )}
                    {r.delay_mins > 0 ? (
                      <>
                        <View style={s.dot} />
                        <Text style={[s.metaText, { color: meta.color, fontFamily: font.semibold }]}>+{r.delay_mins} min delay</Text>
                      </>
                    ) : (
                      <>
                        <View style={s.dot} />
                        <Text style={s.metaText}>{r.busyness?.level === 'low' ? 'Flowing' : `${meta.label} now`}</Text>
                      </>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },

  hero: { height: 340, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', backgroundColor: '#1f2937' },
  heroBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  backBtnClip: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  backBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },

  // Frosted-glass info panel over the photo
  glassWrap: { paddingHorizontal: 16, paddingBottom: 30 },
  glassClip: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  glassPanel: {
    paddingHorizontal: 20, paddingVertical: 18,
    // iOS: real blur over a faint wash; Android: stronger translucent fallback
    backgroundColor: Platform.OS === 'ios' ? 'rgba(20,20,22,0.28)' : 'rgba(20,20,22,0.62)',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontFamily: font.bold, fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  title: { fontFamily: font.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8 },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: -36, marginBottom: 8 },
  statCardWrap: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  statCard: { paddingVertical: 14, alignItems: 'center', backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)' },
  statNum: { fontFamily: font.extrabold, fontSize: 22 },
  statLabel: { fontFamily: font.medium, fontSize: 11, color: '#374151', marginTop: 2 },

  sectionLabel: { fontFamily: font.bold, fontSize: 13, color: '#6B7280', letterSpacing: 0.3, marginTop: 6, marginBottom: 2 },
  center: { paddingVertical: 60, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeName: { fontFamily: font.bold, fontSize: 15, color: '#111', flexShrink: 1 },
  condPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  condText: { fontFamily: font.bold, fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', marginTop: 14, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  metaText: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB' },
})
