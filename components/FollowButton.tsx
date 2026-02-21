import { TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native'
import { UserPlus, UserCheck } from 'lucide-react-native'
import { useFollow } from '@/lib/hooks/useFollow'
import { c, font } from '@/lib/theme'

interface FollowButtonProps {
  myDeviceId: string | null
  targetDeviceId: string
  initialFollowing?: boolean
  size?: 'sm' | 'md'
}

export default function FollowButton({
  myDeviceId,
  targetDeviceId,
  initialFollowing = false,
  size = 'sm',
}: FollowButtonProps) {
  const isDark = useColorScheme() === 'dark'
  const { isFollowing, toggle, isLoading } = useFollow(
    myDeviceId,
    targetDeviceId,
    initialFollowing
  )

  if (myDeviceId === targetDeviceId) return null

  const Icon = isFollowing ? UserCheck : UserPlus
  const isSm = size === 'sm'

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isLoading}
      activeOpacity={0.7}
      style={[
        styles.btn,
        isSm ? styles.btnSm : styles.btnMd,
        isFollowing
          ? { backgroundColor: isDark ? c.stone800 : c.stone100 }
          : { backgroundColor: c.amber500 },
        isLoading && { opacity: 0.6 },
      ]}
    >
      <Icon
        size={isSm ? 14 : 16}
        color={isFollowing ? (isDark ? c.stone300 : c.stone600) : c.white}
      />
      <Text
        style={[
          styles.text,
          isSm ? styles.textSm : styles.textMd,
          {
            color: isFollowing
              ? isDark
                ? c.stone300
                : c.stone600
              : c.white,
          },
        ]}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
  },
  btnSm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnMd: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontFamily: font.semibold,
  },
  textSm: {
    fontSize: 12,
  },
  textMd: {
    fontSize: 14,
  },
})
