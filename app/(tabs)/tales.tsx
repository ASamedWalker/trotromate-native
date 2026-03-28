import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { MessageCircle, MapPin, Plus, Camera, Trash2, Flag, Video } from 'lucide-react-native'
import { c, themed, font, shadow } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/contexts/AppContext'
import { useTalesFeed } from '@/lib/hooks/useTales'
import { timeAgo } from '@/lib/utils/time'
import InitialsAvatar from '@/components/InitialsAvatar'
import CommentSheet from '@/components/CommentSheet'
import ReactionBar from '@/components/ReactionBar'
import { SkeletonTaleCard } from '@/components/Skeleton'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import ImageCarousel from '@/components/ImageCarousel'
import VideoPlayer from '@/components/VideoPlayer'
import type { TalePost } from '@/lib/types'

function getDisplayName(post: TalePost): string {
  if (post.display_name) return post.display_name
  return `User-${post.device_id.slice(-4).toUpperCase()}`
}

function TaleCard({
  post,
  isDark,
  reactionSummary,
  userReactions,
  isOwn,
  isVisible,
  isMounted,
  onReact,
  onComment,
  onDelete,
  onReport,
  onProfilePress,
  onVideoPress,
}: {
  post: TalePost
  isDark: boolean
  reactionSummary: Record<string, number>
  userReactions: string[]
  isOwn: boolean
  isVisible: boolean
  isMounted: boolean
  onReact: (emoji: string) => void
  onComment: () => void
  onDelete?: () => void
  onReport: () => void
  onProfilePress: () => void
  onVideoPress?: () => void
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
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
          <InitialsAvatar
            name={post.display_name}
            deviceId={post.device_id}
            size={40}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
              <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            </TouchableOpacity>
            <Text style={s.typeEmoji}>{postTypeEmoji[post.post_type] ?? '📸'}</Text>
            {post.media_type === 'video' && (
              <View style={s.videoBadge}>
                <Video size={10} color={c.white} />
                <Text style={s.videoBadgeText}>VIDEO</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MapPin size={12} color={t.textTertiary} />
            <Text style={s.location} numberOfLines={1}>{post.location_name}</Text>
            <Text style={s.timeText}> · {timeAgo(post.created_at)}</Text>
          </View>
        </View>

        {/* 3-dot menu — Pressable for Android compatibility */}
        <Pressable
          onPress={() => setShowMenu(!showMenu)}
          style={s.menuBtn}
          hitSlop={8}
        >
          <Text style={s.menuDots}>•••</Text>
        </Pressable>
      </View>

      {/* Menu dropdown — rendered as card child to avoid overflow clipping */}
      {showMenu && (
        <>
          <Pressable
            style={s.menuOverlay}
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

      {/* Media — video or image(s) */}
      {post.media_type === 'video' && post.video_url ? (
        <VideoPlayer
          uri={post.video_url}
          thumbnailUri={post.video_thumbnail_url}
          width={Dimensions.get('window').width - 24}
          isVisible={isVisible}
          isMounted={isMounted}
          durationSecs={post.video_duration_secs}
          onExpand={onVideoPress}
        />
      ) : post.image_url ? (
        <ImageCarousel
          images={post.image_urls && post.image_urls.length > 0 ? post.image_urls : [post.image_url!]}
          width={Dimensions.get('window').width - 24}
        />
      ) : null}

      {/* Reactions */}
      <ReactionBar
        reactionSummary={reactionSummary}
        userReactions={userReactions}
        onReact={onReact}
      />

      {/* Comment button */}
      <View style={s.actions}>
        <TouchableOpacity onPress={onComment} style={s.actionBtn} activeOpacity={0.7}>
          <MessageCircle size={22} color={t.textSecondary} />
          <Text style={s.actionCount}>
            {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Text>
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

  const isFocused = useIsFocused()
  const { deviceId } = useApp()
  const {
    posts, isLoading, isRefreshing, hasMore,
    userReactions, reactionSummaries,
    refresh, loadMore, toggleReaction, deletePost,
  } = useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])
  const haptics = useHaptics()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set())

  // Listen for comment open signal from reel screen
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('openComment', (postId: string) => {
      setTimeout(() => setCommentPostId(postId), 300) // slight delay for navigation to settle
    })
    return () => sub.remove()
  }, [])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    setVisiblePostIds(new Set(viewableItems.map((v: any) => v.item.id)))
  }).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current

  const handleReact = (postId: string, emoji: string) => {
    haptics.light()
    toggleReaction(postId, emoji)
  }

  const handleReport = (postId: string) => {
    Alert.alert('Report Tale', 'Are you sure you want to report this tale as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('content_reports').upsert({
            reporter_device_id: deviceId,
            content_type: 'tale',
            content_id: postId,
            reason: 'inappropriate',
          }, { onConflict: 'reporter_device_id,content_type,content_id' })
          Alert.alert('Reported', 'Thanks for helping keep Troski Tales safe.')
        } catch {
          Alert.alert('Reported', 'Thanks for helping keep Troski Tales safe.')
        }
      }},
    ])
  }

  const renderItem = ({ item, index }: { item: TalePost; index: number }) => {
    // Videos >3 positions from any visible post get unmounted to save memory
    // When screen loses focus (reel opened), pause all videos
    const isVisible = isFocused && visiblePostIds.has(item.id)
    const isMounted = item.media_type !== 'video' || isVisible ||
      posts.some((p, i) => visiblePostIds.has(p.id) && Math.abs(i - index) <= 3)

    return (
      <TaleCard
        post={item}
        isDark={isDark}
        reactionSummary={reactionSummaries.get(item.id) || {}}
        userReactions={userReactions.get(item.id) || []}
        isOwn={item.device_id === deviceId}
        isVisible={isVisible}
        isMounted={isMounted}
        onReact={(emoji) => handleReact(item.id, emoji)}
        onComment={() => setCommentPostId(item.id)}
        onDelete={() => deletePost(item.id)}
        onReport={() => handleReport(item.id)}
        onProfilePress={() => router.push(`/profile/${item.device_id}` as Href)}
        onVideoPress={item.media_type === 'video' && item.video_url ? () => {
          const displayName = item.display_name || `User-${item.device_id.slice(-4).toUpperCase()}`
          const summary = reactionSummaries.get(item.id) || {}
          const likeCount = Object.values(summary).reduce((a, b) => a + b, 0)
          router.push(
            `/reel?postId=${item.id}&videoUrl=${encodeURIComponent(item.video_url!)}&thumbnailUrl=${encodeURIComponent(item.video_thumbnail_url ?? '')}&durationSecs=${item.video_duration_secs ?? 0}&displayName=${encodeURIComponent(displayName)}&deviceId=${item.device_id}&locationName=${encodeURIComponent(item.location_name)}&caption=${encodeURIComponent(item.caption ?? '')}&timeAgo=${encodeURIComponent(timeAgo(item.created_at))}&commentCount=${item.comment_count}&likeCount=${likeCount}` as Href
          )
        } : undefined}
      />
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
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
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color={c.amber500} style={{ paddingVertical: 20 }} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 90 }}
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
      marginHorizontal: 12,
      marginBottom: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
      ...shadow.card,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    name: { fontFamily: font.bold, fontSize: 14, color: t.text, flexShrink: 1 },
    typeEmoji: { fontSize: 14, marginLeft: 6 },
    videoBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
      backgroundColor: c.red500,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
    },
    videoBadgeText: {
      color: c.white,
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 0.5,
    },
    location: { fontSize: 12, color: t.textSecondary, marginLeft: 4, flexShrink: 1 },
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
    actionCount: { fontSize: 14, color: t.textSecondary, fontFamily: font.semibold },
    captionRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingBottom: 6,
      flexWrap: 'wrap',
    },
    captionName: { fontFamily: font.bold, fontSize: 14, color: t.text },
    captionText: { fontSize: 14, color: t.text, lineHeight: 20 },
    viewComments: { paddingHorizontal: 14, paddingBottom: 14 },
    viewCommentsText: { fontSize: 13, fontFamily: font.medium, color: t.textSecondary },
    menuBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    menuDots: {
      fontSize: 16,
      fontFamily: font.bold,
      color: t.textTertiary,
      letterSpacing: 2,
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
      right: 14,
      top: 54,
      zIndex: 20,
      backgroundColor: isDark ? '#292524' : '#ffffff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#44403c' : '#d6d3d1',
      paddingVertical: 4,
      minWidth: 140,
      ...shadow.cardStrong,
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
