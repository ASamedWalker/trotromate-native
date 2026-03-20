import { File } from 'expo-file-system'
import { supabase } from '@/lib/supabase/client'
import type { TalePost, TalePostType } from '@/lib/types'
import {
  validateDisplayName,
  validateCaption,
  validateLocation,
  validateEnum,
  sanitizeString,
  TALE_POST_TYPES,
} from '@/lib/security/validate'

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function fetchTales(params: {
  limit?: number
  cursor?: string
  deviceId?: string | null
}): Promise<{ posts: TalePost[]; nextCursor: string | null }> {
  const { limit = 20, cursor } = params

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

export async function addReaction(
  postId: string,
  deviceId: string,
  emoji: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tale_reactions')
    .insert({ post_id: postId, device_id: deviceId, emoji })

  if (error) {
    if (error.code === '23505') return true // Already reacted
    console.error('Error adding reaction:', error)
    return false
  }
  return true
}

export async function removeReaction(
  postId: string,
  deviceId: string,
  emoji: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tale_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('device_id', deviceId)
    .eq('emoji', emoji)

  if (error) {
    console.error('Error removing reaction:', error)
    return false
  }
  return true
}

export async function fetchUserReactions(
  postIds: string[],
  deviceId: string
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (postIds.length === 0) return result

  const { data, error } = await supabase
    .from('tale_reactions')
    .select('post_id, emoji')
    .eq('device_id', deviceId)
    .in('post_id', postIds)

  if (error) {
    console.error('Error fetching user reactions:', error)
    return result
  }

  data?.forEach((r) => {
    const existing = result.get(r.post_id) || []
    existing.push(r.emoji)
    result.set(r.post_id, existing)
  })
  return result
}

export async function deleteTale(postId: string, deviceId: string): Promise<boolean> {
  // Soft-delete (RLS no longer allows hard DELETE)
  const { error } = await supabase
    .from('tale_posts')
    .update({ is_hidden: true })
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
  imageUris: string[]
  caption: string
  location: string
  postType?: TalePostType
}): Promise<{ postId: string } | null> {
  const { deviceId, imageUris } = params

  // Validate inputs
  const displayName = validateDisplayName(params.displayName)
  const caption = validateCaption(params.caption) || null
  const location = validateLocation(params.location)
  const postType = validateEnum(params.postType || 'tale', TALE_POST_TYPES) || 'tale'

  if (!location) return null
  if (imageUris.length === 0 || imageUris.length > MAX_IMAGES) return null

  try {
    // Upload all images in parallel
    const imageUrls = await Promise.all(
      imageUris.map(async (uri, index) => {
        // Sanitize filename — only allow device_id + timestamp
        const safeDeviceId = sanitizeString(deviceId, 32).replace(/[^a-f0-9]/g, '')
        const fileName = `${safeDeviceId}-${Date.now()}-${index}.jpg`
        const file = new File(uri)
        const arrayBuffer = await file.arrayBuffer()

        // Reject oversized files
        if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
          console.warn(`Image ${index} too large (${arrayBuffer.byteLength} bytes)`)
          return null
        }

        const { error: uploadError } = await supabase.storage
          .from('tale-images')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })

        if (uploadError) {
          console.warn(`Image ${index} upload failed:`, uploadError.message)
          return null
        }

        const { data: urlData } = supabase.storage
          .from('tale-images')
          .getPublicUrl(fileName)
        return urlData.publicUrl
      })
    )

    // Filter out failed uploads
    const validUrls = imageUrls.filter(Boolean) as string[]
    if (validUrls.length === 0) return null

    // Insert tale post
    const { data, error: insertError } = await supabase
      .from('tale_posts')
      .insert({
        device_id: deviceId,
        display_name: displayName,
        is_anonymous: false,
        image_url: validUrls[0],
        image_urls: validUrls.length > 1 ? validUrls : null,
        caption,
        post_type: postType,
        location_name: location,
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
