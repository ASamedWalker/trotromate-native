import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  useColorScheme,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Image as ImageIcon, MapPin, X, Send, Plus, Video } from 'lucide-react-native'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useStoreReview } from '@/lib/hooks/useStoreReview'
import { useSubmitTale } from '@/lib/hooks/useTales'
import type { TaleMediaType } from '@/lib/types'

const MAX_IMAGES = 10
const MAX_VIDEO_DURATION = 60 // seconds

const LOCATIONS = [
  'Circle', 'Madina', 'Lapaz', 'Achimota', 'Kaneshie',
  'Tema Station', '37 Station', 'Kasoa', 'Tema', 'Spintex',
  'East Legon', 'Dansoman', 'Teshie', 'Nkrumah Circle', 'Ashaiman',
]

export default function TrotroTalesPostScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, profile, setLastReward, refreshProfile } = useApp()
  const haptics = useHaptics()
  const { maybePromptReview } = useStoreReview()
  const { submit: submitTale, isSubmitting } = useSubmitTale(deviceId)

  const [imageUris, setImageUris] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [mediaType, setMediaType] = useState<TaleMediaType>('image')
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const canAddMore = imageUris.length < MAX_IMAGES

  const pickFromCamera = async () => {
    if (!canAddMore) {
      Alert.alert('Limit reached', `Maximum ${MAX_IMAGES} images`)
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take photos.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets[0]) {
      setImageUris((prev) => [...prev, result.assets[0].uri])
    }
  }

  const pickFromGallery = async () => {
    if (!canAddMore) {
      Alert.alert('Limit reached', `Maximum ${MAX_IMAGES} images`)
      return
    }
    const remaining = MAX_IMAGES - imageUris.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri)
      setImageUris((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES))
    }
  }

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index))
  }

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_DURATION,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setVideoUri(asset.uri)
      setVideoDuration(asset.duration ? Math.round(asset.duration / 1000) : null)
      setMediaType('video')
      setImageUris([])

      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 })
        setVideoThumbnailUri(thumb.uri)
      } catch {
        console.warn('Failed to generate video thumbnail')
      }
    }
  }

  const removeVideo = () => {
    setVideoUri(null)
    setVideoThumbnailUri(null)
    setVideoDuration(null)
    setMediaType('image')
    setUploadProgress(null)
  }

  const handleSubmit = async () => {
    if (mediaType === 'video') {
      if (!videoUri) {
        Alert.alert('Missing Video', 'Please select a video')
        return
      }
    } else if (imageUris.length === 0) {
      Alert.alert('Missing Photo', 'Please take or choose a photo')
      return
    }
    if (!location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location')
      return
    }
    if (!deviceId) {
      Alert.alert('Error', 'Device not ready. Please try again.')
      return
    }

    const reward = await submitTale({
      imageUris,
      caption,
      location,
      displayName: profile?.display_name ?? null,
      mediaType,
      videoUri: videoUri ?? undefined,
      videoThumbnailUri: videoThumbnailUri ?? undefined,
      videoDurationSecs: videoDuration ?? undefined,
      onProgress: (p) => setUploadProgress(p),
    })

    if (reward) {
      haptics.success()
      setLastReward(reward)
      refreshProfile()
      await maybePromptReview()
      Alert.alert(
        'Tale Posted! +' + reward.points_awarded + ' pts',
        'Your Trotro Tale has been shared with the community.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } else {
      Alert.alert('Error', 'Failed to post your tale. Please try again.')
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <View style={s.headerCard}>
            <View style={s.headerRow}>
              <View style={s.headerIcon}>
                <Camera size={24} color={c.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle}>Trotro Tales</Text>
                <Text style={s.headerSub}>Share your trotro experience</Text>
              </View>
            </View>
          </View>

          {/* Media Section */}
          <View style={s.formCard}>
            <View style={s.labelRow}>
              <Text style={s.label}>{mediaType === 'video' ? 'Video' : 'Photos'}</Text>
              {mediaType === 'image' && imageUris.length > 0 && (
                <Text style={s.counter}>{imageUris.length}/{MAX_IMAGES}</Text>
              )}
            </View>

            {/* Video preview */}
            {mediaType === 'video' && videoUri ? (
              <View style={{ marginBottom: 12 }}>
                <View style={s.thumbContainer}>
                  {videoThumbnailUri ? (
                    <Image source={{ uri: videoThumbnailUri }} style={s.videoPreview} />
                  ) : (
                    <View style={[s.videoPreview, { backgroundColor: c.stone800, alignItems: 'center', justifyContent: 'center' }]}>
                      <Video size={32} color={c.stone400} />
                    </View>
                  )}
                  <TouchableOpacity onPress={removeVideo} style={s.thumbRemove}>
                    <X size={12} color={c.white} />
                  </TouchableOpacity>
                  {videoDuration && (
                    <View style={s.videoDurationBadge}>
                      <Text style={s.videoDurationText}>{videoDuration}s</Text>
                    </View>
                  )}
                </View>
                {uploadProgress !== null && uploadProgress < 1 && (
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
                  </View>
                )}
              </View>
            ) : imageUris.length > 0 ? (
              <>
                {/* Thumbnail strip */}
                <FlatList
                  data={[...imageUris, ...(canAddMore ? ['__add__'] : [])]}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  contentContainerStyle={s.thumbStrip}
                  renderItem={({ item, index }) => {
                    if (item === '__add__') {
                      return (
                        <TouchableOpacity
                          onPress={pickFromGallery}
                          activeOpacity={0.7}
                          style={s.addThumb}
                        >
                          <Plus size={24} color={isDark ? c.stone400 : c.stone500} />
                          <Text style={s.addThumbText}>Add</Text>
                        </TouchableOpacity>
                      )
                    }
                    return (
                      <View style={s.thumbContainer}>
                        <Image source={{ uri: item }} style={s.thumb} />
                        <TouchableOpacity
                          onPress={() => removeImage(index)}
                          style={s.thumbRemove}
                        >
                          <X size={12} color={c.white} />
                        </TouchableOpacity>
                        {index === 0 && (
                          <View style={s.coverBadge}>
                            <Text style={s.coverBadgeText}>Cover</Text>
                          </View>
                        )}
                      </View>
                    )
                  }}
                />

                {/* Quick add buttons */}
                {canAddMore && (
                  <View style={s.quickAddRow}>
                    <TouchableOpacity onPress={pickFromCamera} activeOpacity={0.7} style={s.quickAddBtn}>
                      <Camera size={14} color={c.amber500} />
                      <Text style={[s.quickAddText, { color: c.amber500 }]}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickFromGallery} activeOpacity={0.7} style={s.quickAddBtn}>
                      <ImageIcon size={14} color={isDark ? c.stone400 : c.stone500} />
                      <Text style={s.quickAddText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={s.photoButtons}>
                <TouchableOpacity
                  onPress={pickFromCamera}
                  activeOpacity={0.7}
                  style={[s.photoBtn, { backgroundColor: c.amber500 }]}
                >
                  <Camera size={28} color={c.white} />
                  <Text style={s.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromGallery}
                  activeOpacity={0.7}
                  style={[s.photoBtn, { backgroundColor: isDark ? c.stone700 : c.stone300 }]}
                >
                  <ImageIcon size={28} color={isDark ? c.stone200 : c.stone700} />
                  <Text style={[s.photoBtnText, { color: isDark ? c.stone200 : c.stone700 }]}>
                    Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickVideo}
                  activeOpacity={0.7}
                  style={[s.photoBtn, { backgroundColor: isDark ? c.stone700 : c.stone300 }]}
                >
                  <Video size={28} color={c.pink500} />
                  <Text style={[s.photoBtnText, { color: c.pink500 }]}>Video</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Caption */}
            <Text style={[s.label, { marginTop: 20 }]}>Caption</Text>
            <View style={s.captionBox}>
              <TextInput
                value={caption}
                onChangeText={(text) => setCaption(text.slice(0, 280))}
                placeholder="Write a caption..."
                placeholderTextColor={t.textSecondary}
                style={s.captionInput}
                multiline
                numberOfLines={3}
              />
              <Text style={s.charCount}>{caption.length}/280</Text>
            </View>

            {/* Location */}
            <Text style={[s.label, { marginTop: 20 }]}>
              Location <Text style={s.required}>Required</Text>
            </Text>
            <View style={s.inputBox}>
              <MapPin size={20} color={c.pink500} />
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Circle Station"
                placeholderTextColor={t.textSecondary}
                style={s.input}
              />
            </View>

            {/* Quick locations */}
            <View style={s.quickGrid}>
              {LOCATIONS.slice(0, 8).map((loc) => (
                <TouchableOpacity
                  key={loc}
                  onPress={() => setLocation(loc)}
                  style={[
                    s.quickBtn,
                    location === loc ? s.quickBtnActive : s.quickBtnInactive,
                  ]}
                >
                  <Text
                    style={[
                      s.quickBtnText,
                      location === loc ? s.quickBtnTextActive : s.quickBtnTextInactive,
                    ]}
                  >
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={[s.submitBtn, isSubmitting && s.submitBtnDisabled]}
            >
              <Send size={20} color={c.white} />
              <Text style={s.submitText}>
                {isSubmitting
                  ? mediaType === 'video'
                    ? `Uploading video${uploadProgress ? ` ${Math.round(uploadProgress * 100)}%` : ''}...`
                    : `Uploading${imageUris.length > 1 ? ` ${imageUris.length} photos` : ''}...`
                  : 'Share Tale'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
    headerCard: {
      backgroundColor: c.pink500,
      padding: 20,
      borderRadius: 24,
      marginBottom: 24,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { color: c.white, fontSize: 18, fontFamily: font.bold },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
    formCard: { padding: 20, borderRadius: 24, backgroundColor: t.card },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontFamily: font.medium,
      marginBottom: 8,
      color: isDark ? c.stone300 : c.stone600,
    },
    counter: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? c.stone400 : c.stone500,
      marginBottom: 8,
    },
    required: { color: c.red500, fontSize: 12 },
    photoButtons: { flexDirection: 'row', gap: 12 },
    photoBtn: {
      flex: 1,
      height: 120,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoBtnText: { color: c.white, fontFamily: font.semibold, marginTop: 8 },
    thumbStrip: { gap: 8, paddingBottom: 8 },
    thumbContainer: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
    thumb: { width: 80, height: 60, borderRadius: 12 },
    thumbRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    coverBadgeText: { color: c.white, fontSize: 9, fontWeight: '600' },
    addThumb: {
      width: 80,
      height: 60,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: isDark ? c.stone600 : c.stone300,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addThumbText: {
      fontSize: 10,
      color: isDark ? c.stone400 : c.stone500,
      marginTop: 2,
    },
    quickAddRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 4,
    },
    quickAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    quickAddText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: isDark ? c.stone400 : c.stone500,
    },
    captionBox: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: t.cardAlt,
    },
    captionInput: {
      fontSize: 16,
      color: t.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      color: t.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 12,
      backgroundColor: t.cardAlt,
    },
    input: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    quickBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    quickBtnActive: { backgroundColor: c.pink500 },
    quickBtnInactive: { backgroundColor: t.cardAlt },
    quickBtnText: { fontSize: 13, fontFamily: font.medium },
    quickBtnTextActive: { color: c.white },
    quickBtnTextInactive: { color: isDark ? c.stone300 : c.stone600 },
    videoPreview: { width: '100%', height: 200, borderRadius: 12 },
    videoDurationBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    videoDurationText: { color: c.white, fontSize: 11, fontFamily: font.semibold },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? c.stone700 : c.stone200,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.pink500,
      borderRadius: 2,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: c.pink500,
    },
    submitBtnDisabled: { backgroundColor: c.stone400 },
    submitText: { marginLeft: 8, color: c.white, fontFamily: font.semibold, fontSize: 16 },
  })
}
