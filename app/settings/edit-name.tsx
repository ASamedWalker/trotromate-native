import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { GlassBackButton } from '@/components/GlassBackButton'
import { useQueryClient } from '@tanstack/react-query'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { supabase } from '@/lib/supabase/client'

export default function EditNameScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.')
      return
    }
    if (!deviceId) return

    setIsSaving(true)
    const { error } = await supabase
      .from('contributor_profiles')
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)

    setIsSaving(false)

    if (error) {
      Alert.alert('Error', 'Could not update name. Try again.')
      return
    }

    queryClient.invalidateQueries({ queryKey: ['profile', deviceId] })
    router.back()
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <GlassBackButton isDark={isDark} />
        <Text style={s.headerTitle}>Edit Name</Text>
      </View>

      <View style={s.content}>
        <Text style={s.label}>Display Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={t.textTertiary}
          style={s.input}
          maxLength={30}
          autoFocus
        />
        <Text style={s.hint}>This is how you appear on the leaderboard and in Trotro Tales.</Text>

        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving || name.trim().length < 2}
          style={[s.saveBtn, (isSaving || name.trim().length < 2) && s.saveBtnDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={c.white} />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    content: { paddingHorizontal: 20, marginTop: 24 },
    label: {
      fontSize: 13,
      fontFamily: font.bold,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      backgroundColor: t.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: font.regular,
      color: t.text,
    },
    hint: {
      fontSize: 13,
      color: t.textTertiary,
      marginTop: 8,
      lineHeight: 18,
    },
    saveBtn: {
      marginTop: 24,
      backgroundColor: c.amber500,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: {
      color: c.white,
      fontSize: 16,
      fontFamily: font.semibold,
    },
  })
}
