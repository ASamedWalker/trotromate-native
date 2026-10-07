import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { XCircle } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { BackButton } from '@/components/BackButton'
import InitialsAvatar from '@/components/InitialsAvatar'
import { c, themed, font, brand } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { updateDisplayName } from '@/lib/services/profileName'

const MAX_LEN = 30

export default function EditNameScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const s = useMemo(() => getStyles(), [])

  const { profile, deviceId } = useApp()
  const original = (profile?.display_name ?? '').trim()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [touched, setTouched] = useState(false)
  const [focused, setFocused] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const trimmed = name.trim()
  const tooShort = trimmed.length < 2
  const canSave = !isSaving && !tooShort && trimmed !== original

  const handleSave = async () => {
    if (!canSave || !deviceId) return
    setIsSaving(true)
    const { error } = await updateDisplayName(deviceId, trimmed)
    setIsSaving(false)

    if (error) {
      Alert.alert('Error', 'Could not update name. Try again.')
      return
    }

    queryClient.invalidateQueries({ queryKey: ['profile', deviceId] })
    router.back()
  }

  const showError = touched && tooShort
  const errorText = trimmed.length === 0 ? 'Name cannot be empty.' : 'Name must be at least 2 characters.'

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <BackButton />
          <Text style={s.headerTitle}>Your name</Text>
        </View>

        <View style={s.flex}>
          <View style={s.preview}>
            <InitialsAvatar name={trimmed || profile?.display_name} deviceId={deviceId ?? undefined} size={80} />
            <Text style={s.previewCaption}>Preview updates as you type</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Display name</Text>
            <View style={[s.inputWrap, focused && s.inputWrapFocused]}>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text)
                  setTouched(true)
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleSave}
                placeholder="Enter your name"
                placeholderTextColor={c.stone400}
                style={s.input}
                maxLength={MAX_LEN}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                autoFocus
              />
              {name.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setName('')
                    setTouched(true)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear name"
                  style={s.clearBtn}
                >
                  <XCircle size={20} color={c.stone400} />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.metaRow}>
              <Text style={[s.hint, showError && s.error]}>
                {showError ? errorText : 'Shown on the leaderboard and your Pulse posts.'}
              </Text>
              <Text style={s.counter}>{name.length}/{MAX_LEN}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={c.white} />
            ) : (
              <Text style={s.saveBtnText}>Save name</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = () => {
  const t = themed(false)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: '#111111', letterSpacing: -0.5 },
    preview: { alignItems: 'center', marginTop: 12 },
    previewCaption: { fontSize: 13, fontFamily: font.regular, color: '#6B7280', marginTop: 8 },
    field: { paddingHorizontal: 24, marginTop: 24 },
    label: { fontSize: 14, fontFamily: font.semibold, color: '#374151', marginBottom: 6 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      backgroundColor: c.white,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#E7E5E4',
      paddingLeft: 14,
      paddingRight: 4,
    },
    inputWrapFocused: { borderWidth: 2, borderColor: brand.orange },
    input: { flex: 1, fontSize: 17, fontFamily: font.regular, color: '#111111', paddingVertical: 0 },
    clearBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 12 },
    hint: { flex: 1, fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
    error: { color: c.red500 },
    counter: { fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
    footer: { paddingHorizontal: 24, paddingVertical: 12 },
    saveBtn: {
      height: 48,
      backgroundColor: brand.orange,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: c.white, fontSize: 16, fontFamily: font.semibold },
  })
}
