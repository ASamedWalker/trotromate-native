import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, type Href } from 'expo-router'
import { ChevronLeft, Check, Clock, X as XIcon, Copy, Undo2, Ticket, ChevronRight, MessageCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { font, brand, ui } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { HeroText } from '@/components/HeroText'
import { txView, TX_TONE } from '@/lib/utils/walletTx'
import { NETWORK_NAME, maskPhone } from '@/lib/services/topup'
import { SUPPORT_WHATSAPP } from '@/lib/config/support'

const STATUS_ICON = { Complete: Check, 'Waiting for approval': Clock, Waiting: Clock, Failed: XIcon, Refunded: Undo2 } as const
const STATUS_COLOR: Record<string, string> = {
  Complete: '#15803D', 'Waiting for approval': '#B45309', Waiting: '#B45309', Failed: '#B91C1C', Refunded: '#44403C',
}

/**
 * One transaction, Cash App style (UX v2 W7): amount, status line, where the
 * money came from and went, the reference with copy, a ticket link for trips,
 * and "Need help?" only when a support contact is configured.
 */
export default function TransactionDetailScreen() {
  const router = useRouter()
  const p = useLocalSearchParams<{
    type?: string; amount?: string; status?: string; description?: string
    created_at?: string; reference?: string; balance_after?: string
    provider?: string; phone?: string
  }>()
  const [copied, setCopied] = useState(false)

  const v = txView({
    type: p.type, amount: p.amount, status: p.status || 'success', description: p.description,
    created_at: p.created_at, metadata: { provider: p.provider, phone: p.phone },
  })
  const tone = TX_TONE[v.tone]
  const StatusIcon = STATUS_ICON[v.statusLabel as keyof typeof STATUS_ICON] ?? Check
  const statusColor = STATUS_COLOR[v.statusLabel] ?? ui.text
  const isTopup = p.type === 'topup'
  const isRefund = p.type === 'refund'
  const settled = p.status === 'success' || !p.status

  const when = p.created_at
    ? new Date(p.created_at).toLocaleString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '—'
  const reference = p.reference || ''
  const momo = `${NETWORK_NAME[p.provider ?? ''] ? `${NETWORK_NAME[p.provider ?? '']} MoMo` : 'MoMo'}${p.phone ? ` · ${maskPhone(p.phone)}` : ''}`
  const from = isTopup ? momo : isRefund ? 'Troski' : 'Troski wallet'
  const to = isTopup || isRefund ? 'Troski wallet' : (v.title || 'Trotro ticket')
  const statusDetail = v.statusLabel === 'Complete'
    ? (isTopup ? 'Added to your Troski wallet' : 'Paid from your Troski wallet')
    : v.statusLabel === 'Waiting for approval' ? 'Approve the prompt on your phone with your MoMo PIN'
    : v.statusLabel === 'Failed' ? (isTopup ? "The top-up didn't go through" : "The payment didn't go through")
    : v.statusLabel === 'Refunded' ? 'Returned to your Troski wallet'
    : ''

  const copyRef = async () => {
    if (!reference) return
    await Clipboard.setStringAsync(reference)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  )

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back() }} hitSlop={8} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={ui.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transaction</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Hero: who + amount */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: tone.bg }]}>
            <v.Icon size={26} color={tone.fg} />
          </View>
          <Text style={s.heroTitle} numberOfLines={2}>{v.title}</Text>
          <HeroText
            size={40}
            style={[{ color: v.credit && settled && !isRefund ? '#15803D' : v.amountColor, fontVariant: ['tabular-nums'] }, v.strike && { textDecorationLine: 'line-through' }]}
          >
            {v.amountText}
          </HeroText>
          <Text style={s.when}>{when}</Text>
        </View>

        {/* Transaction details */}
        <Text style={s.sectionLabel}>Transaction details</Text>
        <View style={s.card}>
          <View style={[s.statusRow]}>
            <StatusIcon size={18} color={statusColor} strokeWidth={2.6} />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusText, { color: statusColor }]}>{v.statusLabel}</Text>
              {!!statusDetail && <Text style={s.statusSub}>{statusDetail}</Text>}
            </View>
          </View>
          <Row label="Paid from" value={from} />
          <Row label="Paid to" value={to} />
          {p.balance_after != null && p.balance_after !== '' && settled && isFinite(Number(p.balance_after)) && (
            <Row label="Balance after" value={formatGHS(Number(p.balance_after))} />
          )}
        </View>

        {/* Reference + copy */}
        {!!reference && (
          <>
            <Text style={s.sectionLabel}>{isTopup ? 'Paystack reference' : 'Reference'}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={copyRef} style={s.refRow} accessibilityRole="button" accessibilityLabel={`Copy reference ${reference}`}>
              <Text style={s.refText} numberOfLines={1}>{reference}</Text>
              <View style={s.copyBtn}>
                {copied ? <Check size={16} color="#15803D" /> : <Copy size={16} color={brand.orangeText} />}
                <Text style={[s.copyText, copied && { color: '#15803D' }]}>{copied ? 'Copied' : 'Copy'}</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Ticket link for trips */}
        {!isTopup && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { Haptics.selectionAsync(); router.push('/wallet/tickets' as Href) }}
            style={[s.refRow, { marginTop: 12 }]}
            accessibilityRole="button"
          >
            <Ticket size={18} color={brand.orange} />
            <Text style={[s.refText, { color: ui.text, fontFamily: font.bold }]}>View your tickets</Text>
            <ChevronRight size={18} color={ui.textTertiary} />
          </TouchableOpacity>
        )}

        {SUPPORT_WHATSAPP ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Help with Troski transaction ${reference}`)}`).catch(() => {})}
            style={s.helpBtn}
            accessibilityRole="link"
          >
            <MessageCircle size={18} color={ui.text} />
            <Text style={s.helpText}>Need help? Chat on WhatsApp</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.help}>Keep this reference for any support enquiry about this transaction.</Text>
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

  hero: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { fontFamily: font.bold, fontSize: 16, color: ui.text, textAlign: 'center' },
  when: { fontFamily: font.medium, fontSize: 13, color: ui.textSecondary },

  sectionLabel: { fontFamily: font.bold, fontSize: 12, color: ui.textTertiary, letterSpacing: 0.6, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14 },
  statusText: { fontFamily: font.bold, fontSize: 15 },
  statusSub: { fontFamily: font.medium, fontSize: 13, color: ui.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.surfaceStrong, gap: 16 },
  rowLabel: { fontFamily: font.medium, fontSize: 14, color: ui.textSecondary },
  rowValue: { fontFamily: font.semibold, fontSize: 14, color: ui.text, flexShrink: 1, textAlign: 'right' },

  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, minHeight: 52, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 12 },
  refText: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: '#374151' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  copyText: { fontFamily: font.bold, fontSize: 14, color: brand.orangeText },
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, marginTop: 20, borderRadius: 14, borderWidth: 1.5, borderColor: ui.surfaceStrong },
  helpText: { fontFamily: font.bold, fontSize: 15, color: ui.text },
  help: { fontFamily: font.regular, fontSize: 13, color: ui.textSecondary, marginTop: 16 },
})
