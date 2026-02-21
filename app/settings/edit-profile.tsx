import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, MapPin, Check } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { supabase } from '@/lib/supabase/client'
import InitialsAvatar from '@/components/InitialsAvatar'

interface Route {
  id: string
  from_location: string
  to_location: string
}

export default function EditProfileScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [homeRouteId, setHomeRouteId] = useState<string | null>(profile?.home_route_id ?? null)
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true)
  const [routes, setRoutes] = useState<Route[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Load routes
    supabase
      .from('routes')
      .select('id, from_location, to_location')
      .eq('is_popular', true)
      .order('from_location')
      .then(({ data }) => {
        if (data) setRoutes(data)
      })
  }, [])

  const handleSave = async () => {
    if (!deviceId) return
    setIsSaving(true)

    try {
      // Build update object
      const updates: Record<string, unknown> = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        home_route_id: homeRouteId,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      }

      // If setting home route, also set the label
      if (homeRouteId) {
        const route = routes.find((r) => r.id === homeRouteId)
        if (route) {
          updates.home_route_label = `${route.from_location} → ${route.to_location}`
        }
      } else {
        updates.home_route_label = null
      }

      const { error } = await supabase
        .from('contributor_profiles')
        .update(updates)
        .eq('device_id', deviceId)

      if (error) {
        Alert.alert('Error', 'Could not update profile. Try again.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['profile', deviceId] })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not update profile. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <ChevronLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving} activeOpacity={0.7} style={s.saveHeaderBtn}>
          {isSaving ? (
            <ActivityIndicator size="small" color={c.amber500} />
          ) : (
            <Check size={20} color={c.amber500} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarCenter}>
          <InitialsAvatar name={displayName || profile?.display_name} size={80} />
        </View>

        {/* Display Name */}
        <View style={s.field}>
          <Text style={s.label}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={(text) => setDisplayName(text.slice(0, 30))}
            placeholder="Your name"
            placeholderTextColor={t.textTertiary}
            style={s.input}
            maxLength={30}
          />
          <Text style={s.counter}>{displayName.length}/30</Text>
        </View>

        {/* Bio */}
        <View style={s.field}>
          <Text style={s.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, 160))}
            placeholder="Tell the community about yourself..."
            placeholderTextColor={t.textTertiary}
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            multiline
            maxLength={160}
          />
          <Text style={s.counter}>{bio.length}/160</Text>
        </View>

        {/* Home Route */}
        <View style={s.field}>
          <Text style={s.label}>Home Route</Text>
          <TouchableOpacity
            onPress={() => setHomeRouteId(null)}
            activeOpacity={0.7}
            style={[s.routeChip, !homeRouteId && s.routeChipActive]}
          >
            <Text style={[s.routeChipText, !homeRouteId && s.routeChipTextActive]}>
              No home route
            </Text>
          </TouchableOpacity>
          {routes.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setHomeRouteId(r.id)}
              activeOpacity={0.7}
              style={[s.routeChip, homeRouteId === r.id && s.routeChipActive]}
            >
              <MapPin size={14} color={homeRouteId === r.id ? c.white : c.pink500} />
              <Text style={[s.routeChipText, homeRouteId === r.id && s.routeChipTextActive]}>
                {r.from_location} → {r.to_location}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={s.hint}>Set your regular commute to discover fellow commuters</Text>
        </View>

        {/* Public Profile Toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Public Profile</Text>
            <Text style={s.toggleHint}>Let others discover and follow you</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsPublic(!isPublic)}
            style={[s.toggle, isPublic ? s.toggleOn : s.toggleOff]}
          >
            <View style={[s.toggleThumb, isPublic ? s.thumbOn : s.thumbOff]} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    backBtn: { marginRight: 8, padding: 4 },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: font.bold, color: t.text },
    saveHeaderBtn: { padding: 8 },
    scroll: { flex: 1, paddingHorizontal: 20 },
    avatarCenter: { alignItems: 'center', marginVertical: 24 },
    field: { marginBottom: 20 },
    label: {
      fontSize: 13,
      fontFamily: font.medium,
      color: isDark ? c.stone300 : c.stone600,
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
    counter: {
      fontSize: 12,
      color: t.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    hint: {
      fontSize: 12,
      color: t.textTertiary,
      marginTop: 4,
    },
    routeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },
    routeChipActive: {
      backgroundColor: c.amber500,
    },
    routeChipText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
    },
    routeChipTextActive: {
      color: c.white,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    toggleLabel: { fontSize: 14, fontFamily: font.medium, color: t.text },
    toggleHint: { fontSize: 12, color: t.textTertiary, marginTop: 2 },
    toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
    toggleOn: { backgroundColor: c.amber500 },
    toggleOff: { backgroundColor: isDark ? c.stone700 : c.stone300 },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.white },
    thumbOn: { marginLeft: 22 },
    thumbOff: { marginLeft: 2 },
  })
}
