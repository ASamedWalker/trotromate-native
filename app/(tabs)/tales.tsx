import { useState } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Platform, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Wallet, Eye, EyeOff, Plus, QrCode, ArrowDownToLine, Receipt, Clock, ChevronRight } from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

// Mock transactions — will be real when Paystack is integrated
const MOCK_TRANSACTIONS = [
  { id: '1', type: 'fund', label: 'Added via MoMo', amount: 50, date: 'Today, 2:30 PM', icon: 'add-circle' as const },
  { id: '2', type: 'ticket', label: 'Circle → Madina', amount: -8, date: 'Today, 8:15 AM', icon: 'confirmation-number' as const },
  { id: '3', type: 'ticket', label: 'Madina → Circle', amount: -8, date: 'Yesterday, 5:40 PM', icon: 'confirmation-number' as const },
  { id: '4', type: 'fund', label: 'Added via MoMo', amount: 30, date: 'Yesterday, 7:00 AM', icon: 'add-circle' as const },
]

export default function WalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const balance = 0 // Will come from wallet API
  const hasTransactions = false // Will be real

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

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber500} colors={[c.amber500]} />
        }
      >
        {/* ── Balance Card — Cash App inspired ── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={isDark ? ['#292524', '#1c1917'] : ['#1c1917', '#292524']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.balanceCard}
          >
            {/* Decorative glow */}
            <View style={s.balanceGlow} />

            <View style={s.balanceHeader}>
              <View style={s.balanceHeaderLeft}>
                <Wallet size={20} color="#FFAD3A" />
                <Text style={s.balanceLabel}>Troski Wallet</Text>
              </View>
              <TouchableOpacity onPress={toggleBalance} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                {balanceVisible
                  ? <Eye size={20} color="rgba(255,255,255,0.4)" />
                  : <EyeOff size={20} color="rgba(255,255,255,0.4)" />
                }
              </TouchableOpacity>
            </View>

            {/* Balance — THE hero element */}
            <View style={s.balanceRow}>
              <Text style={s.balanceCurrency}>GH₵</Text>
              <Text style={s.balanceAmount}>
                {balanceVisible ? balance.toFixed(2) : '••••'}
              </Text>
            </View>

            {/* Fund + Withdraw inline */}
            <View style={s.balanceActions}>
              <TouchableOpacity style={s.balancePrimaryBtn} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#FF716A', '#FFAD3A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.balancePrimaryGradient}
                >
                  <Plus size={18} color="#1c1917" strokeWidth={3} />
                  <Text style={s.balancePrimaryText}>Add Money</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[s.balanceSecondaryBtn, {
                borderColor: 'rgba(255,255,255,0.1)',
              }]} activeOpacity={0.8}>
                <ArrowDownToLine size={16} color="#fff" />
                <Text style={s.balanceSecondaryText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Quick Actions — circular row ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.quickSection}>
          {[
            { icon: Receipt, label: 'Buy\nTicket', color: '#FFAD3A', bg: 'rgba(255,173,58,0.1)' },
            { icon: QrCode, label: 'Scan\nQR', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
            { icon: Clock, label: 'History', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
          ].map((action, i) => (
            <TouchableOpacity key={action.label} style={s.quickAction} activeOpacity={0.7}>
              <Animated.View entering={FadeInDown.delay(150 + i * 60).duration(350)}>
                <View style={[s.quickActionCircle, { backgroundColor: action.bg }]}>
                  <action.icon size={22} color={action.color} />
                </View>
                <Text style={[s.quickActionLabel, { color: t.text }]}>{action.label}</Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── Active Ticket — Apple Wallet style (only when ticket exists) ── */}
        {/* Placeholder for when tickets are purchased
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.ticketSection}>
          <Text style={[s.sectionTitle, { color: t.text }]}>Active Ticket</Text>
          <LinearGradient colors={['#FFAD3A', '#FF716A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ticketCard}>
            <Text style={s.ticketRoute}>Circle → Madina</Text>
            <Text style={s.ticketPlate}>GR-4582-21</Text>
            <Text style={s.ticketCode}>TRO-4821-XKWP</Text>
            <Text style={s.ticketExpiry}>Expires in 1h 45m</Text>
          </LinearGradient>
        </Animated.View>
        */}

        {/* ── Transactions ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.txSection}>
          <View style={s.txHeader}>
            <Text style={[s.sectionTitle, { color: t.text }]}>Transactions</Text>
            {hasTransactions && (
              <TouchableOpacity>
                <Text style={[s.txSeeAll, { color: c.amber500 }]}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasTransactions ? (
            MOCK_TRANSACTIONS.map((tx, i) => (
              <Animated.View key={tx.id} entering={FadeInDown.delay(250 + i * 50).duration(300)}>
                <TouchableOpacity style={[s.txRow, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }]} activeOpacity={0.7}>
                  <View style={[s.txIcon, {
                    backgroundColor: tx.amount > 0
                      ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
                      : (isDark ? 'rgba(255,173,58,0.12)' : 'rgba(255,173,58,0.08)'),
                  }]}>
                    <MaterialIcons
                      name={tx.icon}
                      size={20}
                      color={tx.amount > 0 ? '#22c55e' : c.amber500}
                    />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={[s.txLabel, { color: t.text }]}>{tx.label}</Text>
                    <Text style={[s.txDate, { color: t.textSecondary }]}>{tx.date}</Text>
                  </View>
                  <Text style={[s.txAmount, {
                    color: tx.amount > 0 ? '#22c55e' : t.text,
                  }]}>
                    {tx.amount > 0 ? '+' : ''}GH₵{Math.abs(tx.amount).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(300).duration(400)} style={s.emptyState}>
              <View style={[s.emptyIcon, {
                backgroundColor: isDark ? 'rgba(255,173,58,0.08)' : 'rgba(255,173,58,0.05)',
              }]}>
                <Wallet size={32} color={isDark ? '#44403c' : '#d6d3d1'} />
              </View>
              <Text style={[s.emptyTitle, { color: t.text }]}>No transactions yet</Text>
              <Text style={[s.emptySub, { color: t.textSecondary }]}>
                Add money to your wallet to start buying trotro tickets instantly
              </Text>
              <TouchableOpacity activeOpacity={0.8} style={s.emptyCTA}>
                <LinearGradient
                  colors={['#FF716A', '#FFAD3A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.emptyCTAGradient}
                >
                  <Plus size={18} color="#1c1917" strokeWidth={3} />
                  <Text style={s.emptyCTAText}>Add Money via MoMo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Promo card ── */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={s.promoSection}>
          <TouchableOpacity style={[s.promoCard, {
            backgroundColor: isDark ? 'rgba(255,173,58,0.06)' : 'rgba(255,173,58,0.04)',
            borderColor: isDark ? 'rgba(255,173,58,0.1)' : 'rgba(255,173,58,0.08)',
          }]} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={[s.promoTitle, { color: t.text }]}>Go cashless 🚐</Text>
              <Text style={[s.promoSub, { color: t.textSecondary }]}>
                Pay for your trotro ride with Troski Wallet. No more exact change hassle.
              </Text>
            </View>
            <ChevronRight size={20} color={c.amber500} />
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Balance card
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,173,58,0.08)',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: 'rgba(255,255,255,0.6)',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  balanceCurrency: {
    fontSize: 20,
    fontFamily: font.bold,
    color: 'rgba(255,255,255,0.5)',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 44,
    fontFamily: font.extrabold,
    color: '#ffffff',
    letterSpacing: -2,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  balancePrimaryBtn: {
    flex: 1,
  },
  balancePrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  balancePrimaryText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: '#1c1917',
  },
  balanceSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceSecondaryText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: '#ffffff',
  },

  // Quick actions
  quickSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: font.semibold,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Ticket section
  ticketSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: font.extrabold,
    letterSpacing: -0.3,
  },
  ticketCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    gap: 6,
  },
  ticketRoute: {
    fontSize: 20,
    fontFamily: font.extrabold,
    color: '#1c1917',
  },
  ticketPlate: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: 'rgba(28,25,23,0.6)',
  },
  ticketCode: {
    fontSize: 16,
    fontFamily: font.bold,
    color: '#1c1917',
    marginTop: 8,
    letterSpacing: 2,
  },
  ticketExpiry: {
    fontSize: 12,
    fontFamily: font.medium,
    color: 'rgba(28,25,23,0.5)',
  },

  // Transactions
  txSection: {
    paddingHorizontal: 16,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  txSeeAll: {
    fontSize: 13,
    fontFamily: font.bold,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txLabel: {
    fontSize: 15,
    fontFamily: font.semibold,
  },
  txDate: {
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontFamily: font.bold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: font.bold,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: font.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyCTA: {
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 40,
  },
  emptyCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyCTAText: {
    fontSize: 15,
    fontFamily: font.bold,
    color: '#1c1917',
  },

  // Promo
  promoSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  promoTitle: {
    fontSize: 15,
    fontFamily: font.bold,
  },
  promoSub: {
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 4,
    lineHeight: 18,
  },
})
