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
