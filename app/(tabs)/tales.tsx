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
import { MessageCircle, MapPin, Plus, Camera, Trash2, Flag, MoreVertical } from 'lucide-react-native'
import { font } from '@/lib/theme'
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

// ─── Contributor badge tiers ────────────────────────────

function getContributorBadge(post: TalePost): { label: string; color: string; ringColor: string } {
  // Simple heuristic based on post type + device hash
  const hash = post.device_id.charCodeAt(post.device_id.length - 1) % 4
  if (hash === 0) return { label: 'Local Expert', color: '#7c3aed', ringColor: '#a78bfa' }
  if (hash === 1) return { label: 'Road Scout', color: '#d97706', ringColor: '#fbbf24' }
  if (hash === 2) return { label: 'Commuter', color: '#0891b2', ringColor: '#22d3ee' }
  return { label: 'Explorer', color: '#15803d', ringColor: '#4ade80' }
}

function getDisplayName(post: TalePost): string {
  if (post.display_name) return post.display_name
  return `User-${post.device_id.slice(-4).toUpperCase()}`
}

// ─── TaleCard ───────────────────────────────────────────

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
  const s = cardStyles(isDark)
  const [showMenu, setShowMenu] = useState(false)
  const badge = getContributorBadge(post)
  const displayName = getDisplayName(post)
  const screenWidth = Dimensions.get('window').width

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
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
          <View style={[s.avatarRing, { borderColor: badge.ringColor }]}>
            <InitialsAvatar
              name={post.display_name}
              deviceId={post.device_id}
              size={38}
            />
          </View>
        </TouchableOpacity>

        <View style={s.headerInfo}>
          <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
          </TouchableOpacity>
          <View style={s.headerMeta}>
            <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
            <View style={s.metaDot} />
            <Text style={s.timeText}>{timeAgo(post.created_at)}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setShowMenu(!showMenu)}
          style={s.menuBtn}
          hitSlop={8}
        >
          <MoreVertical size={18} color={isDark ? 'rgba(255,255,255,0.4)' : '#7a7674'} />
        </Pressable>
      </View>

      {/* Menu dropdown */}
      {showMenu && (
        <>
          <Pressable style={s.menuOverlay} onPress={() => setShowMenu(false)} />
          <View style={s.menuDropdown}>
            <TouchableOpacity onPress={handleReport} activeOpacity={0.7} style={s.menuItem}>
              <Flag size={16} color={isDark ? '#a8a29e' : '#78716c'} />
              <Text style={s.menuItemText}>Report</Text>
            </TouchableOpacity>
            {isOwn && onDelete && (
              <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={s.menuItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={s.menuItemTextDanger}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ── Media (4:5 aspect) ── */}
      <View style={s.mediaWrap}>
        {post.media_type === 'video' && post.video_url ? (
          <VideoPlayer
            uri={post.video_url}
            thumbnailUri={post.video_thumbnail_url}
            width={screenWidth - 32}
            isVisible={isVisible}
            isMounted={isMounted}
            durationSecs={post.video_duration_secs}
            onExpand={onVideoPress}
          />
        ) : post.image_url ? (
          <ImageCarousel
            images={post.image_urls && post.image_urls.length > 0 ? post.image_urls : [post.image_url!]}
            width={screenWidth - 32}
          />
        ) : null}

        {/* Video badge */}
        {post.media_type === 'video' && (
          <View style={s.videoBadge}>
            <View style={s.videoBadgeDot} />
            <Text style={s.videoBadgeText}>LIVE</Text>
          </View>
        )}

        {/* Location pill overlay */}
        <View style={s.locationPill}>
          <MapPin size={12} color="#f8a010" />
          <Text style={s.locationPillText} numberOfLines={1}>{post.location_name}</Text>
        </View>
      </View>

      {/* ── Caption ── */}
      {post.caption && (
        <View style={s.captionWrap}>
          <Text style={s.captionText}>{post.caption}</Text>
        </View>
      )}

      {/* ── Reaction Bar ── */}
      <ReactionBar
        reactionSummary={reactionSummary}
        userReactions={userReactions}
        onReact={onReact}
      />

      {/* ── Comment link ── */}
      {post.comment_count > 0 && (
        <TouchableOpacity onPress={onComment} style={s.commentLink} activeOpacity={0.7}>
          <MessageCircle size={14} color={isDark ? 'rgba(255,255,255,0.4)' : '#7a7674'} />
          <Text style={s.commentLinkText}>
            View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Main Screen ────────────────────────────────────────

export default function TalesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

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
      setTimeout(() => setCommentPostId(postId), 300)
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
        <View style={s.headerLeft}>
          <InitialsAvatar name={null} deviceId={deviceId ?? ''} size={36} />
          <Text style={s.headerTitle}>Tales</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/report/photo' as Href)}
          style={s.newBtn}
          activeOpacity={0.7}
        >
          <Camera size={18} color={isDark ? '#312e2d' : '#fff0e3'} />
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
          <Camera size={48} color={isDark ? '#57534e' : '#a8a29e'} />
          <Text style={s.emptyTitle}>No tales yet</Text>
          <Text style={s.emptySub}>Be the first to share a Trotro Tale!</Text>
          <TouchableOpacity
            onPress={() => router.push('/report/photo' as Href)}
            style={s.emptyBtn}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#fff" />
            <Text style={s.emptyBtnText}>Share a Tale</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#815100" />
          }
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color="#815100" style={{ paddingVertical: 20 }} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 90, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CommentSheet
        postId={commentPostId}
        visible={commentPostId !== null}
        onClose={() => setCommentPostId(null)}
      />
    </SafeAreaView>
  )
}

// ─── Card Styles ────────────────────────────────────────

const cardStyles = (isDark: boolean) => {
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(178,172,170,0.15)'

  return StyleSheet.create({
    card: {
      backgroundColor: surfaceLow,
      marginHorizontal: 16,
      marginBottom: 20,
      borderRadius: 20,
      overflow: 'hidden',
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    avatarRing: {
      borderWidth: 2,
      borderRadius: 22,
      padding: 2,
    },
    headerInfo: {
      flex: 1,
      marginLeft: 10,
    },
    name: {
      fontFamily: font.semibold,
      fontSize: 14,
      color: onSurface,
      lineHeight: 18,
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    badgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#b2acaa',
    },
    timeText: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    menuBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Media ──
    mediaWrap: {
      position: 'relative',
      overflow: 'hidden',
    },
    videoBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#2563eb',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    videoBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#fff',
    },
    videoBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 1.5,
    },
    locationPill: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.4)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 14,
      maxWidth: '80%',
    },
    locationPillText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurface,
    },

    // ── Caption ──
    captionWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    captionText: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurface,
      lineHeight: 20,
    },

    // ── Comments ──
    commentLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    commentLinkText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },

    // ── Menu ──
    menuOverlay: {
      position: 'absolute',
      top: -200,
      left: -400,
      right: -400,
      bottom: -800,
      zIndex: 10,
    },
    menuDropdown: {
      position: 'absolute',
      right: 16,
      top: 52,
      zIndex: 20,
      backgroundColor: isDark ? '#292524' : '#ffffff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: outlineVariant,
      paddingVertical: 4,
      minWidth: 140,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    menuItemText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: onSurface,
    },
    menuItemTextDanger: {
      fontSize: 14,
      fontFamily: font.medium,
      color: '#ef4444',
    },
  })
}

// ─── Screen Styles ──────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: font.extrabold,
      color: isDark ? '#fef3c7' : '#78350f',
      letterSpacing: -0.5,
    },
    newBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: onSurfaceVariant, marginTop: 16 },
    emptySub: { fontSize: 14, color: onSurfaceVariant, marginTop: 4, textAlign: 'center' },
    emptyBtn: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#815100',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 16,
    },
    emptyBtnText: { color: '#fff0e3', fontFamily: font.bold, fontSize: 14 },
  })
}
