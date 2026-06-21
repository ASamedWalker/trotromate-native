import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import { ChevronLeft, Ticket, QrCode, Check, Clock, X as XIcon, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { fetchMyTickets, type MyTicket } from '@/lib/services/tickets'

const BRAND = '#FF4D1C'

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof Check }> = {
  active: { label: 'Active', color: '#16a34a', bg: '#ECFDF3', Icon: QrCode },
  used: { label: 'Used', color: '#6B7280', bg: '#F3F4F6', Icon: Check },
  expired: { label: 'Expired', color: '#b45309', bg: '#FEF3C7', Icon: Clock },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#FEE2E2', Icon: XIcon },
}

export default function MyTicketsScreen() {
  const router = useRouter()
  const { user } = useAuthContext()
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const data = await fetchMyTickets(user.id)
    setTickets(data); setLoading(false); setRefreshing(false)
  }, [user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const active = tickets.filter((t) => t.status === 'active')
  const past = tickets.filter((t) => t.status !== 'active')

  const Row = (t: MyTicket) => {
    const meta = STATUS_META[t.status] ?? STATUS_META.used
    const tappable = t.status === 'active'
    const date = new Date(t.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return (
      <TouchableOpacity
        key={t.trip_code}
        activeOpacity={tappable ? 0.7 : 1}
        disabled={!tappable}
        onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/wallet/ticket', params: { trip_code: t.trip_code } } as Href) }}
        style={s.card}
      >
        <View style={[s.icon, { backgroundColor: meta.bg }]}>
          <meta.Icon size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.route} numberOfLines={1}>{t.route_label}</Text>
          <Text style={s.meta}>{date} · {formatGHS(t.fare)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[s.pill, { backgroundColor: meta.bg }]}>
            <Text style={[s.pillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {tappable && <ChevronRight size={16} color="#D1D5DB" />}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Tickets</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={BRAND} colors={[BRAND]} />}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator color={BRAND} /></View>
        ) : tickets.length === 0 ? (
          <View style={s.empty}>
            <Ticket size={36} color="#9CA3AF" />
            <Text style={s.emptyTitle}>No tickets yet</Text>
            <Text style={s.emptySub}>Book a trip and your tickets show up here.</Text>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <Text style={s.section}>ACTIVE</Text>
                <View style={{ gap: 10 }}>{active.map(Row)}</View>
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={[s.section, { marginTop: active.length ? 24 : 4 }]}>PAST</Text>
                <View style={{ gap: 10 }}>{past.map(Row)}</View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: '#111' },

  section: { fontFamily: font.bold, fontSize: 12, color: '#6B7280', letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  route: { fontFamily: font.bold, fontSize: 15, color: '#111' },
  meta: { fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  pillText: { fontFamily: font.bold, fontSize: 11 },

  center: { paddingVertical: 70, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: '#111', marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
})
