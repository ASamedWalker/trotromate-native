import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { Heart, MessageCircle, MapPin, Plus, Camera, ChevronLeft, MoreHorizontal, Trash2, Flag } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useTalesFeed } from '@/lib/hooks/useTales'
import { timeAgo } from '@/lib/utils/time'
import InitialsAvatar from '@/components/InitialsAvatar'
import CommentSheet from '@/components/CommentSheet'
import { SkeletonTaleCard } from '@/components/Skeleton'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import type { TalePost } from '@/lib/types'

function getDisplayName(post: TalePost): string {
  if (post.display_name) return post.display_name
  return `User-${post.device_id.slice(-4).toUpperCase()}`
}

function TaleCard({
  post,
  isDark,
  isLiked,
  isOwn,
  onLike,
  onComment,
  onDelete,
  onReport,
}: {
  post: TalePost
  isDark: boolean
  isLiked: boolean
  isOwn: boolean
  onLike: () => void
  onComment: () => void
  onDelete?: () => void
  onReport: () => void
}) {
  const t = themed(isDark)
  const s = cardStyles(isDark)
  const [showMenu, setShowMenu] = useState(false)

  const postTypeEmoji: Record<string, string> = {
    trip: '🚐',
    queue: '🧑‍🤝‍🧑',
    tale: '📸',
  }

  const displayName = getDisplayName(post)

  const handleDelete = useCallback(() => {
    setShowMenu(false)
    Alert.alert('Delete Tale', 'Are you sure you want to delete this tale?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ])
  }, [onDelete])

  const handleReport = useCallback(() => {
    setShowMenu(false)
    onReport()
  }, [onReport])

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.cardHeader}>
        <InitialsAvatar
          name={post.display_name}
          deviceId={post.device_id}
          size={40}
        />
        <View style={{ flex: 1, marginLeft: 10, marginRight: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            <Text style={s.typeEmoji}>{postTypeEmoji[post.post_type] ?? '📸'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MapPin size={12} color={t.textTertiary} />
            <Text style={s.location} numberOfLines={1}>{post.location_name}</Text>
            <Text style={s.timeText}> · {timeAgo(post.created_at)}</Text>
          </View>
        </View>

        {/* 3-dot menu (all posts) */}
        <View style={{ flexShrink: 0 }}>
          <TouchableOpacity
            onPress={() => setShowMenu(!showMenu)}
            activeOpacity={0.7}
            style={s.menuBtn}
          >
            <MoreHorizontal size={20} color={t.textTertiary} />
          </TouchableOpacity>

          {showMenu && (
            <>
              <TouchableOpacity
                style={s.menuOverlay}
                activeOpacity={1}
                onPress={() => setShowMenu(false)}
              />
              <View style={s.menuDropdown}>
                <TouchableOpacity
                  onPress={handleReport}
                  activeOpacity={0.7}
                  style={s.menuItem}
                >
                  <Flag size={16} color={t.textSecondary} />
                  <Text style={s.menuItemText}>Report</Text>
                </TouchableOpacity>
                {isOwn && onDelete && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    style={s.menuItem}
                  >
                    <Trash2 size={16} color={c.red500} />
                    <Text style={s.menuItemTextDanger}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Image — only render if post has one */}
      {post.image_url ? (
        <Image
          source={{ uri: post.image_url }}
          style={s.image}
          contentFit="cover"
          transition={300}
        />
      ) : null}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity onPress={onLike} style={s.actionBtn} activeOpacity={0.7}>
          <Heart
            size={22}
            color={isLiked ? c.red500 : t.textSecondary}
            fill={isLiked ? c.red500 : 'none'}
          />
          <Text style={[s.actionCount, isLiked && { color: c.red500 }]}>
            {post.like_count}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onComment} style={s.actionBtn} activeOpacity={0.7}>
          <MessageCircle size={22} color={t.textSecondary} />
          <Text style={s.actionCount}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption && (
        <View style={s.captionRow}>
          <Text style={s.captionName}>{displayName}</Text>
          <Text style={s.captionText}> {post.caption}</Text>
        </View>
      )}

      {/* View comments link */}
      {post.comment_count > 0 && (
        <TouchableOpacity onPress={onComment} style={s.viewComments} activeOpacity={0.7}>
          <Text style={s.viewCommentsText}>
            View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function TalesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const { deviceId } = useApp()
  const { posts, isLoading, isRefreshing, hasMore, likedIds, refresh, loadMore, toggleLike, deletePost } =
    useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])
  const haptics = useHaptics()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)

  const handleLike = (id: string) => {
    haptics.light()
    toggleLike(id)
  }

  const handleReport = (postId: string) => {
    Alert.alert('Report Tale', 'Are you sure you want to report this tale as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => {
        // TODO: send report to backend
        Alert.alert('Reported', 'Thanks for helping keep Troski Tales safe.')
      }},
    ])
  }

  const renderItem = ({ item }: { item: TalePost }) => (
    <TaleCard
      post={item}
      isDark={isDark}
      isLiked={likedIds.has(item.id)}
      isOwn={item.device_id === deviceId}
      onLike={() => handleLike(item.id)}
      onComment={() => setCommentPostId(item.id)}
      onDelete={() => deletePost(item.id)}
      onReport={() => handleReport(item.id)}
    />
  )

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Troski Tales</Text>
        <TouchableOpacity
          onPress={() => router.push('/report/photo' as Href)}
          style={s.newBtn}
          activeOpacity={0.7}
        >
          <Plus size={20} color={c.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ paddingTop: 12 }}>
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.centered}>
          <Camera size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>No tales yet</Text>
          <Text style={s.emptySub}>Be the first to share a Trotro Tale!</Text>
          <TouchableOpacity
            onPress={() => router.push('/report/photo' as Href)}
            style={s.emptyBtn}
            activeOpacity={0.8}
          >
            <Text style={s.emptyBtnText}>Share a Tale</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={c.amber500} />
          }
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color={c.amber500} style={{ paddingVertical: 20 }} />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Comment Sheet */}
      <CommentSheet
        postId={commentPostId}
        visible={commentPostId !== null}
        onClose={() => setCommentPostId(null)}
      />
    </SafeAreaView>
  )
}

const cardStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    card: {
      backgroundColor: t.card,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 20,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    name: { fontFamily: font.semibold, fontSize: 14, color: t.text, flexShrink: 1 },
    typeEmoji: { fontSize: 14, marginLeft: 6 },
    location: { fontSize: 12, color: t.textTertiary, marginLeft: 4, flexShrink: 1 },
    timeText: { fontSize: 12, color: t.textTertiary },
    image: {
      height: (Dimensions.get('window').width - 32) * 3 / 4,
    },
    actions: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 16,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount: { fontSize: 14, color: t.textSecondary, fontFamily: font.medium },
    captionRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingBottom: 6,
      flexWrap: 'wrap',
    },
    captionName: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    captionText: { fontSize: 14, color: t.text },
    viewComments: { paddingHorizontal: 14, paddingBottom: 14 },
    viewCommentsText: { fontSize: 13, color: t.textTertiary },
    menuBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    menuOverlay: {
      position: 'absolute' as const,
      top: -200,
      left: -400,
      right: -400,
      bottom: -800,
      zIndex: 10,
    },
    menuDropdown: {
      position: 'absolute' as const,
      right: 0,
      top: 36,
      zIndex: 20,
      backgroundColor: isDark ? '#292524' : '#ffffff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#44403c' : '#e7e5e4',
      paddingVertical: 4,
      minWidth: 140,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    menuItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    menuItemText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
    },
    menuItemTextDanger: {
      fontSize: 14,
      fontFamily: font.medium,
      color: c.red500,
    },
  })
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    newBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.pink500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: t.textSecondary, marginTop: 16 },
    emptySub: { fontSize: 14, color: t.textTertiary, marginTop: 4, textAlign: 'center' },
    emptyBtn: {
      marginTop: 20,
      backgroundColor: c.pink500,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 16,
    },
    emptyBtnText: { color: c.white, fontFamily: font.semibold },
  })
}
