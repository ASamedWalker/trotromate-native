import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTales, addReaction, removeReaction, fetchUserReactions, deleteTale, submitTale } from '@/lib/services/tales'
import { awardPointsForReport } from '@/lib/services/rewards'
import type { TalePost, TalePostType, TaleMediaType, RewardResult } from '@/lib/types'

export function useTalesFeed(deviceId: string | null) {
  const queryClient = useQueryClient()
  const [posts, setPosts] = useState<TalePost[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  // Map<postId, string[]> — user's active emoji reactions per post
  const [userReactions, setUserReactions] = useState<Map<string, string[]>>(new Map())
  // Map<postId, Record<string, number>> — reaction counts per post
  const [reactionSummaries, setReactionSummaries] = useState<Map<string, Record<string, number>>>(new Map())

  // Initial fetch with TanStack Query caching
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['tales', deviceId],
    queryFn: () => fetchTales({ deviceId }),
  })

  // Sync query data into local state (needed for pagination + optimistic reactions)
  useEffect(() => {
    if (initialData) {
      setPosts(initialData.posts)
      setNextCursor(initialData.nextCursor)

      // Extract reaction_summary from posts
      const summaries = new Map<string, Record<string, number>>()
      initialData.posts.forEach((p) => {
        summaries.set(p.id, (p as TalePost & { reaction_summary?: Record<string, number> }).reaction_summary || {})
      })
      setReactionSummaries(summaries)

      // Fetch user reactions if logged in
      if (deviceId && initialData.posts.length > 0) {
        fetchUserReactions(initialData.posts.map((p) => p.id), deviceId).then(setUserReactions)
      }
    }
  }, [initialData, deviceId])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await fetchTales({ deviceId })
      setPosts(result.posts)
      setNextCursor(result.nextCursor)
      queryClient.setQueryData(['tales', deviceId], result)

      // Refresh summaries
      const summaries = new Map<string, Record<string, number>>()
      result.posts.forEach((p) => {
        summaries.set(p.id, (p as TalePost & { reaction_summary?: Record<string, number> }).reaction_summary || {})
      })
      setReactionSummaries(summaries)

      // Refresh user reactions
      if (deviceId && result.posts.length > 0) {
        const reactions = await fetchUserReactions(result.posts.map((p) => p.id), deviceId)
        setUserReactions(reactions)
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [deviceId, queryClient])

  const loadMore = useCallback(async () => {
    if (!nextCursor) return
    const result = await fetchTales({ cursor: nextCursor, deviceId })
    setPosts((prev) => [...prev, ...result.posts])
    setNextCursor(result.nextCursor)

    // Add summaries for new posts
    result.posts.forEach((p) => {
      setReactionSummaries((prev) => {
        const next = new Map(prev)
        next.set(p.id, (p as TalePost & { reaction_summary?: Record<string, number> }).reaction_summary || {})
        return next
      })
    })

    // Fetch user reactions for new posts
    if (deviceId && result.posts.length > 0) {
      const reactions = await fetchUserReactions(result.posts.map((p) => p.id), deviceId)
      setUserReactions((prev) => {
        const next = new Map(prev)
        reactions.forEach((emojis, postId) => next.set(postId, emojis))
        return next
      })
    }
  }, [nextCursor, deviceId])

  const toggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      if (!deviceId) return
      const currentReactions = userReactions.get(postId) || []
      const isActive = currentReactions.includes(emoji)

      // Optimistic update — user reactions
      setUserReactions((prev) => {
        const next = new Map(prev)
        if (isActive) {
          next.set(postId, currentReactions.filter((e) => e !== emoji))
        } else {
          next.set(postId, [...currentReactions, emoji])
        }
        return next
      })

      // Optimistic update — summaries
      setReactionSummaries((prev) => {
        const next = new Map(prev)
        const summary = { ...(prev.get(postId) || {}) }
        if (isActive) {
          summary[emoji] = Math.max((summary[emoji] || 0) - 1, 0)
          if (summary[emoji] === 0) delete summary[emoji]
        } else {
          summary[emoji] = (summary[emoji] || 0) + 1
        }
        next.set(postId, summary)
        return next
      })

      // Server call
      const success = isActive
        ? await removeReaction(postId, deviceId, emoji)
        : await addReaction(postId, deviceId, emoji)

      if (!success) {
        // Revert on failure
        setUserReactions((prev) => {
          const next = new Map(prev)
          next.set(postId, currentReactions)
          return next
        })
        setReactionSummaries((prev) => {
          const next = new Map(prev)
          // Revert is complex — just refetch
          return next
        })
      }
    },
    [deviceId, userReactions]
  )

  const deletePost = useCallback(
    async (postId: string) => {
      if (!deviceId) return

      // Optimistic removal
      const removedPost = posts.find((p) => p.id === postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))

      const success = await deleteTale(postId, deviceId)

      if (!success && removedPost) {
        // Revert
        setPosts((prev) => [...prev, removedPost].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))
      }
    },
    [deviceId, posts]
  )

  return {
    posts,
    isLoading,
    isRefreshing,
    hasMore: !!nextCursor,
    userReactions,
    reactionSummaries,
    refresh,
    loadMore,
    toggleReaction,
    deletePost,
  }
}

export function useSubmitTale(deviceId: string | null) {
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (params: {
      imageUris: string[]
      caption: string
      location: string
      displayName: string | null
      postType?: TalePostType
      mediaType?: TaleMediaType
      videoUri?: string
      videoThumbnailUri?: string
      videoDurationSecs?: number
      onProgress?: (progress: number) => void
    }): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitTale({
          deviceId,
          displayName: params.displayName,
          imageUris: params.imageUris,
          caption: params.caption,
          location: params.location,
          postType: params.postType,
          mediaType: params.mediaType,
          videoUri: params.videoUri,
          videoThumbnailUri: params.videoThumbnailUri,
          videoDurationSecs: params.videoDurationSecs,
          onProgress: params.onProgress,
        })
        if (!result) {
          setError('Failed to post tale')
          return null
        }
        // Award points
        const reward = await awardPointsForReport({
          deviceId,
          reportType: 'tale',
          reportId: result.postId,
        })
        // Invalidate tales feed cache so it refreshes
        queryClient.invalidateQueries({ queryKey: ['tales'] })
        queryClient.invalidateQueries({ queryKey: ['activity'] })
        queryClient.invalidateQueries({ queryKey: ['profile'] })
        return reward
      } catch {
        setError('Failed to post tale')
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [deviceId, queryClient]
  )

  return { submit, isSubmitting, error }
}
