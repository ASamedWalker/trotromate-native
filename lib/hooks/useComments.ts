import { useState, useEffect, useCallback } from 'react'
import { fetchComments, postComment, type TaleComment } from '@/lib/services/comments'

export function useComments(postId: string | null, deviceId: string | null) {
  const [comments, setComments] = useState<TaleComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)

  const load = useCallback(async () => {
    if (!postId) return
    setIsLoading(true)
    const data = await fetchComments(postId)
    setComments(data)
    setIsLoading(false)
  }, [postId])

  useEffect(() => {
    load()
  }, [load])

  const addComment = useCallback(
    async (content: string, displayName: string | null): Promise<boolean> => {
      if (!postId || !deviceId) return false
      setIsPosting(true)
      const comment = await postComment({ postId, deviceId, displayName, content })
      if (comment) {
        setComments((prev) => [...prev, comment])
        setIsPosting(false)
        return true
      }
      setIsPosting(false)
      return false
    },
    [postId, deviceId]
  )

  return { comments, isLoading, isPosting, addComment, refresh: load }
}
