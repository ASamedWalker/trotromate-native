import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import InitialsAvatar from '@/components/InitialsAvatar'
import FollowButton from '@/components/FollowButton'
import { c, font, themed } from '@/lib/theme'
import type { PublicProfile } from '@/lib/types'

interface UserRowProps {
  user: PublicProfile
  myDeviceId: string | null
  showFollow?: boolean
}

export default function UserRow({ user, myDeviceId, showFollow = true }: UserRowProps) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)

  const userNumber = user.device_id.slice(-4).toUpperCase()
  const displayName = user.display_name || `User-${userNumber}`
  const subtitle =
    user.bio ||
    user.current_level?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
    'Commuter'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${user.device_id}` as Href)}
      activeOpacity={0.7}
      style={styles.container}
    >
      <InitialsAvatar name={displayName} size={42} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]} numberOfLines={1}>
          {subtitle}
          {user.home_route_label ? ` · ${user.home_route_label}` : ''}
        </Text>
      </View>
      {showFollow && (
        <FollowButton
          myDeviceId={myDeviceId}
          targetDeviceId={user.device_id}
          initialFollowing={user.is_following}
        />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontFamily: font.semibold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
})
