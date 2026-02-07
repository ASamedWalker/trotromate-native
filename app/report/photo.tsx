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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Image as ImageIcon, MapPin, X, Send } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useSubmitTale } from '@/lib/hooks/useTales'

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
  const { submit: submitTale, isSubmitting } = useSubmitTale(deviceId)

  const [imageUri, setImageUri] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')

  const pickFromCamera = async () => {
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
      setImageUri(result.assets[0].uri)
    }
  }

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Photo library access is required to pick images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    if (!imageUri) {
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
      imageUri,
      caption,
      location,
      displayName: profile?.display_name ?? null,
    })

    if (reward) {
      haptics.success()
      setLastReward(reward)
      refreshProfile()
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
    <SafeAreaView style={s.container} edges={['bottom']}>
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

          {/* Photo Section */}
          <View style={s.formCard}>
            <Text style={s.label}>Photo</Text>

            {imageUri ? (
              <View style={s.previewContainer}>
                <Image source={{ uri: imageUri }} style={s.preview} />
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => setImageUri(null)}
                >
                  <X size={16} color={c.white} />
                </TouchableOpacity>
              </View>
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
                {isSubmitting ? 'Posting...' : 'Share Tale'}
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
    label: {
      fontSize: 14,
      fontFamily: font.medium,
      marginBottom: 8,
      color: isDark ? c.stone300 : c.stone600,
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
    previewContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
    preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
    removeBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
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
