import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, useColorScheme, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { GlassBackButton } from '@/components/GlassBackButton'
import { c, font, themed } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { supabase } from '@/lib/supabase/client'
import UserRow from '@/components/UserRow'
import type { PublicProfile } from '@/lib/types'

export default function FollowersScreen() {
  const { id: profileDeviceId, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>()
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { deviceId: myDeviceId } = useApp()

  const [tab, setTab] = useState<'followers' | 'following'>(
    initialTab === 'following' ? 'following' : 'followers'
  )
  const [users, setUsers] = useState<PublicProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)

  const fetchList = useCallback(async (reset = false) => {
    if (!profileDeviceId) return
    setIsLoading(true)
    try {
      // Get follow relationships
      let query = supabase
        .from('follows')
        .select('follower_device_id, following_device_id, created_at')
        .order('created_at', { ascending: false })
        .limit(21)

      if (tab === 'followers') {
        query = query.eq('following_device_id', profileDeviceId)
      } else {
        query = query.eq('follower_device_id', profileDeviceId)
      }

      if (!reset && cursor) {
        query = query.lt('created_at', cursor)
      }

      const { data: follows } = await query

      const hasMore = follows && follows.length > 20
      const followsToUse = hasMore ? follows!.slice(0, 20) : follows || []
      setCursor(hasMore ? followsToUse[followsToUse.length - 1]?.created_at : null)

      const deviceIds = followsToUse.map((f) =>
        tab === 'followers' ? f.follower_device_id : f.following_device_id
      )

      if (deviceIds.length === 0) {
        if (reset) setUsers([])
        setIsLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('contributor_profiles')
        .select('device_id, display_name, bio, avatar_url, current_level, total_points, total_reports, current_streak, follower_count, following_count, home_route_label, home_route_id, is_public')
        .in('device_id', deviceIds)

      // Check which ones the viewer follows
      let viewerFollowingIds = new Set<string>()
      if (myDeviceId) {
        const { data: viewerFollows } = await supabase
          .from('follows')
          .select('following_device_id')
          .eq('follower_device_id', myDeviceId)
          .in('following_device_id', deviceIds)

        viewerFollowingIds = new Set(viewerFollows?.map((f) => f.following_device_id) || [])
      }

      const profileMap = new Map((profiles || []).map((p) => [p.device_id, p]))
      const mapped = deviceIds
        .map((id) => {
          const p = profileMap.get(id)
          if (!p) return null
          return { ...p, is_following: viewerFollowingIds.has(id) } as PublicProfile
        })
        .filter(Boolean) as PublicProfile[]

      if (reset) {
        setUsers(mapped)
      } else {
        setUsers((prev) => [...prev, ...mapped])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [profileDeviceId, tab, myDeviceId, cursor])

  useEffect(() => {
    setCursor(null)
    setUsers([])
    fetchList(true)
  }, [tab, profileDeviceId, myDeviceId])

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Header */}
      <View style={s.header}>
        <GlassBackButton isDark={isDark} />
        <Text style={s.headerTitle}>{tab === 'followers' ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['followers', 'following'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[s.tab, tab === t && s.tabActive]}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'followers' ? 'Followers' : 'Following'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.device_id}
        renderItem={({ item }) => (
          <UserRow user={item} myDeviceId={myDeviceId} />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>
                {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={c.amber500} />
            </View>
          ) : cursor ? (
            <TouchableOpacity onPress={() => fetchList()} style={s.loadMore}>
              <Text style={s.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: c.amber500 },
    tabText: { fontSize: 14, fontFamily: font.semibold, color: isDark ? c.stone400 : c.stone500 },
    tabTextActive: { color: c.amber500 },
    list: { paddingTop: 8 },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 14, color: t.textSecondary },
    loadMore: { paddingVertical: 16, alignItems: 'center' },
    loadMoreText: { fontSize: 14, fontFamily: font.semibold, color: c.amber500 },
  })
}
