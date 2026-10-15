import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import { ChevronLeft, Ticket, Check, Clock, X as XIcon, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font, brand, ui } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { hhmm } from '@/lib/utils/clock'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { fetchMyTickets, type MyTicket } from '@/lib/services/tickets'
import { cancelBooking } from '@/lib/services/booking'
import { getCachedPasses, cacheActivePasses } from '@/lib/services/ticketCache'
import { LoadErrorState, StaleDataBanner } from '@/components/StateViews'

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof Check }> = {
  active: { label: 'Valid', color: brand.orangeText, bg: brand.orangeSoft, Icon: Ticket },
  used: { label: 'Used', color: '#44403C', bg: '#F3F4F6', Icon: Check },
  expired: { label: 'Expired', color: '#B91C1C', bg: '#FEF2F2', Icon: Clock },
  cancelled: { label: 'Cancelled', color: '#44403C', bg: '#F3F4F6', Icon: XIcon },
}

/**
 * A ticket is valid while the server says active. The device clock only ends
 * it at expires_at when the list is stale (last good load > 2 min ago), so a
 * phone with its clock set ahead never moves a paid ticket to Past.
 */
const isValid = (t: MyTicket, now: number, serverFresh: boolean) =>
  t.status === 'active' && (serverFresh || !t.expires_at || new Date(t.expires_at).getTime() > now)

export default function MyTicketsScreen() {
  const router = useRouter()
  const { user } = useAuthContext()
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [tab, setTab] = useState<'valid' | 'past'>('valid')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  // Minute tick so tickets move from Valid to Past without a refresh.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const data = await fetchMyTickets(user.id)
    // null = fetch failed — never render "No tickets yet" over an error (UX-14)
    if (data == null) setLoadFailed(true)
    else { setTickets(data); setLoadFailed(false); setLoadedAt(Date.now()); setNow(Date.now()) }
    setLoading(false); setRefreshing(false)
  }, [user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const serverFresh = loadedAt != null && now - loadedAt < 120000
  const valid = tickets.filter((t) => isValid(t, now, serverFresh))
  const past = tickets.filter((t) => !isValid(t, now, serverFresh))
  const list = tab === 'valid' ? valid : past

  // Cancel moved here from the Wallet tab's old ticket card (UX v2 W3 row has only Show).
  const confirmCancel = (t: MyTicket) => {
    if (!user?.id) return
    Alert.alert(
      'Cancel this booking?',
      `${t.route_label}\n\nYou'll be refunded ${formatGHS(t.fare)} to your wallet. This can't be undone.`,
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel & refund',
          style: 'destructive',
          onPress: async () => {
            setCancelling(t.trip_code)
            const r = await cancelBooking(user.id, t.trip_code)
            setCancelling(null)
            if (r.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              getCachedPasses().then((ps) => cacheActivePasses(ps.filter((p) => p.trip_code !== t.trip_code))).catch(() => {})
              Alert.alert('Booking cancelled', `${formatGHS(r.refunded)} refunded to your wallet.`)
              load()
            } else {
              Alert.alert('Could not cancel', r.message)
            }
          },
        },
      ],
    )
  }

  const Row = (t: MyTicket) => {
    const live = isValid(t, now, serverFresh)
    const status = live ? 'active' : t.status === 'active' ? 'expired' : t.status
    const meta = STATUS_META[status] ?? STATUS_META.used
    // Used and expired tickets open in their own state (faded / hidden QR). Cancelled never opens.
    const tappable = status !== 'cancelled'
    const date = new Date(t.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
    const sub = live
      ? (t.expires_at ? `Valid till ${hhmm(t.expires_at)}` : 'Valid')
      : status === 'used' && t.used_at ? `${date} · used at ${hhmm(t.used_at)}`
      : status === 'expired' && t.expires_at ? `${date} · expired at ${hhmm(t.expires_at)}`
      : date
    return (
      <View key={t.trip_code} style={s.card}>
        <TouchableOpacity
          activeOpacity={tappable ? 0.7 : 1}
          disabled={!tappable}
          onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/wallet/ticket', params: { trip_code: t.trip_code } } as Href) }}
          style={s.cardMain}
          accessibilityRole={tappable ? 'button' : undefined}
          accessibilityLabel={`${t.route_label}. ${meta.label}. ${sub}`}
        >
          <View style={[s.icon, { backgroundColor: meta.bg }]}>
            <meta.Icon size={20} color={meta.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.route} numberOfLines={2}>{t.route_label}</Text>
            <Text style={s.meta}>{sub} · {formatGHS(t.fare)}</Text>
          </View>
          {live ? (
            <View style={s.showBtn}><Text style={s.showText}>Show</Text></View>
          ) : (
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[s.pill, { backgroundColor: meta.bg }]}>
                <Text style={[s.pillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {tappable && <ChevronRight size={16} color="#A8A29E" />}
            </View>
          )}
        </TouchableOpacity>
        {live && (
          <TouchableOpacity
            disabled={cancelling === t.trip_code}
            onPress={() => confirmCancel(t)}
            style={s.cancelBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: cancelling === t.trip_code }}
          >
            <Text style={s.cancelText}>{cancelling === t.trip_code ? 'Cancelling…' : 'Cancel & refund'}</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={ui.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tickets</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* TK6: Valid / Past tabs */}
      <View style={s.tabs} accessibilityRole="tablist">
        {([['valid', `Valid${valid.length ? ` · ${valid.length}` : ''}`], ['past', 'Past']] as const).map(([key, label]) => {
          const on = tab === key
          return (
            <TouchableOpacity
              key={key}
              onPress={() => { Haptics.selectionAsync(); setTab(key) }}
              style={[s.tab, on && s.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.tabText, on && s.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={brand.orange} colors={[brand.orange]} />}
      >
        {!loading && loadFailed && tickets.length > 0 && (
          <StaleDataBanner message="Couldn't refresh — showing earlier tickets." onRetry={() => load()} />
        )}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={brand.orange} /></View>
        ) : loadFailed && tickets.length === 0 ? (
          <LoadErrorState message="Couldn't load your tickets. Check your connection." onRetry={() => { setLoading(true); load() }} />
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Ticket size={36} color={ui.textSecondary} />
            <Text style={s.emptyTitle}>{tab === 'valid' ? 'No valid tickets' : 'No past tickets'}</Text>
            <Text style={s.emptySub}>{tab === 'valid' ? 'Book a trip and your ticket shows up here.' : 'Used and expired tickets show up here.'}</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 4 }}>{list.map(Row)}</View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: ui.text },

  tabs: { flexDirection: 'row', marginHorizontal: 20, marginTop: 4, marginBottom: 12, backgroundColor: ui.surface, borderRadius: 12, padding: 4 },
  tab: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontFamily: font.semibold, fontSize: 14, color: ui.textSecondary },
  tabTextOn: { fontFamily: font.bold, color: ui.text },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  route: { fontFamily: font.bold, fontSize: 15, color: ui.text },
  meta: { fontFamily: font.medium, fontSize: 13, color: ui.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  pillText: { fontFamily: font.bold, fontSize: 12 },
  showBtn: { height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  showText: { fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' },
  cancelBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.surfaceStrong },
  cancelText: { fontFamily: font.semibold, fontSize: 14, color: ui.danger },

  center: { paddingVertical: 70, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 16, color: ui.text, marginTop: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: ui.textSecondary, textAlign: 'center' },
})
