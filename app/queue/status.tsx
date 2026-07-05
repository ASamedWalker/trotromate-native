import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft, Plus, Bus, Clock, Gauge } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import Skeleton from '@/components/Skeleton'
import { timeAgo } from '@/lib/utils/time'
import { fetchQueueStatus, QUEUE_META, type StationQueue } from '@/lib/services/queueStatus'

const BRAND = '#FF4D1C'

function ageLabel(s: StationQueue): string {
  if (s.ageMins <= 1) return 'just now'
  return timeAgo(s.reportedAt)
}

export default function QueueStatusScreen() {
  const router = useRouter()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => fetchQueueStatus(Date.now()),
    staleTime: 60_000,
  })

  const result = data ?? { stations: [], total: 0, liveNow: 0, busy: 0, nearFull: 0 }

  const stats = [
    { n: result.liveNow, label: 'Live Now', color: '#16a34a' },
    { n: result.busy, label: 'Busy', color: '#b45309' },
    { n: result.nearFull, label: 'Near Full', color: '#dc2626' },
    { n: result.total, label: 'Total', color: '#111' },
  ]

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} colors={[BRAND]} />}
      >
        {/* ── Hero: photo + dark wash + title, frosted stat cards overlapping ── */}
        <View style={s.hero}>
          <Image
            source={require('@/assets/images/queue_status_image.png')}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Top scrim — keeps the back chevron + subtitle readable over the
              busy photo, independent of ambient glare */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={s.heroTopScrim}
            pointerEvents="none"
          />
          <SafeAreaView edges={['top']}>
            <View style={s.heroBar}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.back() }}
                hitSlop={12}
                style={s.backBtn}
              >
                <ChevronLeft size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push('/traffic/status' as never) }}
                style={s.trafficLink}
              >
                <Gauge size={14} color="#fff" />
                <Text style={s.trafficLinkText}>Traffic</Text>
              </TouchableOpacity>
            </View>
            <View style={s.heroText}>
              <Text style={s.title}>Queue Status</Text>
              <Text style={s.subtitle}>Across all stations</Text>
            </View>
          </SafeAreaView>
        </View>

        {/* Frosted glass stat cards — overlap the hero's bottom edge */}
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
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} />
                  </View>
                  <Skeleton width={70} height={26} borderRadius={100} />
                </View>
                <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 14 }} />
              </View>
            ))}
          </View>
        ) : result.stations.length === 0 ? (
          <View style={s.empty}>
            <Bus size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>No queue reports yet</Text>
            <Text style={s.emptySub}>Be the first to report a queue at your station.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {result.stations.map((st) => {
              const meta = QUEUE_META[st.status]
              return (
                <View key={st.stationName} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stationName} numberOfLines={1}>{st.stationName}</Text>
                      <View style={s.metaRow}>
                        <Clock size={12} color="#9CA3AF" />
                        <Text style={[s.metaText, st.isStale && { color: '#dc2626' }]}>
                          {st.isStale ? `Stale · ${ageLabel(st)}` : ageLabel(st)}
                        </Text>
                        {st.vehicleCount != null && (
                          <>
                            <View style={s.dot} />
                            <Bus size={12} color="#9CA3AF" />
                            <Text style={s.metaText}>{st.vehicleCount} in yard</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>

                  {/* Capacity bar — visual of the reported level */}
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${meta.capacity}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Report CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/report/queue' as never) }}
          style={s.reportBtn}
        >
          <Plus size={18} color="#fff" />
          <Text style={s.reportText}>Report a Queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },

  // ── Hero ──
  hero: { height: 230, backgroundColor: '#1c1917', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  heroTopScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  heroBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  heroText: { paddingHorizontal: 24, marginTop: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  trafficLink: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, height: 34, borderRadius: 17 },
  trafficLinkText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },
  title: { fontFamily: font.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // ── Frosted stat cards (overlap hero bottom) ──
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: -36, marginBottom: 8 },
  statCardWrap: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  statCard: { paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  statNum: { fontFamily: font.extrabold, fontSize: 22 },
  statLabel: { fontFamily: font.medium, fontSize: 11, color: '#374151', marginTop: 2 },

  center: { paddingVertical: 60, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stationName: { fontFamily: font.bold, fontSize: 16, color: '#111' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { fontFamily: font.medium, fontSize: 12, color: '#9CA3AF' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB', marginHorizontal: 2 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  statusPillText: { fontFamily: font.bold, fontSize: 12 },

  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', marginTop: 14, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', backgroundColor: '#FAFAF9' },
  reportBtn: { height: 52, borderRadius: 16, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reportText: { fontFamily: font.bold, fontSize: 15, color: '#fff' },
})
