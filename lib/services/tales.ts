import { File } from 'expo-file-system'
import { supabase } from '@/lib/supabase/client'
import type { TalePost, TalePostType, TaleMediaType } from '@/lib/types'
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
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50 MB

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
  mediaType?: TaleMediaType
  videoUri?: string
  videoThumbnailUri?: string
  videoDurationSecs?: number
  onProgress?: (progress: number) => void
}): Promise<{ postId: string } | null> {
  const { deviceId, imageUris, mediaType = 'image' } = params

  // Validate inputs
  const displayName = validateDisplayName(params.displayName)
  const caption = validateCaption(params.caption) || null
  const location = validateLocation(params.location)
  const postType = validateEnum(params.postType || 'tale', TALE_POST_TYPES) || 'tale'

  if (!location) return null

  try {
    let imageUrl: string | null = null
    let imageUrls: string[] | null = null
    let videoUrl: string | null = null
    let videoThumbnailUrl: string | null = null

    if (mediaType === 'video' && params.videoUri) {
      // Upload video
      params.onProgress?.(0.1)
      const safeDeviceId = sanitizeString(deviceId, 32).replace(/[^a-f0-9]/g, '')
      const videoFileName = `${safeDeviceId}-${Date.now()}.mp4`
      const videoFile = new File(params.videoUri)
      const videoBuffer = await videoFile.arrayBuffer()

      if (videoBuffer.byteLength > MAX_VIDEO_SIZE) {
        console.warn(`Video too large (${videoBuffer.byteLength} bytes)`)
        return null
      }

      params.onProgress?.(0.3)
      const { error: videoUploadError } = await supabase.storage
        .from('tale-videos')
        .upload(videoFileName, videoBuffer, { contentType: 'video/mp4' })

      if (videoUploadError) {
        console.error('Video upload failed:', videoUploadError.message)
        return null
      }

      const { data: videoUrlData } = supabase.storage
        .from('tale-videos')
        .getPublicUrl(videoFileName)
      videoUrl = videoUrlData.publicUrl
      params.onProgress?.(0.7)

      // Upload video thumbnail
      if (params.videoThumbnailUri) {
        const thumbFileName = `${safeDeviceId}-${Date.now()}-thumb.jpg`
        const thumbFile = new File(params.videoThumbnailUri)
        const thumbBuffer = await thumbFile.arrayBuffer()

        const { error: thumbError } = await supabase.storage
          .from('tale-images')
          .upload(thumbFileName, thumbBuffer, { contentType: 'image/jpeg' })

        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage
            .from('tale-images')
            .getPublicUrl(thumbFileName)
          videoThumbnailUrl = thumbUrlData.publicUrl
          imageUrl = thumbUrlData.publicUrl // Use thumbnail as image_url fallback
        }
      }
      params.onProgress?.(0.85)
    } else {
      // Image upload (existing logic)
      if (imageUris.length === 0 || imageUris.length > MAX_IMAGES) return null

      const uploadedUrls = await Promise.all(
        imageUris.map(async (uri, index) => {
          const safeDeviceId = sanitizeString(deviceId, 32).replace(/[^a-f0-9]/g, '')
          const fileName = `${safeDeviceId}-${Date.now()}-${index}.jpg`
          const file = new File(uri)
          const arrayBuffer = await file.arrayBuffer()

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

      const validUrls = uploadedUrls.filter(Boolean) as string[]
      if (validUrls.length === 0) return null

      imageUrl = validUrls[0]
      imageUrls = validUrls.length > 1 ? validUrls : null
    }

    params.onProgress?.(0.9)

    // Insert tale post
    const { data, error: insertError } = await supabase
      .from('tale_posts')
      .insert({
        device_id: deviceId,
        display_name: displayName,
        is_anonymous: false,
        image_url: imageUrl,
        image_urls: imageUrls,
        caption,
        post_type: postType,
        location_name: location,
        media_type: mediaType,
        video_url: videoUrl,
        video_thumbnail_url: videoThumbnailUrl,
        video_duration_secs: params.videoDurationSecs ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error posting tale:', insertError)
      return null
    }

    params.onProgress?.(1)
    return { postId: data.id }
  } catch (err) {
    console.error('Error submitting tale:', err)
    return null
  }
}
