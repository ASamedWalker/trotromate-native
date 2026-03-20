import { useState, useEffect, useCallback } from 'react'
import { fetchComments, fetchReplies, postComment } from '@/lib/services/comments'
import type { TaleComment } from '@/lib/types'

export function useComments(postId: string | null, deviceId: string | null) {
  const [comments, setComments] = useState<TaleComment[]>([])
  const [repliesMap, setRepliesMap] = useState<Map<string, TaleComment[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!postId) return
    setIsLoading(true)
    const data = await fetchComments(postId)
    setComments(data)
    setRepliesMap(new Map())
    setIsLoading(false)
  }, [postId])

  useEffect(() => {
    load()
  }, [load])

  const loadReplies = useCallback(
    async (parentId: string) => {
      if (!postId) return
      setLoadingReplies((prev) => new Set(prev).add(parentId))
      const replies = await fetchReplies(postId, parentId)
      setRepliesMap((prev) => {
        const next = new Map(prev)
        next.set(parentId, replies)
        return next
      })
      setLoadingReplies((prev) => {
        const next = new Set(prev)
        next.delete(parentId)
        return next
      })
    },
    [postId]
  )

  const addComment = useCallback(
    async (
      content: string,
      displayName: string | null,
      parentCommentId?: string | null
    ): Promise<boolean> => {
      if (!postId || !deviceId) return false
      setIsPosting(true)
      const comment = await postComment({
        postId,
        deviceId,
        displayName,
        content,
        parentCommentId,
      })
      if (comment) {
        if (parentCommentId) {
          // Add reply under its parent
          setRepliesMap((prev) => {
            const next = new Map(prev)
            const existing = next.get(parentCommentId) || []
            next.set(parentCommentId, [...existing, comment])
            return next
          })
          // Increment parent's reply_count
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentCommentId
                ? { ...c, reply_count: c.reply_count + 1 }
                : c
            )
          )
        } else {
          setComments((prev) => [...prev, comment])
        }
        setIsPosting(false)
        return true
      }
      setIsPosting(false)
      return false
    },
    [postId, deviceId]
  )

  return {
    comments,
    repliesMap,
    isLoading,
    isPosting,
    loadingReplies,
    addComment,
    loadReplies,
    refresh: load,
  }
}
