import { supabase } from '@/lib/supabase/client'
import { validateDisplayName, validateComment } from '@/lib/security/validate'
import { fetchAuthorLevels } from '@/lib/services/tales'
import type { TaleComment } from '@/lib/types'

export type { TaleComment }

/** Fetch top-level comments (parent_comment_id IS NULL) */
export async function fetchComments(postId: string): Promise<TaleComment[]> {
  const { data, error } = await supabase
    .from('tale_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .is('parent_comment_id', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching comments:', error)
    return []
  }

  // Attach real contributor tiers for the tier badge next to names
  const comments = (data ?? []) as TaleComment[]
  const levels = await fetchAuthorLevels(comments.map((c) => c.device_id))
  for (const c of comments) {
    if (levels[c.device_id]) c.author_level = levels[c.device_id]
  }
  return comments
}

/** Fetch replies for a specific parent comment */
export async function fetchReplies(postId: string, parentId: string): Promise<TaleComment[]> {
  const { data, error } = await supabase
    .from('tale_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('parent_comment_id', parentId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching replies:', error)
    return []
  }

  return (data ?? []) as TaleComment[]
}

export async function postComment(params: {
  postId: string
  deviceId: string
  displayName: string | null
  content: string
  parentCommentId?: string | null
}): Promise<TaleComment | null> {
  const { postId, deviceId } = params

  const displayName = validateDisplayName(params.displayName)
  const content = validateComment(params.content)
  if (!content) return null

  const { data, error } = await supabase
    .from('tale_comments')
    .insert({
      post_id: postId,
      device_id: deviceId,
      display_name: displayName,
      content,
      parent_comment_id: params.parentCommentId || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error posting comment:', error)
    return null
  }

  return data as TaleComment
}
