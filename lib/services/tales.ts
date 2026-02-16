import { File } from 'expo-file-system'
import { supabase } from '@/lib/supabase/client'
import type { TalePost, TalePostType } from '@/lib/types'

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

export async function deleteTale(postId: string, deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tale_posts')
    .delete()
    .eq('id', postId)
    .eq('device_id', deviceId)

  if (error) {
    console.error('Error deleting tale:', error)
    return false
  }
  return true
}

export async function submitTale(params: {
  deviceId: string
  displayName: string | null
  imageUri: string
  caption: string
  location: string
  postType?: TalePostType
}): Promise<{ postId: string } | null> {
  const { deviceId, displayName, imageUri, caption, location, postType = 'tale' } = params

  try {
    // Upload image to Supabase storage
    const fileName = `${deviceId}-${Date.now()}.jpg`
    const file = new File(imageUri)
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('tale-images')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })

    let imageUrl = ''
    if (uploadError) {
      console.warn('Image upload failed, using placeholder:', uploadError.message)
      imageUrl = `https://placehold.co/600x450/f59e0b/white?text=Troski+Tale`
    } else {
      const { data: urlData } = supabase.storage
        .from('tale-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    // Insert tale post
    const { data, error: insertError } = await supabase
      .from('tale_posts')
      .insert({
        device_id: deviceId,
        display_name: displayName,
        is_anonymous: false,
        image_url: imageUrl,
        caption: caption.trim() || null,
        post_type: postType,
        location_name: location.trim(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error posting tale:', insertError)
      return null
    }

    return { postId: data.id }
  } catch (err) {
    console.error('Error submitting tale:', err)
    return null
  }
}
