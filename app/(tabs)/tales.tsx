import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { c, font, themed } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function WalletScreen() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      {/* Header */}
      <Text style={[styles.header, { color: t.text }]}>Wallet</Text>

      {/* Balance card */}
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.balanceCard, {
        backgroundColor: isDark ? '#1c1917' : '#ffffff',
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
          android: { elevation: 4 },
        }),
      }]}>
        <Text style={[styles.balanceLabel, { color: t.textSecondary }]}>Available Balance</Text>
        <Text style={[styles.balanceAmount, { color: t.text }]}>
          GH₵ <Text style={{ color: c.amber500 }}>0</Text>
          <Text style={{ color: t.textSecondary, fontSize: 20 }}>.00</Text>
        </Text>

        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.balanceBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF716A', '#FFAD3A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceBtnGradient}
            >
              <MaterialIcons name="add" size={20} color="#1c1917" />
              <Text style={styles.balanceBtnText}>Add Money</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.balanceBtnOutline, {
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }]} activeOpacity={0.8}>
            <MaterialIcons name="qr-code-scanner" size={20} color={c.amber500} />
            <Text style={[styles.balanceBtnOutlineText, { color: t.text }]}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Quick actions */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.quickActions}>
        {[
          { icon: 'confirmation-number' as const, label: 'Buy Ticket', color: '#FFAD3A' },
          { icon: 'history' as const, label: 'History', color: '#60a5fa' },
          { icon: 'account-balance' as const, label: 'Withdraw', color: '#22c55e' },
        ].map((action) => (
          <TouchableOpacity key={action.label} style={[styles.quickAction, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }]} activeOpacity={0.7}>
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
              <MaterialIcons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={[styles.quickActionLabel, { color: t.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Empty state */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyState}>
        <MaterialIcons name="account-balance-wallet" size={48} color={isDark ? '#44403c' : '#d6d3d1'} />
        <Text style={[styles.emptyTitle, { color: t.text }]}>No transactions yet</Text>
        <Text style={[styles.emptySub, { color: t.textSecondary }]}>
          Add money to your wallet and start buying trotro tickets
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    fontSize: 24,
    fontFamily: font.extrabold,
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: font.medium,
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: font.extrabold,
    letterSpacing: -1.5,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceBtn: {
    flex: 1,
  },
  balanceBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  balanceBtnText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: '#1c1917',
  },
  balanceBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceBtnOutlineText: {
    fontSize: 14,
    fontFamily: font.bold,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontFamily: font.semibold,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 40,
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
})
