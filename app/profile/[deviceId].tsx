import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, font, themed } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { usePublicProfile } from '@/lib/hooks/usePublicProfile'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'
import FollowButton from '@/components/FollowButton'
import type { LevelSlug } from '@/lib/types'

export default function PublicProfileScreen() {
  const { deviceId: profileDeviceId } = useLocalSearchParams<{ deviceId: string }>()
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { deviceId: myDeviceId } = useApp()

  const { data: profile, isLoading } = usePublicProfile(profileDeviceId ?? null, myDeviceId)

  if (isLoading) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={c.amber500} />
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: t.textSecondary }}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: c.amber500, fontFamily: font.semibold }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const userNumber = profile.device_id.slice(-4).toUpperCase()
  const displayName = profile.display_name || `User-${userNumber}`
  const levelInfo = LEVELS[(profile.current_level as LevelSlug) ?? 'passenger']
  const isOwnProfile = myDeviceId === profileDeviceId

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <GlassBackButton isDark={isDark} />
          <Text style={s.headerTitle} numberOfLines={1}>{displayName}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            <InitialsAvatar name={displayName} size={64} />
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{displayName}</Text>
              <Text style={s.profileLevel}>{levelInfo?.emoji} {levelInfo?.name ?? 'Commuter'}</Text>
              {!isOwnProfile && (
                <View style={{ marginTop: 8 }}>
                  <FollowButton
                    myDeviceId={myDeviceId}
                    targetDeviceId={profileDeviceId!}
                    initialFollowing={profile.is_following}
                    size="md"
                  />
                </View>
              )}
            </View>
          </View>

          {profile.bio && (
            <Text style={s.bio}>{profile.bio}</Text>
          )}

          {profile.home_route_label && (
            <View style={s.routeRow}>
              <MapPin size={14} color={c.pink500} />
              <Text style={s.routeText}>{profile.home_route_label}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <TouchableOpacity
            style={s.statBox}
            onPress={() => router.push(`/profile/followers?id=${profileDeviceId}&tab=followers` as Href)}
          >
            <Text style={s.statValue}>{profile.follower_count}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.statBox, s.statBorder]}
            onPress={() => router.push(`/profile/followers?id=${profileDeviceId}&tab=following` as Href)}
          >
            <Text style={s.statValue}>{profile.following_count}</Text>
            <Text style={s.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={[s.statBox, s.statBorder]}>
            <Text style={s.statValue}>{profile.total_points}</Text>
            <Text style={s.statLabel}>Points</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{profile.tale_count ?? 0}</Text>
            <Text style={s.statLabel}>Tales</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    profileCard: {
      margin: 20,
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.card,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    profileInfo: { marginLeft: 16, flex: 1 },
    profileName: { fontSize: 18, fontFamily: font.bold, color: t.text },
    profileLevel: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
    bio: { fontSize: 14, color: isDark ? c.stone300 : c.stone600, marginTop: 16, lineHeight: 20 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    routeText: { fontSize: 12, color: t.textSecondary },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.card,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statBorder: { borderLeftWidth: 1, borderColor: t.border },
    statValue: { fontSize: 20, fontFamily: font.bold, color: t.text },
    statLabel: { fontSize: 11, color: t.textSecondary, marginTop: 2 },
  })
}
