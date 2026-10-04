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
import { brand, ui, space, radius, type, cardShadow, font } from '@/lib/theme'
import { Button } from '@/components/ui'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useApp } from '@/lib/contexts/AppContext'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { LEVELS } from '@/lib/constants/rewards'
import { SpendingSummary } from '@/components/SpendingSummary'
import InitialsAvatar from '@/components/InitialsAvatar'

export default function ProfileScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { profile, deviceId, resetIdentity } = useApp()
  // Real sign-in state comes from the Supabase session, not onboarding: an
  // onboarded phone can have no session (requests then go out signed out).
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext()
  const phoneLabel = user?.phone ? formatPhone(user.phone) : null
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
            <Edit3 size={18} color={ui.text} />
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
                <Flame size={10} color={ui.onBrand} />
              </View>
            )}
          </View>
          <View style={s.avatarInfo}>
            <Text style={s.avatarName}>{profile?.display_name ?? 'Commuter'}</Text>
            {!authLoading && (
              <Text style={s.phoneLine} accessibilityLabel={phoneLabel ? `Signed in as ${phoneLabel}` : 'Not signed in'}>
                {phoneLabel ?? 'Not signed in'}
              </Text>
            )}
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
                <MapPin size={14} color={brand.orange} />
                <Text style={s.routeText}>{profile.home_route_label}</Text>
              </View>
            )}
          </View>
        ) : profile?.home_route_label ? (
          <View style={s.bioCard}>
            <View style={s.routeRow}>
              <MapPin size={14} color={brand.orange} />
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
        <View style={{ height: space.lg }} />

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
                <Icon size={20} color={ui.textSecondary} />
                <Text style={s.menuLabel}>{item.label}</Text>
                {item.badge != null && item.badge > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <ChevronRight size={18} color={ui.textTertiary} />
              </TouchableOpacity>
            )
          })}
        </Animated.View>

        {/* Sign in / Sign out: follows the real session */}
        {!authLoading && (
        <Animated.View entering={FadeInDown.delay(440).duration(400)} style={{ paddingHorizontal: space.gutter, marginTop: space.md }}>
          {isAuthenticated ? (
          <Button
            label="Sign Out"
            variant="danger"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              const { Alert } = require('react-native')
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    const { signOutAndWipe } = require('@/lib/services/signOut')
                    await signOutAndWipe(resetIdentity)
                    router.replace({ pathname: '/auth/phone', params: { from: 'signout' } } as any)
                  },
                },
              ])
            }}
          />
          ) : (
          <Button
            label="Sign in"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/auth/phone' as any)
            }}
          />
          )}
        </Animated.View>
        )}

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
    container: { flex: 1, backgroundColor: isDark ? '#0c0a09' : ui.bg },
    scroll: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
      paddingBottom: space.sm,
    },
    headerTitle: { ...type.title, color: isDark ? '#f5f5f4' : ui.text },
    editBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#292524' : ui.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: space.gutter,
      marginTop: space.lg,
      padding: space.gutter,
      borderRadius: radius.lg,
      backgroundColor: isDark ? '#1c1917' : ui.card,
      ...(isDark ? {} : cardShadow),
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
      backgroundColor: brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1c1917' : ui.card,
    },
    avatarInfo: { marginLeft: space.lg, flex: 1 },
    avatarName: { ...type.headline, fontSize: 20, color: isDark ? '#f5f5f4' : ui.text },
    phoneLine: { fontFamily: font.medium, fontSize: 14, color: ui.textSecondary, marginTop: 2 },
    levelPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    levelEmoji: { fontSize: 13, lineHeight: 18 },
    levelText: { fontSize: 12, fontFamily: font.semibold },
    bioCard: {
      marginHorizontal: space.gutter,
      marginTop: space.md,
      paddingHorizontal: space.xl,
      paddingVertical: 14,
      borderRadius: radius.lg,
      backgroundColor: isDark ? '#1c1917' : ui.card,
      ...(isDark ? {} : cardShadow),
    },
    bioText: { ...type.label, fontFamily: font.regular, color: isDark ? '#d6d3d1' : ui.textSecondary },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    routeText: { ...type.caption, color: isDark ? '#a8a29e' : ui.textSecondary },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: space.gutter,
      marginTop: space.lg,
      marginBottom: space.xl,
      padding: space.lg,
      borderRadius: radius.lg,
      backgroundColor: isDark ? '#1c1917' : ui.card,
      ...(isDark ? {} : cardShadow),
    },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: {
      borderLeftWidth: 1,
      borderColor: isDark ? '#292524' : ui.hairline,
    },
    statValue: { fontSize: 22, fontFamily: font.extrabold, color: isDark ? '#f5f5f4' : ui.text, letterSpacing: -0.5 },
    statLabel: { ...type.caption, color: isDark ? '#a8a29e' : ui.textSecondary, marginTop: 4 },
    menuCard: {
      marginHorizontal: space.gutter,
      borderRadius: radius.lg,
      backgroundColor: isDark ? '#1c1917' : ui.card,
      overflow: 'hidden',
      ...(isDark ? {} : cardShadow),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.lg,
      paddingHorizontal: space.xl,
    },
    menuBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#292524' : ui.hairline,
    },
    menuLabel: {
      ...type.bodyMedium,
      flex: 1,
      marginLeft: 14,
      color: isDark ? '#e7e5e3' : ui.text,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: ui.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginRight: 8,
    },
    badgeText: {
      color: ui.onBrand,
      fontSize: 11,
      fontFamily: font.bold,
    },
    footer: { alignItems: 'center', paddingVertical: space.xxl },
    version: { ...type.labelStrong, color: ui.textSecondary },
    footerText: { ...type.caption, color: isDark ? '#78716c' : ui.textTertiary, marginTop: 4 },
    footerSub: { ...type.caption, color: isDark ? '#44403c' : ui.textTertiary, marginTop: 2 },
  })

/** +233200000000 -> +233 20 000 0000 (other countries: as stored) */
function formatPhone(raw: string): string {
  const p = raw.startsWith('+') ? raw : `+${raw}`
  const m = p.match(/^\+233(\d{2})(\d{3})(\d{4})$/)
  return m ? `+233 ${m[1]} ${m[2]} ${m[3]}` : p
}
