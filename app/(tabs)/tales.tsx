import { useState } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Wallet, Eye, EyeOff, Plus, QrCode, ArrowDownToLine, Receipt, Clock, ArrowUpFromLine, ChevronRight } from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

export default function WalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const balance = 0.00
  const hasTransactions = false
  const hasActiveTicket = false

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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: t.text }]}>Wallet</Text>
        <TouchableOpacity onPress={toggleBalance} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {balanceVisible
            ? <Eye size={22} color={t.textSecondary} />
            : <EyeOff size={22} color={t.textSecondary} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber500} colors={[c.amber500]} />
        }
      >
        {/* ── Balance Card ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.balanceWrap}>
          <View style={[styles.balanceCard, {
            backgroundColor: isDark ? '#1c1917' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          }]}>
            <Text style={[styles.balanceLabel, { color: t.textSecondary }]}>Total Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceCurrency, { color: isDark ? '#FFAD3A' : '#1c1917' }]}>₵</Text>
              <Text style={[styles.balanceAmount, { color: isDark ? '#ffffff' : '#1c1917' }]}>
                {balanceVisible ? balance.toLocaleString('en', { minimumFractionDigits: 2 }) : '••••••'}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.balanceBtns}>
              <TouchableOpacity style={styles.balanceBtnPrimary} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#FFAD3A', '#f59e0b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.balanceBtnGradient}
                >
                  <Plus size={16} color="#1c1917" strokeWidth={3} />
                  <Text style={styles.balanceBtnPrimaryText}>Add Money</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.balanceBtnSecondary, {
                backgroundColor: isDark ? '#292524' : '#f5f5f4',
              }]} activeOpacity={0.85}>
                <ArrowDownToLine size={16} color={isDark ? '#fafaf9' : '#1c1917'} />
                <Text style={[styles.balanceBtnSecondaryText, { color: isDark ? '#fafaf9' : '#1c1917' }]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── Quick Actions ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.quickRow}>
          {[
            { Icon: Receipt, label: 'Buy Ticket', color: '#FFAD3A' },
            { Icon: QrCode, label: 'Scan QR', color: '#22c55e' },
            { Icon: Clock, label: 'History', color: '#60a5fa' },
            { Icon: ArrowUpFromLine, label: 'Top Up', color: '#a78bfa' },
          ].map((a, i) => (
            <TouchableOpacity key={a.label} style={styles.quickItem} activeOpacity={0.7}>
              <Animated.View entering={FadeInDown.delay(120 + i * 50).duration(300)} style={{ alignItems: 'center' }}>
                <View style={[styles.quickCircle, { backgroundColor: a.color + (isDark ? '18' : '10') }]}>
                  <a.Icon size={20} color={a.color} />
                </View>
                <Text style={[styles.quickLabel, { color: t.text }]}>{a.label}</Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── Active Ticket (when purchased) ── */}
        {hasActiveTicket && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.ticketWrap}>
            <LinearGradient
              colors={['#FFAD3A', '#f97316']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ticketCard}
            >
              <View style={styles.ticketTop}>
                <View>
                  <Text style={styles.ticketRouteLabel}>Circle → Madina</Text>
                  <Text style={styles.ticketPlate}>GT 4821-14</Text>
                </View>
                <View style={styles.ticketQR}>
                  <QrCode size={28} color="rgba(0,0,0,0.2)" />
                </View>
              </View>
              <View style={styles.ticketBottom}>
                <View>
                  <Text style={styles.ticketCodeLabel}>Trip Code</Text>
                  <Text style={styles.ticketCode}>TRP-BA27</Text>
                </View>
                <View style={styles.ticketTimerWrap}>
                  <Clock size={14} color="rgba(0,0,0,0.5)" />
                  <Text style={styles.ticketTimer}>18 min</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Transactions / Empty State ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.txSection}>
          {hasTransactions ? (
            <>
              <View style={styles.txHeader}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Recent Transactions</Text>
                <TouchableOpacity>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: c.amber500 }}>See all</Text>
                </TouchableOpacity>
              </View>
              {/* Transaction rows would go here */}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, {
                backgroundColor: isDark ? 'rgba(255,173,58,0.08)' : 'rgba(255,173,58,0.05)',
              }]}>
                <Wallet size={36} color={isDark ? '#57534e' : '#d6d3d1'} />
              </View>
              <Text style={[styles.emptyTitle, { color: t.text }]}>No transactions yet</Text>
              <Text style={[styles.emptySub, { color: t.textSecondary }]}>
                Start by adding money or buying{'\n'}your first ticket
              </Text>
              <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#FFAD3A', '#f59e0b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyBtnGradient}
                >
                  <Plus size={16} color="#1c1917" strokeWidth={3} />
                  <Text style={styles.emptyBtnText}>Add Money</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* ── Promo Banner ── */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.promoWrap}>
          <LinearGradient
            colors={isDark ? ['#292524', '#1c1917'] : ['#1c1917', '#292524']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoCard}
          >
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Go Cashless{'\n'}on Every Ride</Text>
              <Text style={styles.promoSub}>Quick. Safe. Convenient.</Text>
              <TouchableOpacity style={styles.promoBtn} activeOpacity={0.8}>
                <Text style={styles.promoBtnText}>Learn More</Text>
                <ChevronRight size={14} color="#1c1917" />
              </TouchableOpacity>
            </View>
            <Image
              source={require('@/assets/images/new_troski_view.png')}
              style={styles.promoImage}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: font.extrabold,
    letterSpacing: -0.5,
  },

  // Balance
  balanceWrap: { paddingHorizontal: 16 },
  balanceCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: font.medium,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  balanceCurrency: {
    fontSize: 28,
    fontFamily: font.extrabold,
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 40,
    fontFamily: font.extrabold,
    letterSpacing: -1.5,
  },
  balanceBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceBtnPrimary: { flex: 1 },
  balanceBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  balanceBtnPrimaryText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: '#1c1917',
  },
  balanceBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  balanceBtnSecondaryText: {
    fontSize: 14,
    fontFamily: font.bold,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  quickItem: { alignItems: 'center' },
  quickCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontFamily: font.semibold,
    textAlign: 'center',
  },

  // Ticket
  ticketWrap: { paddingHorizontal: 16, marginBottom: 20 },
  ticketCard: {
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketRouteLabel: {
    fontSize: 18,
    fontFamily: font.extrabold,
    color: '#1c1917',
  },
  ticketPlate: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: 'rgba(28,25,23,0.5)',
    marginTop: 2,
  },
  ticketQR: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCodeLabel: {
    fontSize: 10,
    fontFamily: font.semibold,
    color: 'rgba(28,25,23,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ticketCode: {
    fontSize: 16,
    fontFamily: font.extrabold,
    color: '#1c1917',
    letterSpacing: 1,
  },
  ticketTimerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  ticketTimer: {
    fontSize: 13,
    fontFamily: font.bold,
    color: 'rgba(28,25,23,0.7)',
  },

  // Transactions
  txSection: { paddingHorizontal: 16 },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: font.bold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
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
  },
  emptyBtn: { marginTop: 12 },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: '#1c1917',
  },

  // Promo
  promoWrap: { paddingHorizontal: 16, marginTop: 20 },
  promoCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  promoContent: { flex: 1 },
  promoTitle: {
    fontSize: 18,
    fontFamily: font.extrabold,
    color: '#ffffff',
    lineHeight: 24,
  },
  promoSub: {
    fontSize: 12,
    fontFamily: font.regular,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFAD3A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  promoBtnText: {
    fontSize: 12,
    fontFamily: font.bold,
    color: '#1c1917',
  },
  promoImage: {
    width: 90,
    height: 90,
    marginLeft: 8,
  },
})
