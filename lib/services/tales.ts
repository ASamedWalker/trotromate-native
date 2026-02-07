import { supabase } from '@/lib/supabase/client'
import type { TalePost } from '@/lib/types'

export async function fetchTales(params: {
  limit?: number
  cursor?: string
  deviceId?: string | null
}): Promise<{ posts: TalePost[]; nextCursor: string | null }> {
  const { limit = 20, cursor, deviceId } = params

  let query = supabase
    .from('tale_posts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tales:', error)
    return { posts: [], nextCursor: null }
  }

  const posts = (data ?? []) as TalePost[]
  const nextCursor = posts.length === limit ? posts[posts.length - 1]?.created_at : null

  return { posts, nextCursor }
}

export async function likeTale(postId: string, deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tale_likes')
    .insert({ post_id: postId, device_id: deviceId })

  if (error) {
    // Unique constraint = already liked
    if (error.code === '23505') return true
    console.error('Error liking tale:', error)
    return false
  }
  return true
}

export async function unlikeTale(postId: string, deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tale_likes')
    .delete()
    .eq('post_id', postId)
    .eq('device_id', deviceId)

  if (error) {
    console.error('Error unliking tale:', error)
    return false
  }
  return true
}
