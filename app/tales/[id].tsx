import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, ChevronRight } from 'lucide-react-native'
import { brand, font, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { BackButton } from '@/components/BackButton'
import { AdinkraBand, ADINKRA_BAND_DAY } from '@/components/AdinkraAccent'
import { PulsePostCard, type CardActions } from '@/components/pulse/PulseCards'
import { PAD, META } from '@/components/pulse/PulseBits'
import CommentSheet from '@/components/CommentSheet'
import ImageViewer from '@/components/ImageViewer'
import { LoadErrorState } from '@/components/StateViews'
import { useApp } from '@/lib/contexts/AppContext'
import { supabase } from '@/lib/supabase'
import { fetchTaleById, deleteTale } from '@/lib/services/tales'
import { pulseKind, parseComposerFare } from '@/lib/utils/pulse-extract'
import { timeAgo } from '@/lib/utils/time'
import type { TalePost } from '@/lib/types'

function displayName(post: TalePost): string {
  return post.display_name || `User-${post.device_id.slice(-4).toUpperCase()}`
}

/**
 * One Pulse post on its own screen (opened from an "Earlier" row in the feed).
 * The full card (trust pill, age, media, Answer, menu) and a "Comments (N)" row that
 * opens the same comment sheet the feed uses. Back = system gesture or the back button.
 */
export default function PulsePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { deviceId } = useApp()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [viewer, setViewer] = useState<{ images: string[]; index: number; author: string; caption: string } | null>(null)

  // Show the feed's copy straight away when we have it; the fetch then refreshes it.
  const cached = useMemo(() => {
    const feed = queryClient.getQueryData<{ posts: TalePost[] }>(['tales', deviceId])
    return feed?.posts.find((p) => p.id === id)
  }, [queryClient, deviceId, id])

  const q = useQuery({
    queryKey: ['tale', id],
    enabled: !!id,
    queryFn: () => fetchTaleById(id!),
    placeholderData: cached,
    staleTime: 30 * 1000,
  })
  const post = q.data ?? null

  const actions = useMemo<CardActions>(() => ({
    onComment: () => setCommentsOpen(true),
    onMenu: (p) => {
      const own = p.device_id === deviceId
      Alert.alert('Post', undefined, [
        own
          ? { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
              const ok = await deleteTale(p.id, deviceId ?? '')
              if (!ok) { Alert.alert('Error', 'Could not delete the post. Try again.'); return }
              queryClient.invalidateQueries({ queryKey: ['tales'] })
              if (router.canGoBack()) router.back()
              else router.replace('/tales' as Href)
            } },
          ]) }
          : { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Report Post', 'Are you sure you want to report this post as inappropriate?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Report', style: 'destructive', onPress: async () => {
              try {
                const { error } = await supabase.from('content_reports').upsert({
                  reporter_device_id: deviceId,
                  content_type: 'tale',
                  content_id: p.id,
                  reason: 'inappropriate',
                }, { onConflict: 'reporter_device_id,content_type,content_id' })
                if (error) throw error
                Alert.alert('Reported', 'Thanks for helping keep Troski Pulse safe.')
              } catch {
                Alert.alert('Error', 'Could not submit report. Check your connection and try again.')
              }
            } },
          ]) },
        { text: 'Cancel', style: 'cancel' },
      ])
    },
    onOpenImages: (p, images, index) => {
      const cap = p.caption ?? ''
      const composed = pulseKind(p) === 'fare' ? parseComposerFare(cap) : null
      setViewer({ images, index, author: displayName(p), caption: composed ? composed.note : cap })
    },
    onVideo: (p) => {
      if (!p.video_url) return
      router.push(
        `/reel?postId=${p.id}&videoUrl=${encodeURIComponent(p.video_url)}&thumbnailUrl=${encodeURIComponent(p.video_thumbnail_url ?? '')}&durationSecs=${p.video_duration_secs ?? 0}&displayName=${encodeURIComponent(displayName(p))}&deviceId=${p.device_id}&locationName=${encodeURIComponent(p.location_name)}&caption=${encodeURIComponent(p.caption ?? '')}&timeAgo=${encodeURIComponent(timeAgo(p.created_at))}&commentCount=${p.comment_count}` as Href
      )
    },
    onFareReport: (from, to) => {
      router.push({ pathname: '/report/fare', params: { from, to } } as unknown as Href)
    },
  }), [deviceId, queryClient, router])

  const comments = post?.comment_count ?? 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: ADINKRA_BAND_DAY }} edges={['top']}>
      <AdinkraBand patternHeight={110} style={{ paddingHorizontal: PAD - 8, paddingTop: 2, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <BackButton />
        <HeroText size={22} style={{ color: ui.text }} accessibilityRole="header">Pulse post</HeroText>
      </AdinkraBand>

      <ScrollView
        style={{ flex: 1, backgroundColor: ui.bg }}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={brand.orange} colors={[brand.orange]} />}
      >
        {post ? (
          <>
            <PulsePostCard post={post} actions={actions} />
            <TouchableOpacity
              onPress={() => setCommentsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={comments > 0 ? `Comments, ${comments}. Open` : 'No comments yet. Add one'}
              style={{ marginHorizontal: PAD, marginTop: 12, minHeight: 56, borderRadius: 16, backgroundColor: ui.card, borderWidth: 1, borderColor: ui.hairline, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
            >
              <MessageCircle size={20} color={brand.orangeText} />
              <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: ui.text }}>
                {comments > 0 ? `Comments (${comments})` : 'No comments yet · Add one'}
              </Text>
              <ChevronRight size={18} color={ui.textTertiary} />
            </TouchableOpacity>
          </>
        ) : q.isLoading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={brand.orange} />
          </View>
        ) : q.isError ? (
          <View style={{ padding: 24 }}>
            <LoadErrorState message="Couldn't load this post. Check your connection." onRetry={() => q.refetch()} />
          </View>
        ) : (
          <View style={{ padding: 32, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 17, color: ui.text }}>Post not found</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: META, textAlign: 'center' }}>
              It may have been deleted or hidden.
            </Text>
          </View>
        )}
      </ScrollView>

      <CommentSheet postId={commentsOpen && post ? post.id : null} visible={commentsOpen && !!post} onClose={() => setCommentsOpen(false)} />

      <ImageViewer
        visible={viewer !== null}
        images={viewer?.images ?? []}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        author={viewer?.author}
        caption={viewer?.caption}
      />
    </SafeAreaView>
  )
}
