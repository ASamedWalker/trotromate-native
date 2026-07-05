import { useState } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Modal, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, ChevronDown, Copy, Check, Landmark, X } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { font, themed } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'

const BRAND = '#FF4D1C'
const BRAND_TINT = '#FFF0EB'

// Troski virtual collection accounts per partner bank. Front-end placeholders
// until the wallet backend issues real per-user virtual accounts.
const BANKS: { name: string; account: string }[] = [
  { name: 'GCB Bank', account: '1401 0098 7654' },
  { name: 'Ecobank Ghana', account: '0240 1122 3344' },
  { name: 'Absa Bank Ghana', account: '0301 5566 7788' },
  { name: 'Fidelity Bank', account: '1050 4433 2211' },
  { name: 'Stanbic Bank', account: '9040 7788 9900' },
  { name: 'CalBank', account: '1400 6655 4433' },
  { name: 'Zenith Bank', account: '6010 1234 5678' },
  { name: 'Access Bank', account: '1044 8877 6655' },
]

const ACCOUNT_NAME = 'TROSKI TECHNOLOGIES'

export default function BankTransferScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()

  const [bank, setBank] = useState<(typeof BANKS)[number] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyAccount = async () => {
    if (!bank) return
    await Clipboard.setStringAsync(bank.account.replace(/\s/g, ''))
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.iconBtn}>
          <ArrowLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: t.text }]}>Bank Transfer</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <Text style={[s.intro, { color: t.textSecondary }]}>
          Select the bank you want to use for Troski account top up and copy the account number. Transfer to the account number shown below.
        </Text>

        {/* Bank dropdown */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setPickerOpen(true); Haptics.selectionAsync() }}
          style={[s.dropdown, {
            backgroundColor: isDark ? '#1c1917' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E5E3',
          }]}
        >
          <Text style={[s.dropdownText, { color: bank ? t.text : '#6B7280', fontFamily: bank ? font.semibold : font.regular }]}>
            {bank ? bank.name : 'Select Bank'}
          </Text>
          <ChevronDown size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Account details (after a bank is chosen) */}
        {bank && (
          <Animated.View entering={FadeInDown.duration(300)} style={[s.accountCard, {
            backgroundColor: isDark ? '#1c1917' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F1F0',
          }]}>
            <View style={s.accountRow}>
              <View>
                <Text style={s.accountLabel}>ACCOUNT NUMBER</Text>
                <Text style={[s.accountNumber, { color: t.text }]}>{bank.account}</Text>
              </View>
              <TouchableOpacity onPress={copyAccount} activeOpacity={0.8} style={[s.copyBtn, copied && { backgroundColor: '#16a34a' }]}>
                {copied ? <Check size={16} color="#fff" /> : <Copy size={16} color="#fff" />}
                <Text style={s.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.accountDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F1F0' }]} />
            <View style={s.metaRow}>
              <Text style={[s.metaLabel, { color: t.textSecondary }]}>Account Name</Text>
              <Text style={[s.metaValue, { color: t.text }]}>{ACCOUNT_NAME}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={[s.metaLabel, { color: t.textSecondary }]}>Bank</Text>
              <Text style={[s.metaValue, { color: t.text }]}>{bank.name}</Text>
            </View>
          </Animated.View>
        )}

        {/* Note */}
        <View style={[s.note, { backgroundColor: isDark ? '#1c1917' : '#F5F5F4' }]}>
          <Text style={[s.noteText, { color: t.textSecondary }]}>
            <Text style={[s.noteLead, { color: t.text }]}>Note:  </Text>
            Bank transfers take about 2 minutes for your top up to reflect, with a service charge of GH₵ 0.25.
          </Text>
        </View>
      </View>

      {/* Bank picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={[s.sheet, { backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}>
          <View style={s.sheetHeader}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Select Bank</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={8}>
              <X size={22} color={t.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {BANKS.map((b) => {
              const active = bank?.name === b.name
              return (
                <TouchableOpacity
                  key={b.name}
                  activeOpacity={0.8}
                  onPress={() => { setBank(b); setPickerOpen(false); setCopied(false); Haptics.selectionAsync() }}
                  style={s.bankRow}
                >
                  <View style={[s.bankIcon, { backgroundColor: active ? BRAND_TINT : (isDark ? '#292524' : '#F6F6F5') }]}>
                    <Landmark size={18} color={active ? BRAND : (isDark ? '#a8a29e' : '#57534e')} />
                  </View>
                  <Text style={[s.bankName, { color: t.text }]}>{b.name}</Text>
                  {active && <Check size={18} color={BRAND} strokeWidth={3} />}
                </TouchableOpacity>
              )
            })}
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: font.bold },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  intro: { fontSize: 14, fontFamily: font.regular, lineHeight: 21 },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, marginTop: 22,
  },
  dropdownText: { fontSize: 15 },

  accountCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginTop: 16, gap: 14 },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountLabel: { fontSize: 10, fontFamily: font.bold, letterSpacing: 1.5, color: '#6B7280', marginBottom: 6 },
  accountNumber: { fontSize: 22, fontFamily: font.extrabold, letterSpacing: 1 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND,
    paddingHorizontal: 14, height: 38, borderRadius: 10,
  },
  copyText: { fontSize: 13, fontFamily: font.bold, color: '#fff' },
  accountDivider: { height: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 13, fontFamily: font.medium },
  metaValue: { fontSize: 13, fontFamily: font.semibold },

  note: { borderRadius: 12, padding: 14, marginTop: 16 },
  noteText: { fontSize: 12.5, fontFamily: font.regular, lineHeight: 19 },
  noteLead: { fontFamily: font.bold },

  // Picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20,
    paddingTop: 18, paddingBottom: 34,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontFamily: font.bold },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  bankIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bankName: { flex: 1, fontSize: 15, fontFamily: font.semibold },
})
