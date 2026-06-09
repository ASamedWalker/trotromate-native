import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  Share,
  DeviceEventEmitter,
  Animated,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import {
  MessageCircle,
  MapPin,
  Camera,
  Trash2,
  Flag,
  MoreHorizontal,
  Heart,
  Send,
  Bookmark,
  Play,
} from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import ReanimatedAnimated, { FadeInDown } from 'react-native-reanimated'
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
import type { TalePost } from '@/lib/types'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Contributor badge tiers ────────────────────────────

function getContributorBadge(post: TalePost): { label: string; color: string; ringColor: string } {
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

// ─── Double-tap like overlay ────────────────────────────

function DoubleTapLike({ onDoubleTap, children }: { onDoubleTap: () => void; children: React.ReactNode }) {
  const heartScale = useRef(new Animated.Value(0)).current
  const heartOpacity = useRef(new Animated.Value(0)).current

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      onDoubleTap()
      heartScale.setValue(0)
      heartOpacity.setValue(1)
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 12 }),
        Animated.delay(400),
        Animated.timing(heartOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    })

  return (
    <GestureDetector gesture={doubleTap}>
      <View>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.doubleTapHeart,
            { transform: [{ scale: heartScale }], opacity: heartOpacity },
          ]}
        >
          <Heart size={80} color="#fff" fill="#fff" />
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

// ─── TaleCard ───────────────────────────────────────────

const TaleCard = React.memo(function TaleCard({
  post,
  isDark,
  reactionSummary,
  userReactions,
  isOwn,
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
  onReact: (emoji: string) => void
  onComment: () => void
  onDelete?: () => void
  onReport: () => void
  onProfilePress: () => void
  onVideoPress?: () => void
}) {
  const s = cardStyles(isDark)
  const [showMenu, setShowMenu] = useState(false)
  const [localLiked, setLocalLiked] = useState(userReactions.includes('❤️'))
  const [localSaved, setLocalSaved] = useState(false)
  const badge = getContributorBadge(post)
  const displayName = getDisplayName(post)

  // Sync localLiked with userReactions prop
  useEffect(() => {
    setLocalLiked(userReactions.includes('❤️'))
  }, [userReactions])

  const likeCount = Object.values(reactionSummary).reduce((a, b) => a + b, 0)

  const handleDoubleTapLike = useCallback(() => {
    if (!localLiked) {
      onReact('❤️')
      setLocalLiked(true)
    }
  }, [localLiked, onReact])

  const handleLikePress = useCallback(() => {
    setLocalLiked(!localLiked)
    onReact('❤️')
  }, [localLiked, onReact])

  const handleDelete = useCallback(() => {
    setShowMenu(false)
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
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
              size={36}
            />
          </View>
        </TouchableOpacity>

        <View style={s.headerInfo}>
          <View style={s.nameRow}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
              <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            </TouchableOpacity>
            <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          <View style={s.headerMeta}>
            <MapPin size={10} color={isDark ? 'rgba(255,255,255,0.35)' : '#a8a29e'} />
            <Text style={s.locationText} numberOfLines={1}>{post.location_name}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setShowMenu(!showMenu)}
          style={s.menuBtn}
          hitSlop={8}
        >
          <MoreHorizontal size={20} color={isDark ? 'rgba(255,255,255,0.5)' : '#78716c'} />
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

      {/* ── Text-first caption for text posts (Threads/Twitter style) ── */}
      {post.media_type === 'text' && post.caption ? (
        <View style={s.textPostCard}>
          <Text style={s.textPostText}>
            {post.caption.split(/(#\w+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <Text key={i} style={s.hashtag}>{part}</Text>
              ) : part
            )}
          </Text>
          {post.location_name ? (
            <View style={s.textPostLocation}>
              <MapPin size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={s.textPostLocationText}>{post.location_name}</Text>
            </View>
          ) : null}
        </View>
      ) : (
      <>
      {/* ── Media (edge-to-edge) ── */}
      <DoubleTapLike onDoubleTap={handleDoubleTapLike}>
        <View style={s.mediaWrap}>
          {post.media_type === 'video' && post.video_url ? (
            <Pressable
              onPress={onVideoPress}
              style={{ width: SCREEN_W, aspectRatio: 16 / 9, backgroundColor: '#000' }}
            >
              {post.video_thumbnail_url ? (
                <ExpoImage
                  source={{ uri: post.video_thumbnail_url }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : null}
              <View style={s.videoPlayOverlay}>
                <View style={s.videoPlayBtn}>
                  <Play size={36} color="#fff" fill="#fff" />
                </View>
              </View>
              {post.video_duration_secs != null && (
                <View style={s.videoDurationBadge}>
                  <Text style={s.videoDurationText}>
                    {Math.floor(post.video_duration_secs / 60)}:
                    {String(Math.floor(post.video_duration_secs % 60)).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : post.image_url ? (
            <ImageCarousel
              images={post.image_urls && post.image_urls.length > 0 ? post.image_urls : [post.image_url!]}
              width={SCREEN_W}
            />
          ) : null}

          {/* Video badge */}
          {post.media_type === 'video' && (
            <View style={s.videoBadge}>
              <View style={s.videoBadgeDot} />
              <Text style={s.videoBadgeText}>LIVE</Text>
            </View>
          )}

          {/* Location pill — glassmorphic overlay (images only, videos show location in reel) */}
          {post.media_type !== 'video' && post.location_name ? (
            <View style={s.locationPill} pointerEvents="none">
              <MapPin size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={s.locationPillText} numberOfLines={1}>{post.location_name}</Text>
            </View>
          ) : null}
        </View>
      </DoubleTapLike>
      </>
      )}

      {/* ── Action Row (Instagram-style) ── */}
      <View style={s.actionRow}>
        <View style={s.actionRowLeft}>
          <TouchableOpacity onPress={handleLikePress} activeOpacity={0.7} hitSlop={6}>
            <Heart
              size={26}
              color={localLiked ? '#ef4444' : (isDark ? '#f5f5f4' : '#262626')}
              fill={localLiked ? '#ef4444' : 'transparent'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComment} activeOpacity={0.7} hitSlop={6}>
            <MessageCircle size={24} color={isDark ? '#f5f5f4' : '#262626'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const name = getDisplayName(post)
              const loc = post.location_name ?? ''
              const caption = post.caption ? `\n"${post.caption}"` : ''
              Share.share({
                message: `${name} shared a commuter tale from ${loc} on Troski${caption}\n\nDownload Troski: https://troski.me`,
              })
            }}
            activeOpacity={0.7}
            hitSlop={6}
          >
            <Send size={22} color={isDark ? '#f5f5f4' : '#262626'} style={{ transform: [{ rotate: '20deg' }] }} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setLocalSaved(!localSaved)} activeOpacity={0.7} hitSlop={6}>
          <Bookmark
            size={24}
            color={localSaved ? '#f59e0b' : (isDark ? '#f5f5f4' : '#262626')}
            fill={localSaved ? '#f59e0b' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* ── Like count ── */}
      {likeCount > 0 && (
        <Text style={s.likeCount}>{likeCount.toLocaleString()} like{likeCount !== 1 ? 's' : ''}</Text>
      )}

      {/* ── Caption (skip for text posts — already shown above) ── */}
      {post.caption && post.media_type !== 'text' && (
        <View style={s.captionWrap}>
          <Text style={s.captionText}>
            <Text style={s.captionAuthor}>{displayName}</Text>{'  '}
            {post.caption.split(/(#\w+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <Text key={i} style={s.hashtag}>{part}</Text>
              ) : part
            )}
          </Text>
        </View>
      )}

      {/* ── Reaction Bar (compact) ── */}
      <ReactionBar
        reactionSummary={reactionSummary}
        userReactions={userReactions}
        onReact={onReact}
        compact
      />

      {/* ── Comments ── */}
      {post.comment_count > 0 ? (
        <TouchableOpacity onPress={onComment} style={s.commentLink} activeOpacity={0.7}>
          <Text style={s.commentLinkText}>
            View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onComment} style={s.commentLink} activeOpacity={0.7}>
          <Text style={s.commentLinkText}>Add a comment...</Text>
        </TouchableOpacity>
      )}

      {/* ── Timestamp ── */}
      <Text style={s.timestamp}>{timeAgo(post.created_at)}</Text>

      {/* ── Separator ── */}
      <View style={s.separator} />
    </View>
  )
})

// ─── Main Screen ────────────────────────────────────────

export function TalesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { deviceId, profile } = useApp()
  const {
    posts, isLoading, isRefreshing, hasMore,
    userReactions, reactionSummaries,
    refresh, loadMore, toggleReaction, deletePost,
  } = useTalesFeed(deviceId)
  useRefreshOnFocus([['tales', deviceId]])
  const haptics = useHaptics()

  const [commentPostId, setCommentPostId] = useState<string | null>(null)

  // Listen for comment open signal from reel screen
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sub = DeviceEventEmitter.addListener('openComment', (postId: string) => {
      timer = setTimeout(() => setCommentPostId(postId), 300)
    })
    return () => { sub.remove(); clearTimeout(timer) }
  }, [])

  const handleReact = (postId: string, emoji: string) => {
    haptics.light()
    toggleReaction(postId, emoji)
  }

  const handleReport = (postId: string) => {
    Alert.alert('Report Post', 'Are you sure you want to report this post as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('content_reports').upsert({
            reporter_device_id: deviceId,
            content_type: 'tale',
            content_id: postId,
            reason: 'inappropriate',
          }, { onConflict: 'reporter_device_id,content_type,content_id' })
          Alert.alert('Reported', 'Thanks for helping keep Troski Pulse safe.')
        } catch {
          Alert.alert('Reported', 'Thanks for helping keep Troski Pulse safe.')
        }
      }},
    ])
  }

  const renderItem = ({ item }: { item: TalePost }) => {
    return (
      <TaleCard
        post={item}
        isDark={isDark}
        reactionSummary={reactionSummaries.get(item.id) || {}}
        userReactions={userReactions.get(item.id) || []}
        isOwn={item.device_id === deviceId}
        onReact={(emoji) => handleReact(item.id, emoji)}
        onComment={() => setCommentPostId(item.id)}
        onDelete={() => deletePost(item.id)}
        onReport={() => handleReport(item.id)}
        onProfilePress={() => router.push(`/profile/${item.device_id}` as Href)}
        onVideoPress={item.media_type === 'video' && item.video_url ? () => {
          const dn = item.display_name || `User-${item.device_id.slice(-4).toUpperCase()}`
          const summary = reactionSummaries.get(item.id) || {}
          const lc = Object.values(summary).reduce((a, b) => a + b, 0)
          router.push(
            `/reel?postId=${item.id}&videoUrl=${encodeURIComponent(item.video_url!)}&thumbnailUrl=${encodeURIComponent(item.video_thumbnail_url ?? '')}&durationSecs=${item.video_duration_secs ?? 0}&displayName=${encodeURIComponent(dn)}&deviceId=${item.device_id}&locationName=${encodeURIComponent(item.location_name)}&caption=${encodeURIComponent(item.caption ?? '')}&timeAgo=${encodeURIComponent(timeAgo(item.created_at))}&commentCount=${item.comment_count}&likeCount=${lc}` as Href
          )
        } : undefined}
      />
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Compose bar — single entry point for text + photo/video */}
      <ReanimatedAnimated.View entering={FadeInDown.delay(100).duration(400)} style={s.composeBar}>
        <View style={s.composeAvatar}>
          <InitialsAvatar name={profile?.display_name ?? null} deviceId={deviceId ?? ''} size={36} />
        </View>
        <TouchableOpacity
          onPress={() => router.push('/report/photo?mode=text' as Href)}
          activeOpacity={0.7}
          style={s.composeInput}
        >
          <Text style={s.composePlaceholder}>What&apos;s happening on your route?</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/report/photo' as Href)}
          activeOpacity={0.7}
          style={s.composeCamera}
        >
          <Camera size={20} color={isDark ? c.stone400 : c.stone500} />
        </TouchableOpacity>
      </ReanimatedAnimated.View>

      {isLoading ? (
        <View style={{ paddingTop: 12 }}>
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
          <SkeletonTaleCard isDark={isDark} />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.centered}>
          <Camera size={48} color={isDark ? '#57534e' : '#a8a29e'} />
          <Text style={s.emptyTitle}>No posts yet</Text>
          <Text style={s.emptySub}>Share a fare, a queue update, or a trotro moment!</Text>
          <TouchableOpacity
            onPress={() => router.push('/report/photo?mode=text' as Href)}
            style={s.emptyBtn}
            activeOpacity={0.8}
          >
            <Text style={s.emptyBtnText}>Post to Pulse</Text>
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
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color="#815100" style={{ paddingVertical: 20 }} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 90 }}
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

// ─── Double-tap heart overlay style ─────────────────────

const styles = StyleSheet.create({
  doubleTapHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})

// ─── Card Styles ────────────────────────────────────────

const cardStyles = (isDark: boolean) => {
  const onSurface = isDark ? '#f5f5f4' : '#262626'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.45)' : '#8e8e8e'
  const surface = isDark ? '#000' : '#fff'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  return StyleSheet.create({
    card: {
      backgroundColor: surface,
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    avatarRing: {
      borderWidth: 2,
      borderRadius: 20,
      padding: 2,
    },
    headerInfo: {
      flex: 1,
      marginLeft: 10,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      fontFamily: font.semibold,
      fontSize: 14,
      color: onSurface,
    },
    badgeText: {
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 1,
    },
    locationText: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      flex: 1,
    },
    menuBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Media ──
    mediaWrap: {
      position: 'relative',
      backgroundColor: isDark ? '#111' : '#fafafa',
    },
    videoBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    videoBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#ef4444',
    },
    videoBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 1.5,
    },
    videoPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    videoPlayBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 4,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    videoDurationBadge: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    videoDurationText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: font.semibold,
    },

    // ── Location pill (glass overlay on media) ──
    locationPill: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      maxWidth: '70%' as any,
      zIndex: 10,
    },
    locationPillText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: '#fff',
    },

    // ── Action Row ──
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 6,
    },
    actionRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },

    // ── Like count ──
    likeCount: {
      fontFamily: font.bold,
      fontSize: 14,
      color: onSurface,
      paddingHorizontal: 14,
      marginBottom: 4,
    },

    // ── Caption ──
    captionWrap: {
      paddingHorizontal: 14,
      marginBottom: 4,
    },
    captionText: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurface,
      lineHeight: 20,
    },
    captionAuthor: {
      fontFamily: font.bold,
      fontSize: 14,
    },

    // ── Comments ──
    commentLink: {
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    commentLinkText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },

    // ── Timestamp ──
    timestamp: {
      fontSize: 10,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      paddingHorizontal: 14,
      marginTop: 2,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },

    // ── Separator ──
    separator: {
      height: 1,
      backgroundColor: divider,
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
      right: 14,
      top: 48,
      zIndex: 20,
      backgroundColor: isDark ? '#262626' : '#ffffff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: divider,
      paddingVertical: 4,
      minWidth: 150,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
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

    // Text-only post (Threads/Twitter style — polished card)
    textPostCard: {
      marginHorizontal: 14,
      marginVertical: 8,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafaf9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    textPostText: {
      fontSize: 16,
      fontFamily: font.regular,
      color: isDark ? '#fafaf9' : '#1c1917',
      lineHeight: 24,
      letterSpacing: 0.1,
    },
    textPostLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
    },
    textPostLocationText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? 'rgba(255,255,255,0.4)' : '#a8a29e',
    },
    hashtag: {
      color: '#3b82f6',
      fontFamily: font.semibold,
    },
    textPostAuthor: {
      fontFamily: font.bold,
      color: isDark ? '#fafaf9' : '#1c1917',
    },
  })
}

// ─── Screen Styles ──────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#000' : '#fff'
  const onSurface = isDark ? '#f5f5f4' : '#262626'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.45)' : '#8e8e8e'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
    },
    newBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#262626' : '#262626',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Story strip ──
    storyStrip: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    storyItem: {
      alignItems: 'center',
      gap: 4,
    },
    storyAddRing: {
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      borderRadius: 32,
      padding: 3,
    },
    storyAddBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#0095f6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: surface,
    },
    storyAddPlus: {
      color: '#fff',
      fontSize: 14,
      fontFamily: font.bold,
      lineHeight: 16,
    },
    storyLabel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    headerDivider: {
      height: 1,
      backgroundColor: divider,
    },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: onSurfaceVariant, marginTop: 16 },
    emptySub: { fontSize: 14, color: onSurfaceVariant, marginTop: 4, textAlign: 'center' },
    emptyBtn: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#0095f6',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },

    // Threads-style compose bar
    composeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: divider,
    },
    composeAvatar: {},
    composeInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    composePlaceholder: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    composeCamera: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
