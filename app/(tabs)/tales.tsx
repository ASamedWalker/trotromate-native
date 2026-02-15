import { useState } from 'react'
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
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { Heart, MessageCircle, MapPin, Plus, Camera, ChevronLeft } from 'lucide-react-native'
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
  onLike,
  onComment,
}: {
  post: TalePost
  isDark: boolean
  isLiked: boolean
  onLike: () => void
  onComment: () => void
}) {
  const t = themed(isDark)
  const s = cardStyles(isDark)

  const postTypeEmoji: Record<string, string> = {
    trip: '🚐',
    queue: '🧑‍🤝‍🧑',
    tale: '📸',
  }

  const displayName = getDisplayName(post)

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.cardHeader}>
        <InitialsAvatar
          name={post.display_name}
          deviceId={post.device_id}
          size={40}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.name}>{displayName}</Text>
            <Text style={s.typeEmoji}>{postTypeEmoji[post.post_type] ?? '📸'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MapPin size={12} color={t.textTertiary} />
            <Text style={s.location}>{post.location_name}</Text>
            <Text style={s.timeText}> · {timeAgo(post.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* Image — fallback always rendered behind, image covers it when loaded */}
      <View style={s.imageContainer}>
        <View style={s.imageFallback}>
          <Camera size={32} color={c.amber500} />
          <Text style={s.fallbackText}>Troski Tales</Text>
        </View>
        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            style={s.imageOverlay}
            contentFit="cover"
            transition={300}
          />
        ) : null}
      </View>

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
  const { posts, isLoading, isRefreshing, hasMore, likedIds, refresh, loadMore, toggleLike } =
    useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])
  const haptics = useHaptics()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)

  const handleLike = (id: string) => {
    haptics.light()
    toggleLike(id)
  }

  const renderItem = ({ item }: { item: TalePost }) => (
    <TaleCard
      post={item}
      isDark={isDark}
      isLiked={likedIds.has(item.id)}
      onLike={() => handleLike(item.id)}
      onComment={() => setCommentPostId(item.id)}
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
    name: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    typeEmoji: { fontSize: 14, marginLeft: 6 },
    location: { fontSize: 12, color: t.textTertiary, marginLeft: 4 },
    timeText: { fontSize: 12, color: t.textTertiary },
    imageContainer: {
      height: (Dimensions.get('window').width - 32) * 3 / 4,
    },
    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
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
    imageFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1f1710' : '#fff7ed',
    },
    fallbackText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: isDark ? c.amber500 : '#b45309',
      marginTop: 8,
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
