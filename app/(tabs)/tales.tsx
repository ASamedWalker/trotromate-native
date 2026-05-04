import { useState } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Wallet, Eye, EyeOff, QrCode, Clock, ChevronRight } from 'lucide-react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { c, font, themed } from '@/lib/theme'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

export default function WalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { isAuthenticated } = useAuthContext()

  const balance = 0.00
  const hasTransactions = false
  const hasActivePass = false

  const handleAuthAction = () => {
    if (!isAuthenticated) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.push('/auth/phone' as Href)
      return
    }
    // Authenticated — show coming soon until Paystack is integrated
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    alert('MoMo funding coming soon! Your account is verified and ready.')
  }

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 1000))
    setRefreshing(false)
  }

  const toggleBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setBalanceVisible(!balanceVisible)
  }

  const glass = {
    backgroundColor: isDark ? 'rgba(60,51,43,0.2)' : 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,173,58,0.1)' : 'rgba(0,0,0,0.06)',
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: isDark ? '#19120b' : '#fafaf9' }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: t.text }]}>Wallet</Text>
        <TouchableOpacity onPress={toggleBalance} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {balanceVisible
            ? <Eye size={22} color={isDark ? '#78716c' : '#a8a29e'} />
            : <EyeOff size={22} color={isDark ? '#78716c' : '#a8a29e'} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber500} colors={[c.amber500]} />
        }
      >
        {/* ── Balance Card — Glass + Gold Glow ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.section}>
          <View style={[s.balanceCard, glass, isDark && s.goldGlow]}>
            {/* Amber blur glow */}
            <View style={s.balanceGlowOrb} />

            {/* Coming Soon badge */}
            <View style={s.comingSoonBadge}>
              <Text style={s.comingSoonText}>COMING SOON</Text>
            </View>

            <Text style={s.balanceLabelText}>CURRENT BALANCE</Text>
            <View style={s.balanceAmountRow}>
              <Text style={[s.balanceAmount, { color: isDark ? '#eee0d3' : '#1c1917' }]}>
                {balanceVisible
                  ? `GHS ${balance.toLocaleString('en', { minimumFractionDigits: 2 })}`
                  : 'GHS ••••••'
                }
              </Text>
            </View>

            {/* Live sync badge */}
            <View style={s.liveSyncBadge}>
              <View style={s.liveSyncDot} />
              <Text style={s.liveSyncText}>LIVE SYNC READY</Text>
            </View>
          </View>
        </Animated.View>

        {hasActivePass ? (
          /* ── Active Pass + Quick Actions + Transactions (funded state) ── */
          <>
            {/* Quick actions */}
            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.quickRow}>
              {[
                { name: 'qr-code-scanner' as const, label: 'Scan' },
                { name: 'swap-horiz' as const, label: 'Transfer' },
                { name: 'electric-bolt' as const, label: 'Bills' },
                { name: 'more-horiz' as const, label: 'More' },
              ].map((a, i) => (
                <TouchableOpacity key={a.label} style={s.quickItem} activeOpacity={0.7}>
                  <Animated.View entering={FadeInDown.delay(120 + i * 50).duration(300)} style={{ alignItems: 'center' }}>
                    <View style={[s.quickCircle, glass]}>
                      <MaterialIcons name={a.name} size={24} color="#FFAD3A" />
                    </View>
                    <Text style={s.quickLabel}>{a.label}</Text>
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </Animated.View>

            {/* Active Pass */}
            <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.section}>
              <View style={s.passHeader}>
                <Text style={[s.sectionTitle, { color: t.text }]}>Active Pass</Text>
                <Text style={s.viewAll}>View All</Text>
              </View>
              <LinearGradient
                colors={['#FFAD3A', '#ff7e3a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.passCard}
              >
                <View style={s.passTop}>
                  <View>
                    <View style={s.passLiveRow}>
                      <View style={s.passLiveDot} />
                      <Text style={s.passLiveText}>LIVE PASS</Text>
                    </View>
                    <Text style={s.passRoute}>Madina → Circle</Text>
                  </View>
                  <MaterialIcons name="directions-bus" size={32} color="rgba(255,255,255,0.3)" />
                </View>
                <View style={s.passBottom}>
                  <View>
                    <Text style={s.passFieldLabel}>EXPIRES</Text>
                    <Text style={s.passFieldValue}>24 OCT 2026</Text>
                  </View>
                  <View style={s.passTripsLeft}>
                    <Text style={s.passTripsText}>12 TRIPS LEFT</Text>
                  </View>
                </View>
                {/* Decorative circle */}
                <View style={s.passDecorCircle} />
              </LinearGradient>
            </Animated.View>

            {/* Transactions */}
            <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.section}>
              <Text style={[s.sectionTitle, { color: t.text }]}>Recent Transactions</Text>
              {[
                { icon: 'commute' as const, label: 'Metro Mass Transit', date: 'Today • 08:45 AM', amount: '-GHS 4.50', status: 'COMPLETED', amountColor: t.text },
                { icon: 'account-balance' as const, label: 'Wallet Top-up', date: 'Yesterday • 06:12 PM', amount: '+GHS 200.00', status: 'MOMO PAY', amountColor: '#FFAD3A' },
                { icon: 'local-mall' as const, label: 'Shell Station Deli', date: 'Oct 21 • 01:20 PM', amount: '-GHS 25.00', status: 'COMPLETED', amountColor: t.text },
              ].map((tx, i) => (
                <Animated.View key={tx.label} entering={FadeInDown.delay(280 + i * 50).duration(300)}>
                  <View style={[s.txRow, glass]}>
                    <View style={[s.txIcon, { backgroundColor: isDark ? '#3c332b' : '#f5f5f4' }]}>
                      <MaterialIcons name={tx.icon} size={20} color="#FFAD3A" />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={[s.txLabel, { color: t.text }]}>{tx.label}</Text>
                      <Text style={s.txDate}>{tx.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.txAmount, { color: tx.amountColor }]}>{tx.amount}</Text>
                      <Text style={s.txStatus}>{tx.status}</Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          </>
        ) : (
          /* ── Empty State (Stitch Page 3 — "Your wallet is quiet") ── */
          <Animated.View entering={FadeIn.delay(200).duration(500)} style={s.emptyContainer}>
            {/* Glass wallet illustration */}
            <View style={s.emptyIllustration}>
              {/* Background glow */}
              <View style={s.emptyGlow} />

              {/* Central glass wallet */}
              <View style={[s.emptyWalletBox, glass]}>
                <MaterialIcons name="account-balance-wallet" size={56} color={isDark ? 'rgba(255,173,58,0.5)' : 'rgba(255,173,58,0.3)'} />
              </View>

              {/* Floating glass coins */}
              <View style={[s.floatingCoin1, glass]}>
                <MaterialIcons name="currency-exchange" size={18} color="rgba(255,173,58,0.4)" />
              </View>
              <View style={[s.floatingCoin2, glass]}>
                <MaterialIcons name="payments" size={16} color="rgba(255,173,58,0.3)" />
              </View>
            </View>

            {/* Text */}
            <Text style={[s.emptyTitle, { color: t.text }]}>Your wallet is quiet.</Text>
            <Text style={[s.emptySub, { color: isDark ? '#78716c' : '#a8a29e' }]}>
              Start your journey by funding your{'\n'}account via MoMo. Secure transit{'\n'}payments at your fingertips.
            </Text>

            {/* CTA Buttons */}
            <View style={s.emptyCTAs}>
              <TouchableOpacity style={s.emptyPrimaryBtn} activeOpacity={0.85} onPress={handleAuthAction}>
                <View style={s.emptyPrimaryInner}>
                  <MaterialIcons name="add-circle" size={20} color="#000" />
                  <Text style={s.emptyPrimaryText}>Add Money Now</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.emptySecondaryBtn, {
                borderColor: isDark ? 'rgba(255,173,58,0.4)' : 'rgba(255,173,58,0.3)',
              }]} activeOpacity={0.85} onPress={handleAuthAction}>
                <Text style={s.emptySecondaryText}>Connect MoMo Account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Transactions (empty state) ── */}
        {!hasTransactions && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[s.section, { marginTop: 'auto' }]}>
            <View style={s.txEmptyHeader}>
              <Text style={[s.txEmptyLabel, { color: t.text }]}>RECENT TRANSACTIONS</Text>
              <Text style={s.txEmptyViewAll}>VIEW ALL</Text>
            </View>
            <View style={[s.txEmptyBox, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }]}>
              <MaterialIcons name="history" size={28} color={isDark ? '#44403c' : '#d6d3d1'} />
              <Text style={s.txEmptyText}>NO TRANSACTIONS YET</Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 20, marginBottom: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontFamily: font.extrabold, letterSpacing: -0.5 },

  // Balance card
  balanceCard: {
    borderRadius: 16, padding: 24, alignItems: 'center', overflow: 'hidden',
  },
  goldGlow: {
    shadowColor: '#FFAD3A', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05, shadowRadius: 20,
  },
  balanceGlowOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,173,58,0.08)',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,173,58,0.15)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 99, alignSelf: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,173,58,0.2)',
  },
  comingSoonText: {
    fontSize: 10, fontFamily: font.bold, color: '#FFAD3A',
    letterSpacing: 2,
  },
  balanceLabelText: {
    fontSize: 10, fontFamily: font.bold, color: '#78716c',
    letterSpacing: 3, marginBottom: 8,
  },
  balanceAmountRow: { marginBottom: 16 },
  balanceAmount: { fontSize: 44, fontFamily: font.extrabold, letterSpacing: -2 },
  liveSyncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(60,51,43,0.4)', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  liveSyncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFAD3A' },
  liveSyncText: { fontSize: 10, fontFamily: font.bold, color: '#FFAD3A', letterSpacing: 1 },

  // Quick actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, paddingHorizontal: 16 },
  quickItem: { alignItems: 'center' },
  quickCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 10, fontFamily: font.bold, color: '#78716c', letterSpacing: 0.5, textAlign: 'center' },

  // Section
  sectionTitle: { fontSize: 22, fontFamily: font.bold, letterSpacing: -0.3, marginBottom: 12 },
  viewAll: { fontSize: 10, fontFamily: font.bold, color: '#FFAD3A', letterSpacing: 1 },
  passHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },

  // Active Pass
  passCard: { borderRadius: 16, padding: 20, overflow: 'hidden', gap: 24 },
  passTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  passLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  passLiveText: { fontSize: 10, fontFamily: font.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  passRoute: { fontSize: 22, fontFamily: font.extrabold, color: '#fff', letterSpacing: -0.5 },
  passBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  passFieldLabel: { fontSize: 10, fontFamily: font.bold, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  passFieldValue: { fontSize: 15, fontFamily: font.bold, color: '#fff' },
  passTripsLeft: {
    backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  passTripsText: { fontSize: 10, fontFamily: font.bold, color: '#fff', letterSpacing: 1 },
  passDecorCircle: {
    position: 'absolute', left: -20, bottom: -20,
    width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Transactions
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, marginBottom: 6 },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 15, fontFamily: font.bold },
  txDate: { fontSize: 10, fontFamily: font.bold, color: '#78716c', letterSpacing: 0.5, marginTop: 2 },
  txAmount: { fontSize: 16, fontFamily: font.bold, letterSpacing: 0.5 },
  txStatus: { fontSize: 9, fontFamily: font.bold, color: '#78716c', letterSpacing: 0.5, marginTop: 2 },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  emptyIllustration: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,173,58,0.06)',
  },
  emptyWalletBox: {
    width: 100, height: 100, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  floatingCoin1: {
    position: 'absolute', top: 10, right: 20, width: 44, height: 44,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    transform: [{ rotate: '12deg' }],
  },
  floatingCoin2: {
    position: 'absolute', bottom: 30, left: 20, width: 36, height: 36,
    borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  emptyTitle: { fontSize: 22, fontFamily: font.bold, letterSpacing: -0.3, marginBottom: 10 },
  emptySub: { fontSize: 15, fontFamily: font.regular, textAlign: 'center', lineHeight: 22 },
  emptyCTAs: { width: '100%', marginTop: 28, gap: 10 },
  emptyPrimaryBtn: { width: '100%' },
  emptyPrimaryInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFAD3A', paddingVertical: 16, borderRadius: 14,
    shadowColor: '#FFAD3A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  emptyPrimaryText: { fontSize: 17, fontFamily: font.bold, color: '#000' },
  emptySecondaryBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, alignItems: 'center',
  },
  emptySecondaryText: { fontSize: 12, fontFamily: font.bold, color: '#FFAD3A', letterSpacing: 2 },

  // Empty transactions
  txEmptyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16,
  },
  txEmptyLabel: { fontSize: 10, fontFamily: font.bold, letterSpacing: 2 },
  txEmptyViewAll: { fontSize: 10, fontFamily: font.bold, color: '#57534e', letterSpacing: 1 },
  txEmptyBox: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: 16,
    paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  txEmptyText: { fontSize: 10, fontFamily: font.bold, color: '#57534e', letterSpacing: 3 },
})
