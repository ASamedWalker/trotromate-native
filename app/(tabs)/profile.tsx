import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { Settings, Bell, Shield, HelpCircle, ChevronRight, Edit3, MapPin } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { LEVELS } from '@/lib/constants/rewards'
import { SpendingSummary } from '@/components/SpendingSummary'
import InitialsAvatar from '@/components/InitialsAvatar'

export default function ProfileScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const { profile, deviceId } = useApp()
  const { unreadCount } = useNotifications(deviceId)
  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']

  const menuItems: Array<{ icon: typeof Bell; label: string; onPress: () => void; badge?: number }> = [
    { icon: Bell, label: 'Notifications', onPress: () => router.push('/notifications' as Href), badge: unreadCount },
    { icon: Settings, label: 'Settings', onPress: () => router.push('/settings' as Href) },
    { icon: Shield, label: 'Privacy', onPress: () => router.push('/privacy' as Href) },
    { icon: HelpCircle, label: 'Help & Support', onPress: () => router.push('/terms' as Href) },
  ]

  return (
    <SafeAreaView style={s.container}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => router.push('/settings/edit-profile' as Href)}
            style={s.editBtn}
            activeOpacity={0.7}
          >
            <Edit3 size={18} color={isDark ? c.stone300 : c.stone600} />
          </TouchableOpacity>
        </View>

        {/* Avatar Card */}
        <View style={s.avatarCard}>
          <InitialsAvatar
            name={profile?.display_name}
            deviceId={deviceId ?? undefined}
            size={60}
          />
          <View style={s.avatarInfo}>
            <Text style={s.avatarName}>{profile?.display_name ?? 'Commuter'}</Text>
            <Text style={s.avatarSub}>{levelInfo.emoji} {levelInfo.name}</Text>
          </View>
        </View>

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
        <View style={s.statsRow}>
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
        </View>

        {/* Monthly Spending Summary */}
        <SpendingSummary />

        {/* Menu */}
        <View style={s.menuCard}>
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <TouchableOpacity
                key={item.label}
                style={[s.menuItem, index < menuItems.length - 1 && s.menuBorder]}
                activeOpacity={0.6}
                onPress={item.onPress}
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
        </View>

        {/* App Info */}
        <View style={s.footer}>
          <Text style={s.version}>Troski v1.0.0</Text>
          <Text style={s.footerText}>Made with love in Accra</Text>
        </View>
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
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: isDark ? '#f5f5f4' : '#1c1917' },
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
      padding: 20,
      borderRadius: 20,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
    },
    avatarInfo: { marginLeft: 16, flex: 1 },
    avatarName: { fontSize: 18, fontFamily: font.bold, color: isDark ? '#f5f5f4' : '#1c1917' },
    avatarSub: { fontSize: 13, color: isDark ? '#a8a29e' : '#78716c', marginTop: 2 },
    bioCard: {
      marginHorizontal: 20,
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
    },
    bioText: { fontSize: 14, color: isDark ? c.stone300 : c.stone600, lineHeight: 20 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    routeText: { fontSize: 12, color: isDark ? c.stone400 : c.stone500 },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 20,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
    },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: {
      borderLeftWidth: 1,
      borderColor: isDark ? '#292524' : '#e7e5e3',
    },
    statValue: { fontSize: 20, fontFamily: font.bold, color: isDark ? '#f5f5f4' : '#1c1917' },
    statLabel: { fontSize: 11, color: isDark ? '#a8a29e' : '#78716c', marginTop: 2 },
    menuCard: {
      marginHorizontal: 20,
      borderRadius: 20,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      overflow: 'hidden',
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
    footerText: { fontSize: 12, color: isDark ? '#57534e' : '#a8a29e', marginTop: 4 },
  })
