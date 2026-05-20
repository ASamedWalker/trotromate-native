import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { MapPin, Calendar, Award, Star, Flame, Map, Sunrise, Moon, Shield, Coins, Users, Trophy, CalendarDays, Bus, FileText, Zap, BookOpen, ChevronRight } from 'lucide-react-native'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, font, themed } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { usePublicProfile } from '@/lib/hooks/usePublicProfile'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'
import FollowButton from '@/components/FollowButton'
import type { LevelSlug } from '@/lib/types'

const BADGE_ICONS: Record<string, any> = {
  star: Star, flame: Flame, map: Map, sunrise: Sunrise, moon: Moon,
  shield: Shield, coins: Coins, users: Users, trophy: Trophy, calendar: CalendarDays,
}

const BADGE_COLORS: Record<string, string> = {
  amber: '#F59E0B', orange: '#F97316', emerald: '#10B981', violet: '#8B5CF6',
}

export default function PublicProfileScreen() {
  const { deviceId: profileDeviceId } = useLocalSearchParams<{ deviceId: string }>()
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])
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

  const { profile, badges } = data
  const displayName = profile.display_name || `User-${profile.device_id.slice(-4).toUpperCase()}`
  const levelInfo = LEVELS[(profile.current_level as LevelSlug) ?? 'passenger']
  const isOwnProfile = myDeviceId === profileDeviceId
  const joinDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null

  // XP progress (points within current level)
  const xpThresholds = [0, 50, 150, 300, 500, 1000, 2000]
  const currentXP = profile.total_points
  let levelIdx = xpThresholds.findIndex((t) => currentXP < t)
  if (levelIdx === -1) levelIdx = xpThresholds.length
  const prevThreshold = xpThresholds[Math.max(0, levelIdx - 1)] || 0
  const nextThreshold = xpThresholds[levelIdx] || currentXP + 200
  const xpInLevel = currentXP - prevThreshold
  const xpNeeded = nextThreshold - prevThreshold
  const xpPercent = Math.min((xpInLevel / xpNeeded) * 100, 100)

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <GlassBackButton isDark={isDark} />
          <Text style={s.headerTitle} numberOfLines={1}>{displayName}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar + Name + Level */}
        <View style={s.profileSection}>
          <View style={s.avatarRing}>
            <InitialsAvatar name={displayName} size={80} />
          </View>
          <Text style={s.profileName}>{displayName}</Text>
          <View style={s.levelPill}>
            <Text style={s.levelEmoji}>{levelInfo?.emoji}</Text>
            <Text style={s.levelText}>{levelInfo?.name ?? 'Commuter'}</Text>
          </View>
          {!isOwnProfile && (
            <View style={{ marginTop: 10 }}>
              <FollowButton
                myDeviceId={myDeviceId}
                targetDeviceId={profileDeviceId!}
                initialFollowing={profile.is_following}
                size="md"
              />
            </View>
          )}
          {/* Meta */}
          <View style={s.metaRow}>
            {profile.home_route_label && (
              <View style={s.metaItem}>
                <MapPin size={12} color={t.textSecondary} />
                <Text style={s.metaText}>{profile.home_route_label}</Text>
              </View>
            )}
            {joinDate && (
              <View style={s.metaItem}>
                <Calendar size={12} color={t.textSecondary} />
                <Text style={s.metaText}>Joined {joinDate}</Text>
              </View>
            )}
          </View>
        </View>

        {/* XP Progress */}
        <View style={s.xpCard}>
          <View style={s.xpHeader}>
            <View>
              <Text style={s.xpLabel}>CURRENT XP</Text>
              <Text style={s.xpValue}>{currentXP} <Text style={s.xpTotal}>/ {nextThreshold}</Text></Text>
            </View>
            <Text style={s.xpRemaining}>{Math.max(0, nextThreshold - currentXP)} to next level</Text>
          </View>
          <View style={s.xpBarBg}>
            <View style={[s.xpBarFill, { width: `${xpPercent}%` }]} />
          </View>
        </View>

        {/* Stats Grid 2x2 */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Bus size={20} color={c.amber600} />
            <Text style={s.statCardValue}>{profile.total_reports}</Text>
            <Text style={s.statCardLabel}>Reports</Text>
          </View>
          <View style={s.statCard}>
            <Zap size={20} color={c.amber600} />
            <Text style={s.statCardValue}>{profile.current_streak}</Text>
            <Text style={s.statCardLabel}>Streak</Text>
          </View>
          <View style={s.statCard}>
            <Star size={20} color={c.amber600} />
            <Text style={s.statCardValue}>{profile.total_points}</Text>
            <Text style={s.statCardLabel}>XP Earned</Text>
          </View>
          <View style={s.statCard}>
            <BookOpen size={20} color={c.amber600} />
            <Text style={s.statCardValue}>{profile.tale_count ?? 0}</Text>
            <Text style={s.statCardLabel}>Tales</Text>
          </View>
        </View>

        {/* Social Stats */}
        <View style={s.socialRow}>
          <TouchableOpacity
            style={s.socialItem}
            onPress={() => router.push(`/profile/followers?id=${profileDeviceId}&tab=followers` as Href)}
          >
            <Text style={s.socialValue}>{profile.follower_count}</Text>
            <Text style={s.socialLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={s.socialDivider} />
          <TouchableOpacity
            style={s.socialItem}
            onPress={() => router.push(`/profile/followers?id=${profileDeviceId}&tab=following` as Href)}
          >
            <Text style={s.socialValue}>{profile.following_count}</Text>
            <Text style={s.socialLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Trophy Case */}
        {badges.length > 0 && (
          <View style={s.badgeSection}>
            <View style={s.badgeSectionHeader}>
              <View style={s.badgeSectionLeft}>
                <Trophy size={16} color={c.amber500} />
                <Text style={s.badgeSectionTitle}>Trophy Case</Text>
              </View>
            </View>
            <View style={s.badgeGrid}>
              {badges.map((badge) => {
                const IconComponent = BADGE_ICONS[badge.icon] || Star
                const iconColor = BADGE_COLORS[badge.color || 'amber'] || c.amber500
                return (
                  <View key={badge.id} style={s.badgeCard}>
                    <View style={[s.badgeIconCircle, { backgroundColor: iconColor + '18' }]}>
                      <IconComponent size={24} color={iconColor} />
                    </View>
                    <Text style={s.badgeName} numberOfLines={1}>{badge.name}</Text>
                    <Text style={s.badgeDesc} numberOfLines={2}>{badge.description}</Text>
                  </View>
                )
              })}
            </View>
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
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: font.bold, color: t.text },

    // Profile
    profileSection: { alignItems: 'center', paddingVertical: 20, gap: 6 },
    avatarRing: {
      padding: 3,
      borderRadius: 50,
      borderWidth: 3,
      borderColor: c.amber500,
      marginBottom: 8,
    },
    profileName: { fontSize: 22, fontFamily: font.bold, color: t.text },
    levelPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: isDark ? c.stone800 : c.stone200,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
    },
    levelEmoji: { fontSize: 14 },
    levelText: { fontSize: 12, fontFamily: font.semibold, color: c.amber600 },
    metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: t.textSecondary, fontFamily: font.regular },

    // XP Progress
    xpCard: {
      marginHorizontal: 20, marginBottom: 16,
      padding: 16, borderRadius: 16,
      backgroundColor: t.card,
      borderWidth: 1, borderColor: isDark ? c.stone700 : c.stone200,
    },
    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
    xpLabel: { fontSize: 10, color: t.textSecondary, letterSpacing: 1, fontFamily: font.medium },
    xpValue: { fontSize: 18, fontFamily: font.bold, color: t.text, marginTop: 2 },
    xpTotal: { fontSize: 13, color: t.textSecondary, fontFamily: font.regular },
    xpRemaining: { fontSize: 11, color: c.amber500, fontFamily: font.medium },
    xpBarBg: { height: 10, backgroundColor: isDark ? c.stone700 : c.stone200, borderRadius: 99, overflow: 'hidden' },
    xpBarFill: { height: '100%', backgroundColor: c.amber500, borderRadius: 99 },

    // Stats Grid
    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      marginHorizontal: 20, marginBottom: 12,
    },
    statCard: {
      flexBasis: '48%' as any, flexGrow: 1,
      backgroundColor: t.card, borderRadius: 16, padding: 16,
      gap: 4,
    },
    statCardValue: { fontSize: 22, fontFamily: font.bold, color: t.text },
    statCardLabel: { fontSize: 11, color: t.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },

    // Social
    socialRow: {
      flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
      backgroundColor: t.card, borderRadius: 16, paddingVertical: 16,
    },
    socialItem: { flex: 1, alignItems: 'center' },
    socialValue: { fontSize: 20, fontFamily: font.bold, color: t.text },
    socialLabel: { fontSize: 11, color: t.textSecondary, marginTop: 2 },
    socialDivider: { width: 1, height: 28, backgroundColor: t.border, alignSelf: 'center' },

    // Badges
    badgeSection: { paddingHorizontal: 20, marginBottom: 12 },
    badgeSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badgeSectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgeSectionTitle: { fontSize: 17, fontFamily: font.bold, color: t.text },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badgeCard: {
      flexBasis: '48%' as any, flexGrow: 1,
      backgroundColor: t.card, borderRadius: 16, padding: 16,
      alignItems: 'center',
      borderWidth: 1, borderColor: isDark ? c.stone700 : c.stone200,
    },
    badgeIconCircle: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    badgeName: { fontSize: 13, fontFamily: font.semibold, color: t.text, textAlign: 'center' },
    badgeDesc: { fontSize: 10, color: t.textSecondary, textAlign: 'center', marginTop: 3, lineHeight: 14 },
  })
}
