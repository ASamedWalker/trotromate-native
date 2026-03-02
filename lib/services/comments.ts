import { supabase } from '@/lib/supabase/client'
import { validateDisplayName, validateComment } from '@/lib/security/validate'

export interface TaleComment {
  id: string
  post_id: string
  device_id: string
  display_name: string | null
  content: string
  created_at: string
}

export async function fetchComments(postId: string): Promise<TaleComment[]> {
  const { data, error } = await supabase
    .from('tale_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching comments:', error)
    return []
  }

  return (data ?? []) as TaleComment[]
}

export async function postComment(params: {
  postId: string
  deviceId: string
  displayName: string | null
  content: string
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
    })
    .select()
    .single()

  if (error) {
    console.error('Error posting comment:', error)
    return null
  }

  return data as TaleComment
}
