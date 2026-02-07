import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTales, likeTale, unlikeTale } from '@/lib/services/tales'
import type { TalePost } from '@/lib/types'

export function useTalesFeed(deviceId: string | null) {
  const queryClient = useQueryClient()
  const [posts, setPosts] = useState<TalePost[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())

  // Initial fetch with TanStack Query caching
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['tales', deviceId],
    queryFn: () => fetchTales({ deviceId }),
  })

  // Sync query data into local state (needed for pagination + optimistic likes)
  useEffect(() => {
    if (initialData) {
      setPosts(initialData.posts)
      setNextCursor(initialData.nextCursor)
    }
  }, [initialData])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await fetchTales({ deviceId })
      setPosts(result.posts)
      setNextCursor(result.nextCursor)
      queryClient.setQueryData(['tales', deviceId], result)
    } finally {
      setIsRefreshing(false)
    }
  }, [deviceId, queryClient])

  const loadMore = useCallback(async () => {
    if (!nextCursor) return
    const result = await fetchTales({ cursor: nextCursor, deviceId })
    setPosts((prev) => [...prev, ...result.posts])
    setNextCursor(result.nextCursor)
  }, [nextCursor, deviceId])

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!deviceId) return
      const isLiked = likedIds.has(postId)

      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (isLiked) next.delete(postId)
        else next.add(postId)
        return next
      })
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) }
            : p
        )
      )

      // Server call
      const success = isLiked
        ? await unlikeTale(postId, deviceId)
        : await likeTale(postId, deviceId)

      if (!success) {
        // Revert
        setLikedIds((prev) => {
          const next = new Set(prev)
          if (isLiked) next.add(postId)
          else next.delete(postId)
          return next
        })
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, like_count: p.like_count + (isLiked ? 1 : -1) }
              : p
          )
        )
      }
    },
    [deviceId, likedIds]
  )

  return {
    posts,
    isLoading,
    isRefreshing,
    hasMore: !!nextCursor,
    likedIds,
    refresh,
    loadMore,
    toggleLike,
  }
}
