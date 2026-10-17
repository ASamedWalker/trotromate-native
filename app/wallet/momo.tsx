import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Keyboard, Platform,
  InputAccessoryView, Modal, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, Smartphone, X, Check } from 'lucide-react-native'
import { font, brand, ui } from '@/lib/theme'
import NetworkLogo, { type NetworkId } from '@/components/NetworkLogo'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'
import { formatGHS } from '@/lib/utils/currency'
import { startTopup, topupStatusHref, maskPhone } from '@/lib/services/topup'
import { getSavedMomo, saveMomo } from '@/lib/services/momoPrefs'
import { getCachedWallet } from '@/lib/services/walletCache'
import { authedFetch } from '@/lib/services/authedFetch'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
const AMOUNTS = [5, 10, 20, 50]
const PROVIDERS: { id: NetworkId; label: string }[] = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'tgo', label: 'Telecel Cash' },
  { id: 'atl', label: 'AirtelTigo Money' },
]
const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.label ?? 'MoMo'

// Shared iOS keyboard toolbar id (decimal/phone pads have no Done key)
const DONE_ACCESSORY_ID = 'momo-done'

/** Clean local digits: "+233 24 456 7890" → "244567890". */
const localDigits = (v: string) => v.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '')
// Ghana mobile: 9 local digits, 2nd digit 2 or 5 (MTN/Telecel/AirtelTigo prefixes).
const validPhone = (v: string) => /^[25]\d{8}$/.test(localDigits(v))

/** "GH₵10" chip label, "GH₵10.00" money lines (no space, as on the mockup). */
const ghs = (n: number) => formatGHS(n)

/**
 * Top up — one screen (UX v2 TU2–TU4): amount chips + Other amount with a live
 * "New balance after approval", the saved MoMo number (network chosen once, in
 * a "Choose your network" modal the first time), an honest fee box, and a
 * pinned "Send prompt to my phone". Sending only REQUESTS money: on success we
 * replace this screen with app/wallet/topup-status.tsx (pending → credited /
 * failed). Errors are inline, never Alert (TU8).
 */
export default function MomoTopUpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuthContext()
  const { provider: providerParam, amount: amountParam, return: returnTo, pops } = useLocalSearchParams<{ provider?: string; amount?: string; return?: string; pops?: string }>()

  // Pre-fill the amount when a booking shortfall was passed in (selects a preset
  // chip if it matches, else fills the custom field).
  const prefill = amountParam ? parseFloat(amountParam) : NaN
  const validPrefill = isFinite(prefill) && prefill > 0
  const [amount, setAmount] = useState<number | null>(validPrefill ? (AMOUNTS.includes(prefill) ? prefill : null) : 10)
  const [customAmount, setCustomAmount] = useState(validPrefill && !AMOUNTS.includes(prefill) ? String(prefill) : '')

  // Saved network + number (TU3). null until loaded / chosen.
  const [provider, setProvider] = useState<NetworkId | null>(null)
  const [phone, setPhone] = useState('')
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Draft values inside the "Choose your network" modal.
  const [draftProvider, setDraftProvider] = useState<NetworkId>('mtn')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getSavedMomo().then((saved) => {
      if (!alive) return
      const paramProvider = PROVIDERS.some((p) => p.id === providerParam) ? (providerParam as NetworkId) : null
      if (saved) {
        setProvider(paramProvider ?? saved.provider)
        setPhone(saved.phone)
      } else {
        // First time: open the network picker, pre-filled with the sign-in number.
        setDraftProvider(paramProvider ?? 'mtn')
        setDraftPhone(localDigits(user?.phone || ''))
        setSheetOpen(true)
      }
      setPrefsLoaded(true)
    })
    return () => { alive = false }
  }, [providerParam, user?.phone])

  // Current balance for "New balance after approval" (cache first, then a read).
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    getCachedWallet(user.id).then((snap) => { if (alive && snap) setBalance((cur) => cur ?? snap.balance) }).catch(() => {})
    authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.balance != null && isFinite(Number(d.balance))) setBalance(Number(d.balance)) })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.id])

  const [loading, setLoading] = useState(false)
  // Inline errors (TU8): never Alert.alert in the top-up flow.
  const [amountError, setAmountError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const parsedCustom = customAmount ? parseFloat(customAmount.replace(',', '.')) : 0
  const effectiveAmount = amount ?? (isFinite(parsedCustom) ? parsedCustom : 0)
  const amountOk = effectiveAmount >= 1 && effectiveAmount <= 500

  const openSheet = () => {
    Haptics.selectionAsync()
    setDraftProvider(provider ?? 'mtn')
    setDraftPhone(phone || localDigits(user?.phone || ''))
    setDraftError(null)
    setSheetOpen(true)
  }
  const confirmSheet = () => {
    if (!validPhone(draftPhone)) {
      setDraftError('Enter a valid Ghana MoMo number, like 024 123 4567.')
      return
    }
    Haptics.selectionAsync()
    setProvider(draftProvider)
    setPhone(localDigits(draftPhone))
    setSheetOpen(false)
    setFormError(null)
  }

  const handleSend = async () => {
    if (loading) return
    setFormError(null)
    if (!amountOk) {
      setAmountError(effectiveAmount > 500 ? 'You can top up at most GH₵500 at a time.' : 'Choose or enter an amount of at least GH₵1.')
      return
    }
    setAmountError(null)
    if (!provider || !validPhone(phone)) { openSheet(); return }
    if (!user?.id) {
      setFormError('Verify your phone number first, then top up.')
      return
    }

    // Backend validates against /^(?:\+233|0)[2345]\d{8}$/ — send E.164.
    const msisdn = '+233' + localDigits(phone)

    // Sending a prompt is a request, not a payment: light tap only, no success
    // haptic or check here (TU1). The pending screen reports what actually happens.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLoading(true)
    const amountToSend = Math.round(effectiveAmount * 100) / 100
    const r = await startTopup({ userId: user.id, amount: amountToSend, phone: msisdn, provider })
    setLoading(false)
    if (r.ok) {
      saveMomo({ provider, phone: localDigits(phone) })
      router.replace(topupStatusHref({
        reference: r.reference,
        amount: amountToSend,
        phone: msisdn,
        provider,
        createdAt: new Date().toISOString(),
        returnTo: returnTo === 'checkout' ? 'checkout' : undefined,
        // Screens to pop to get back to checkout: checkout → (momo, replaced by status) = 1.
        pops: returnTo === 'checkout' ? (pops ?? '1') : undefined,
      }) as never)
      return
    }
    console.warn('[topup] not started:', r.status, r.error)
    setFormError(r.error)
  }

  const newBalance = balance != null && amountOk ? balance + effectiveAmount : null

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={4} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={ui.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Top up</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 140 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* TU2: how much */}
        <Text style={s.sectionLabel}>HOW MUCH?</Text>
        <View style={s.amountRow}>
          {AMOUNTS.map((a) => {
            const on = amount === a
            return (
              <TouchableOpacity
                key={a}
                style={[s.amountChip, on ? s.amountChipOn : s.amountChipOff]}
                onPress={() => { setAmount(a); setCustomAmount(''); setAmountError(null); Haptics.selectionAsync() }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.amountChipText, { color: on ? '#FFFFFF' : ui.text }]}>GH₵{a}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={[s.otherRow, amount == null && customAmount ? s.otherRowOn : null]}>
          {(customAmount || amount == null) ? <Text style={s.otherPrefix}>GH₵</Text> : null}
          <TextInput
            style={s.otherInput}
            placeholder="Other amount"
            placeholderTextColor="#6B7280"
            keyboardType="decimal-pad"
            inputAccessoryViewID={DONE_ACCESSORY_ID}
            value={customAmount}
            onChangeText={(v) => { setCustomAmount(v); setAmount(null); setAmountError(null) }}
            accessibilityLabel="Other amount in cedis"
          />
        </View>
        {amountError ? (
          <Text style={s.fieldError} accessibilityLiveRegion="polite">{amountError}</Text>
        ) : newBalance != null ? (
          <Text style={s.newBalance}>New balance after approval: <Text style={s.newBalanceValue}>{ghs(newBalance)}</Text></Text>
        ) : null}

        {/* TU3: pay from — saved number, network chosen once */}
        <Text style={[s.sectionLabel, { marginTop: 22 }]}>PAY FROM</Text>
        {provider && phone ? (
          <TouchableOpacity activeOpacity={0.85} onPress={openSheet} style={s.payFrom} accessibilityRole="button" accessibilityLabel={`Pay from ${maskPhone(phone)}, ${providerLabel(provider)}. Change`}>
            <NetworkLogo id={provider} width={44} height={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.payFromNumber}>{maskPhone(phone)}</Text>
              <Text style={s.payFromNet}>{providerLabel(provider)}</Text>
            </View>
            <Text style={s.change}>Change</Text>
          </TouchableOpacity>
        ) : prefsLoaded ? (
          <TouchableOpacity activeOpacity={0.85} onPress={openSheet} style={s.payFrom} accessibilityRole="button">
            <View style={s.phoneIcon}><Smartphone size={20} color={ui.textSecondary} /></View>
            <Text style={[s.payFromNumber, { flex: 1 }]}>Choose your network</Text>
            <Text style={s.change}>Choose</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.payFrom, { backgroundColor: ui.surface, borderColor: ui.surface }]} />
        )}

        {/* TU4: honest fee box */}
        <View style={s.feeBox}>
          <View style={s.feeRow}>
            <Text style={s.feeLabel}>Amount</Text>
            <Text style={s.feeValue}>{amountOk ? ghs(effectiveAmount) : '—'}</Text>
          </View>
          <View style={s.feeRow}>
            <Text style={s.feeLabel}>Troski fee</Text>
            <Text style={[s.feeValue, { color: '#15803D', fontFamily: font.bold }]}>GH₵0.00</Text>
          </View>
          <Text style={s.feeNote}>Your network may charge its usual MoMo fee or e-levy.</Text>
          <View style={[s.feeRow, s.feeTotal]}>
            <Text style={s.feeTotalText}>Total from your MoMo</Text>
            <Text style={s.feeTotalText}>{amountOk ? ghs(effectiveAmount) : '—'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Pinned send */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {formError && <Text style={[s.fieldError, s.formError]} accessibilityLiveRegion="polite">{formError}</Text>}
        <TouchableOpacity
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.85}
          style={[s.sendBtn, (loading || !amountOk) && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          <Smartphone size={20} color="#FFFFFF" />
          <Text style={s.sendText}>{loading ? 'Sending prompt…' : 'Send prompt to my phone'}</Text>
        </TouchableOpacity>
        <Text style={s.sendHint}>You approve it on your phone with your MoMo PIN.</Text>
      </View>

      {/* TU3: "Choose your network" — first time, or Change */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheetOpen(false)} accessibilityLabel="Close" />
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Choose your network</Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)} style={s.sheetClose} accessibilityRole="button" accessibilityLabel="Close">
                <X size={22} color={ui.text} />
              </TouchableOpacity>
            </View>
            {PROVIDERS.map((p) => {
              const on = draftProvider === p.id
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => { Haptics.selectionAsync(); setDraftProvider(p.id) }}
                  style={[s.netRow, on && s.netRowOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <NetworkLogo id={p.id} width={44} height={32} />
                  <Text style={s.netLabel}>{p.label}</Text>
                  <View style={[s.radio, on && s.radioOn]}>{on && <Check size={14} color="#FFFFFF" strokeWidth={3} />}</View>
                </TouchableOpacity>
              )
            })}
            <Text style={[s.sectionLabel, { marginTop: 14 }]}>MOMO NUMBER</Text>
            <View style={[s.phoneField, draftError ? { borderColor: ui.danger } : null]}>
              <Text style={s.phonePrefix}>+233</Text>
              <TextInput
                style={s.phoneInput}
                placeholder="24 123 4567"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
                inputAccessoryViewID={DONE_ACCESSORY_ID}
                maxLength={13}
                value={draftPhone}
                onChangeText={(v) => { setDraftPhone(v); setDraftError(null) }}
                accessibilityLabel="MoMo number"
              />
            </View>
            {draftError && <Text style={s.fieldError} accessibilityLiveRegion="polite">{draftError}</Text>}
            <TouchableOpacity onPress={confirmSheet} activeOpacity={0.9} style={[s.sendBtn, { marginTop: 16 }]} accessibilityRole="button">
              <Text style={s.sendText}>Use this number</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
          <View style={s.accessoryBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8}>
              <Text style={s.accessoryDone}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 52 },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: font.bold, color: ui.text },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  sectionLabel: { fontSize: 12, fontFamily: font.bold, letterSpacing: 0.8, color: ui.textTertiary, marginBottom: 8 },

  // TU2 amount chips (64 × 48 minimum)
  amountRow: { flexDirection: 'row', gap: 8 },
  amountChip: { flex: 1, minWidth: 64, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  amountChipOn: { backgroundColor: '#0A0A0A' },
  amountChipOff: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E7E5E4' },
  amountChipText: { fontSize: 17, fontFamily: font.extrabold },
  otherRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8, height: 48, borderRadius: 12,
    backgroundColor: ui.surface, paddingHorizontal: 14, borderWidth: 1.5, borderColor: ui.surface,
  },
  otherRowOn: { backgroundColor: '#FFFFFF', borderColor: '#0A0A0A' },
  otherPrefix: { fontSize: 16, fontFamily: font.bold, color: ui.text, marginRight: 6 },
  otherInput: { flex: 1, fontSize: 16, fontFamily: font.semibold, color: ui.text, paddingVertical: 0 },
  newBalance: { fontSize: 13, fontFamily: font.medium, color: ui.textSecondary, marginTop: 8 },
  newBalanceValue: { fontFamily: font.bold, color: ui.text },

  // TU3 pay-from row
  payFrom: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 1, borderColor: '#EEEEEE', paddingHorizontal: 14, paddingVertical: 12,
  },
  phoneIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: ui.surface, alignItems: 'center', justifyContent: 'center' },
  payFromNumber: { fontSize: 16, fontFamily: font.bold, color: ui.text, fontVariant: ['tabular-nums'] },
  payFromNet: { fontSize: 13, fontFamily: font.medium, color: ui.textSecondary },
  change: { fontSize: 15, fontFamily: font.bold, color: brand.orangeText, paddingVertical: 12 },

  // TU4 fee box
  feeBox: { marginTop: 18, backgroundColor: '#F5F5F4', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 15, fontFamily: font.medium, color: ui.text },
  feeValue: { fontSize: 15, fontFamily: font.medium, color: ui.text, fontVariant: ['tabular-nums'] },
  feeNote: { fontSize: 12, fontFamily: font.medium, color: ui.textSecondary },
  feeTotal: { borderTopWidth: 1, borderTopColor: '#E7E5E4', paddingTop: 8, marginTop: 2 },
  feeTotalText: { fontSize: 15, fontFamily: font.extrabold, color: ui.text, fontVariant: ['tabular-nums'] },

  // Pinned send
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: ui.bg },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, borderRadius: 14, backgroundColor: brand.orange,
  },
  sendText: { fontSize: 16, fontFamily: font.bold, color: '#FFFFFF' },
  sendHint: { fontSize: 12, fontFamily: font.medium, color: ui.textSecondary, textAlign: 'center', marginTop: 8 },

  // Choose-your-network modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontFamily: font.bold, color: ui.text },
  sheetClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  netRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#EEEEEE', marginBottom: 8,
  },
  netRowOn: { borderColor: '#0A0A0A' },
  netLabel: { flex: 1, fontSize: 15, fontFamily: font.bold, color: ui.text },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  phoneField: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E7E5E4', paddingHorizontal: 14,
  },
  phonePrefix: { fontSize: 16, fontFamily: font.bold, color: ui.text },
  phoneInput: { flex: 1, fontSize: 17, fontFamily: font.semibold, color: ui.text, letterSpacing: 0.5, paddingVertical: 0 },

  // iOS keyboard Done bar
  accessoryBar: {
    flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f5f5f4', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)',
  },
  accessoryDone: { fontSize: 16, fontFamily: font.bold, color: brand.orange },

  // Inline validation (TU8)
  fieldError: { fontSize: 13, fontFamily: font.semibold, color: ui.danger, marginTop: 6 },
  formError: { marginTop: 0, marginBottom: 8, textAlign: 'center' },
})
