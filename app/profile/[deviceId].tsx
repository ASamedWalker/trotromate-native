import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { MapPin, Calendar, Award, ImageIcon, Heart, MessageCircle } from 'lucide-react-native'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, font, themed } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { usePublicProfile } from '@/lib/hooks/usePublicProfile'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'
import FollowButton from '@/components/FollowButton'
import type { LevelSlug } from '@/lib/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const TALE_SIZE = (SCREEN_WIDTH - 40 - 8) / 3 // 3 columns with 4px gaps

export default function PublicProfileScreen() {
  const { deviceId: profileDeviceId } = useLocalSearchParams<{ deviceId: string }>()
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { deviceId: myDeviceId } = useApp()

  const { data, isLoading } = usePublicProfile(profileDeviceId ?? null, myDeviceId)

  if (isLoading) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={c.amber500} />
      </SafeAreaView>
    )
  }

  if (!data?.profile) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: t.textSecondary }}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: c.amber500, fontFamily: font.semibold }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const { profile, badges, tales } = data
  const userNumber = profile.device_id.slice(-4).toUpperCase()
  const displayName = profile.display_name || `User-${userNumber}`
  const levelInfo = LEVELS[(profile.current_level as LevelSlug) ?? 'passenger']
  const isOwnProfile = myDeviceId === profileDeviceId
  const joinDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null

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

          {/* Meta row — route + join date */}
          <View style={s.metaRow}>
            {profile.home_route_label && (
              <View style={s.metaItem}>
                <MapPin size={13} color={t.textSecondary} />
                <Text style={s.metaText}>{profile.home_route_label}</Text>
              </View>
            )}
            {joinDate && (
              <View style={s.metaItem}>
                <Calendar size={13} color={t.textSecondary} />
                <Text style={s.metaText}>Joined {joinDate}</Text>
              </View>
            )}
          </View>
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

        {/* Badges */}
        {badges.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Award size={16} color={c.amber500} />
              <Text style={s.sectionTitle}>Badges</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgeScroll}>
              {badges.map((badge) => (
                <View key={badge.id} style={s.badgeCard}>
                  <Text style={s.badgeIcon}>{badge.icon}</Text>
                  <Text style={s.badgeName} numberOfLines={1}>{badge.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Contribution Stats */}
        <View style={s.section}>
          <View style={s.contribRow}>
            <View style={s.contribItem}>
              <Text style={s.contribValue}>{profile.total_reports}</Text>
              <Text style={s.contribLabel}>Reports</Text>
            </View>
            <View style={s.contribDivider} />
            <View style={s.contribItem}>
              <Text style={s.contribValue}>{profile.current_streak}</Text>
              <Text style={s.contribLabel}>Streak</Text>
            </View>
            <View style={s.contribDivider} />
            <View style={s.contribItem}>
              <Text style={s.contribValue}>{badges.length}</Text>
              <Text style={s.contribLabel}>Badges</Text>
            </View>
          </View>
        </View>

        {/* Tales Grid */}
        {tales.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <ImageIcon size={16} color={c.amber500} />
              <Text style={s.sectionTitle}>Tales</Text>
            </View>
            <View style={s.taleGrid}>
              {tales.map((tale) => (
                <TouchableOpacity key={tale.id} style={s.taleItem} activeOpacity={0.8}>
                  <Image source={{ uri: tale.image_url }} style={s.taleImage} />
                  <View style={s.taleOverlay}>
                    <View style={s.taleStat}>
                      <Heart size={12} color="#FFF" fill="#FFF" />
                      <Text style={s.taleStatText}>{tale.like_count}</Text>
                    </View>
                    <View style={s.taleStat}>
                      <MessageCircle size={12} color="#FFF" fill="#FFF" />
                      <Text style={s.taleStatText}>{tale.comment_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tales.length === 0 && (
          <View style={s.emptyTales}>
            <ImageIcon size={32} color={t.textSecondary} />
            <Text style={s.emptyText}>No tales yet</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
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
      marginBottom: 12,
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.card,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    profileInfo: { marginLeft: 16, flex: 1 },
    profileName: { fontSize: 18, fontFamily: font.bold, color: t.text },
    profileLevel: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
    bio: { fontSize: 14, color: isDark ? c.stone300 : c.stone600, marginTop: 16, lineHeight: 20 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 12, color: t.textSecondary, fontFamily: font.regular },
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

    // Sections
    section: { marginTop: 16, paddingHorizontal: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontFamily: font.bold, color: t.text },

    // Badges
    badgeScroll: { gap: 10, paddingRight: 20 },
    badgeCard: {
      backgroundColor: t.card,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      minWidth: 80,
    },
    badgeIcon: { fontSize: 28, marginBottom: 6 },
    badgeName: { fontSize: 11, fontFamily: font.semibold, color: t.text, textAlign: 'center' },

    // Contributions
    contribRow: {
      flexDirection: 'row',
      backgroundColor: t.card,
      borderRadius: 16,
      paddingVertical: 16,
    },
    contribItem: { flex: 1, alignItems: 'center' },
    contribValue: { fontSize: 20, fontFamily: font.bold, color: c.amber500 },
    contribLabel: { fontSize: 11, color: t.textSecondary, marginTop: 2 },
    contribDivider: { width: 1, height: 28, backgroundColor: t.border },

    // Tales grid
    taleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    taleItem: {
      width: TALE_SIZE,
      height: TALE_SIZE,
      borderRadius: 8,
      overflow: 'hidden',
    },
    taleImage: {
      width: '100%',
      height: '100%',
    },
    taleOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    taleStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    taleStatText: { fontSize: 11, color: '#FFF', fontFamily: font.semibold },

    // Empty
    emptyTales: {
      marginTop: 20,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 32,
    },
    emptyText: { fontSize: 14, color: t.textSecondary },
  })
}
