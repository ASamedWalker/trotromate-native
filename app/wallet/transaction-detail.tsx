import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, Check, Clock, X as XIcon, Copy } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'

const BRAND = '#FF4D1C'

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof Check }> = {
  success: { label: 'Successful', color: '#16a34a', bg: '#ECFDF3', Icon: Check },
  pending: { label: 'Pending', color: '#b45309', bg: '#FEF3C7', Icon: Clock },
  failed: { label: 'Failed', color: '#dc2626', bg: '#FEE2E2', Icon: XIcon },
}

export default function TransactionDetailScreen() {
  const router = useRouter()
  const p = useLocalSearchParams<{
    type?: string; amount?: string; status?: string; description?: string
    created_at?: string; reference?: string; balance_after?: string
  }>()
  const [copied, setCopied] = useState(false)

  const credit = p.type === 'topup' || p.type === 'refund'
  const status = p.status || 'success'
  const meta = STATUS_META[status] ?? STATUS_META.success
  const amount = Number(p.amount || 0)
  const title = p.description || (credit ? 'MoMo Top-up' : 'Payment')
  const when = p.created_at
    ? new Date(p.created_at).toLocaleString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const reference = p.reference || '—'

  const copyRef = async () => {
    if (reference === '—') return
    await Clipboard.setStringAsync(reference)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && { fontFamily: font.semibold }]} numberOfLines={1}>{value}</Text>
    </View>
  )

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transaction</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        {/* Hero: status + amount */}
        <View style={s.hero}>
          <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
            <meta.Icon size={26} color={meta.color} strokeWidth={3} />
          </View>
          <Text style={[s.amount, { color: credit && status === 'success' ? '#16a34a' : '#111' }]}>
            {credit ? '+' : '-'}{formatGHS(amount)}
          </Text>
          <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
            <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={s.card}>
          <Row label="Description" value={title} />
          <Row label="Type" value={credit ? 'Top-up' : 'Payment'} />
          <Row label="Date" value={when} />
          {p.balance_after != null && p.balance_after !== '' && status === 'success' && (
            <Row label="Balance after" value={formatGHS(Number(p.balance_after))} />
          )}
        </View>

        {/* Reference */}
        <Text style={s.sectionLabel}>Reference</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={copyRef} style={s.refRow}>
          <Text style={s.refText} numberOfLines={1}>{reference}</Text>
          <View style={s.copyBtn}>
            <Copy size={14} color={BRAND} />
            <Text style={s.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
          </View>
        </TouchableOpacity>

        <Text style={s.help}>Keep this reference for any support enquiry about this transaction.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.bold, fontSize: 18, color: '#111' },

  hero: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  statusBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: font.extrabold, fontSize: 34, letterSpacing: -1 },
  statusPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100 },
  statusPillText: { fontFamily: font.bold, fontSize: 13 },

  card: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6', gap: 16 },
  rowLabel: { fontFamily: font.medium, fontSize: 14, color: '#9CA3AF' },
  rowValue: { fontFamily: font.semibold, fontSize: 14, color: '#111', flexShrink: 1, textAlign: 'right' },

  sectionLabel: { fontFamily: font.bold, fontSize: 12, color: '#6B7280', letterSpacing: 0.5, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  refText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: '#374151' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontFamily: font.bold, fontSize: 13, color: BRAND },
  help: { fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 12, lineHeight: 18 },
})
