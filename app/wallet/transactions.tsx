import { useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { ChevronLeft, Clock } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { LoadErrorState, StaleDataBanner } from '@/components/StateViews'
import { authedFetch } from '@/lib/services/authedFetch'
import { txView, txDetailHref, TX_TONE, TX_PILL } from '@/lib/utils/walletTx'

const BRAND = '#FF4D1C'
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

interface Tx {
  id: string
  type: string
  amount: number
  status: string
  description?: string
  created_at: string
}

// Group transactions under Today / Yesterday / "12 Jun 2026" headers — the
// pattern every major wallet app (Cash App, Revolut, M-Pesa) uses.
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TransactionsScreen() {
  const router = useRouter()
  const { user } = useAuthContext()
  const PAGE = 20
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)

  const [loadFailed, setLoadFailed] = useState(false)

  const fetchPage = useCallback(async (offset: number) => {
    if (!user?.id) return { rows: [] as Tx[], more: false, failed: false }
    try {
      const res = await authedFetch(`${API_URL}/api/wallet/transactions?auth_user_id=${user.id}&limit=${PAGE}&offset=${offset}`)
      const data = await res.json()
      return { rows: (Array.isArray(data.transactions) ? data.transactions : []) as Tx[], more: !!data.hasMore, failed: false }
    } catch {
      // failed ≠ empty — the screen must not claim "No transactions yet" (UX-14)
      return { rows: [] as Tx[], more: false, failed: true }
    }
  }, [user?.id])

  const load = useCallback(async () => {
    const { rows, more, failed } = await fetchPage(0)
    offsetRef.current = PAGE
    if (failed) setLoadFailed(true)
    else { setTxs(rows); setLoadFailed(false) }
    setHasMore(more); setLoading(false); setRefreshing(false)
  }, [fetchPage])

  const [loadMoreFailed, setLoadMoreFailed] = useState(false)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { rows, more, failed } = await fetchPage(offsetRef.current)
    if (failed) {
      // Don't advance the offset or end the list — a failed page must stay
      // retryable, not read as "that's all your activity" (UX-14)
      setLoadMoreFailed(true); setLoadingMore(false)
      return
    }
    setLoadMoreFailed(false)
    offsetRef.current += PAGE
    setTxs((cur) => [...cur, ...rows]); setHasMore(more); setLoadingMore(false)
  }, [fetchPage, loadingMore, hasMore])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Build ordered [label, tx[]] groups
  const groups: [string, Tx[]][] = []
  for (const tx of txs) {
    const label = dayLabel(tx.created_at)
    const g = groups.find(([l]) => l === label)
    if (g) g[1].push(tx); else groups.push([label, [tx]])
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.title}>Transactions</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        scrollEventThrottle={200}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 240) loadMore()
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={BRAND} colors={[BRAND]} />}
      >
        {!loading && loadFailed && txs.length > 0 && (
          <StaleDataBanner message="Couldn't refresh — showing earlier transactions." onRetry={() => load()} />
        )}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={BRAND} /></View>
        ) : loadFailed && txs.length === 0 ? (
          <LoadErrorState message="Couldn't load your transactions. Check your connection." onRetry={() => { setLoading(true); load() }} />
        ) : txs.length === 0 ? (
          <View style={s.empty}>
            <Clock size={36} color="#6B7280" />
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptySub}>Top up your wallet or book a trip to see activity here.</Text>
          </View>
        ) : (
          groups.map(([label, items]) => (
            <View key={label} style={{ marginTop: 8 }}>
              <Text style={s.groupLabel}>{label}</Text>
              <View style={s.card}>
                {items.map((tx, i) => {
                  const v = txView(tx)
                  const tone = TX_TONE[v.tone]
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      activeOpacity={0.6}
                      onPress={() => { Haptics.selectionAsync(); router.push(txDetailHref(tx) as never) }}
                      style={[s.row, i > 0 && s.rowBorder]}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.title}, ${v.amountText.replace('−', 'minus ').replace('+', 'plus ')}, ${v.sub}${v.pill ? `, ${v.pill}` : ''}`}
                    >
                      <View style={[s.icon, { backgroundColor: tone.bg }]}>
                        <v.Icon size={19} color={tone.fg} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                        <Text style={s.txTitle} numberOfLines={1}>{v.title}</Text>
                        <Text style={s.txTime} numberOfLines={1}>{v.sub}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={[s.amount, { color: v.amountColor }, v.strike && { textDecorationLine: 'line-through' }]}>
                          {v.amountText}
                        </Text>
                        {v.pill && (
                          <View style={[s.pill, { backgroundColor: TX_PILL[v.pill].bg }]}>
                            <Text style={[s.pillText, { color: TX_PILL[v.pill].fg }]}>{v.pill}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ))
        )}

        {loadingMore && (
          <View style={{ paddingVertical: 20 }}><ActivityIndicator color={BRAND} /></View>
        )}
        {loadMoreFailed && !loadingMore && (
          <TouchableOpacity onPress={loadMore} style={{ paddingVertical: 16, alignItems: 'center' }} accessibilityRole="button">
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#B45309' }}>
              Couldn&apos;t load more — tap to retry
            </Text>
          </TouchableOpacity>
        )}
        {!loading && !hasMore && txs.length > 0 && (
          <Text style={s.note}>That’s all your activity.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  title: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: '#111' },

  center: { paddingVertical: 70, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: '#6B7280', textAlign: 'center' },

  groupLabel: { fontFamily: font.bold, fontSize: 12, color: '#5F6670', letterSpacing: 0.5, marginLeft: 24, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 64 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontFamily: font.bold, fontSize: 15, color: '#0A0A0A' },
  txTime: { fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: 1 },
  amount: { fontFamily: font.extrabold, fontSize: 15, fontVariant: ['tabular-nums'] },
  pill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pillText: { fontFamily: font.bold, fontSize: 12 },
  note: { fontFamily: font.regular, fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 20 },
})
