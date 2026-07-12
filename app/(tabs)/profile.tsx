import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Linking } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Settings, Bell, Shield, HelpCircle, ChevronRight, Edit3, MapPin, Flame, Megaphone, Trophy } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useApp } from '@/lib/contexts/AppContext'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { LEVELS } from '@/lib/constants/rewards'
import { SpendingSummary } from '@/components/SpendingSummary'
import InitialsAvatar from '@/components/InitialsAvatar'

export default function ProfileScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { profile, deviceId } = useApp()
  const { unreadCount } = useNotifications(deviceId)
  const insets = useSafeAreaInsets()
  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']

  const menuItems: { icon: typeof Bell; label: string; onPress: () => void; badge?: number }[] = [
    { icon: Trophy, label: 'Rewards', onPress: () => router.push('/(tabs)/rewards' as Href) },
    { icon: Bell, label: 'Notifications', onPress: () => router.navigate('/activity' as Href), badge: unreadCount },
    { icon: Megaphone, label: 'Contribute / Report', onPress: () => router.push('/report' as Href) },
    { icon: Settings, label: 'Settings', onPress: () => router.push('/settings' as Href) },
    { icon: Shield, label: 'Privacy', onPress: () => router.push('/privacy' as Href) },
    { icon: HelpCircle, label: 'Help & Support', onPress: () => Linking.openURL('mailto:support@troski.me?subject=Troski%20Help%20%26%20Support').catch(() => {}) },
  ]

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={s.headerTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings/edit-profile' as Href) }}
            style={s.editBtn}
            activeOpacity={0.7}
          >
            <Edit3 size={18} color={isDark ? c.stone300 : c.stone600} />
          </TouchableOpacity>
        </Animated.View>

        {/* Avatar Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.avatarCard}>
          <View style={[s.avatarRing, { borderColor: levelInfo.color }]}>
            <InitialsAvatar
              name={profile?.display_name}
              deviceId={deviceId ?? undefined}
              size={64}
            />
            {(profile?.current_streak ?? 0) > 0 && (
              <View style={s.streakBadge}>
                <Flame size={10} color={c.white} />
              </View>
            )}
          </View>
          <View style={s.avatarInfo}>
            <Text style={s.avatarName}>{profile?.display_name ?? 'Commuter'}</Text>
            <View style={[s.levelPill, { backgroundColor: `${levelInfo.color}18` }]}>
              <Text style={s.levelEmoji}>{levelInfo.emoji}</Text>
              <Text style={[s.levelText, { color: levelInfo.color }]}>{levelInfo.name}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bio */}
        {profile?.bio ? (
          <View style={s.bioCard}>
            <Text style={s.bioText}>{profile.bio}</Text>
            {profile.home_route_label && (
              <View style={s.routeRow}>
                <MapPin size={14} color={c.pink500} />
                <Text style={s.routeText}>{profile.home_route_label}</Text>
              </View>
            )}
          </View>
        ) : profile?.home_route_label ? (
          <View style={s.bioCard}>
            <View style={s.routeRow}>
              <MapPin size={14} color={c.pink500} />
              <Text style={s.routeText}>{profile.home_route_label}</Text>
            </View>
          </View>
        ) : null}

        {/* Stats Row */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.statsRow}>
          <TouchableOpacity
            style={s.statBox}
            onPress={() => deviceId && router.push(`/profile/followers?id=${deviceId}&tab=followers` as Href)}
          >
            <Text style={s.statValue}>{profile?.follower_count ?? 0}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.statBox, s.statBorder]}
            onPress={() => deviceId && router.push(`/profile/followers?id=${deviceId}&tab=following` as Href)}
          >
            <Text style={s.statValue}>{profile?.following_count ?? 0}</Text>
            <Text style={s.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={[s.statBox, s.statBorder]}>
            <Text style={s.statValue}>{profile?.total_points ?? 0}</Text>
            <Text style={s.statLabel}>Points</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{profile?.current_streak ?? 0}</Text>
            <Text style={s.statLabel}>Streak</Text>
          </View>
        </Animated.View>

        {/* Monthly Spending Summary */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          <SpendingSummary />
        </Animated.View>
        <View style={{ height: 16 }} />

        {/* Menu */}
        <Animated.View entering={FadeInDown.delay(360).duration(400)} style={s.menuCard}>
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <TouchableOpacity
                key={item.label}
                style={[s.menuItem, index < menuItems.length - 1 && s.menuBorder]}
                activeOpacity={0.6}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress() }}
              >
                <Icon size={20} color={isDark ? '#a8a29e' : '#78716c'} />
                <Text style={s.menuLabel}>{item.label}</Text>
                {item.badge != null && item.badge > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <ChevronRight size={18} color={isDark ? '#57534e' : '#a8a29e'} />
              </TouchableOpacity>
            )
          })}
        </Animated.View>

        {/* Sign Out */}
        <Animated.View entering={FadeInDown.delay(440).duration(400)} style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              const { Alert } = require('react-native')
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    const { supabase } = require('@/lib/supabase/client')
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default
                    await supabase.auth.signOut()
                    await AsyncStorage.setItem('troski_signed_out', 'true')
                    router.replace('/auth/phone' as any)
                  },
                },
              ])
            }}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FECACA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={FadeInDown.delay(480).duration(400)} style={s.footer}>
          <Text style={s.version}>Troski v1.1.2</Text>
          <Text style={s.footerText}>Troski Technologies</Text>
          <Text style={s.footerSub}>Accra, Ghana</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0c0a09' : '#fafaf9' },
    scroll: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 28, fontFamily: font.extrabold, color: isDark ? '#f5f5f4' : '#1c1917', letterSpacing: -0.5 },
    editBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 20,
      marginBottom: 0,
      padding: 24,
      borderRadius: 16,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }),
    },
    avatarRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#f97316',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1c1917' : '#ffffff',
    },
    avatarInfo: { marginLeft: 16, flex: 1 },
    avatarName: { fontSize: 20, fontFamily: font.bold, color: isDark ? '#f5f5f4' : '#1c1917', letterSpacing: -0.3 },
    levelPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    levelEmoji: { fontSize: 13 },
    levelText: { fontSize: 12, fontFamily: font.semibold },
    bioCard: {
      marginHorizontal: 20,
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }),
    },
    bioText: { fontSize: 14, color: isDark ? c.stone300 : c.stone600, lineHeight: 20 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    routeText: { fontSize: 12, color: isDark ? c.stone400 : c.stone500 },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 20,
      padding: 18,
      borderRadius: 14,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }),
    },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: {
      borderLeftWidth: 1,
      borderColor: isDark ? '#292524' : '#e7e5e3',
    },
    statValue: { fontSize: 22, fontFamily: font.extrabold, color: isDark ? '#f5f5f4' : '#1c1917', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, fontFamily: font.medium, color: isDark ? '#a8a29e' : '#78716c', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    menuCard: {
      marginHorizontal: 20,
      borderRadius: 14,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      overflow: 'hidden',
      ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    menuBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#292524' : '#f5f5f4',
    },
    menuLabel: {
      flex: 1,
      marginLeft: 14,
      fontSize: 15,
      color: isDark ? '#e7e5e3' : '#1c1917',
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.red500,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginRight: 8,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 11,
      fontFamily: font.bold,
    },
    footer: { alignItems: 'center', paddingVertical: 32 },
    version: { fontSize: 13, fontFamily: font.semibold, color: '#f59e0b' },
    footerText: { fontSize: 12, fontFamily: font.medium, color: isDark ? '#78716c' : '#a8a29e', marginTop: 4 },
    footerSub: { fontSize: 11, color: isDark ? '#44403c' : '#d6d3d1', marginTop: 2 },
  })
