import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { supabase } from '@/lib/supabase/client'

interface SocialPreferences {
  follower_tales: boolean
  tale_likes: boolean
  tale_comments: boolean
  new_followers: boolean
  route_activity: boolean
  streak_risk: boolean
  weekly_recap: boolean
  route_digest: boolean
  like_milestones: boolean
  quiet_start: string
  quiet_end: string
}

const DEFAULT_PREFS: SocialPreferences = {
  follower_tales: true,
  tale_likes: true,
  tale_comments: true,
  new_followers: true,
  route_activity: true,
  streak_risk: true,
  weekly_recap: true,
  route_digest: true,
  like_milestones: true,
  quiet_start: '22:00',
  quiet_end: '06:00',
}

const PREF_SECTIONS = [
  {
    title: 'Social',
    items: [
      { key: 'new_followers' as const, label: 'New Followers', desc: 'When someone follows you' },
      { key: 'follower_tales' as const, label: 'Follower Posts', desc: 'When someone you follow posts to Pulse' },
      { key: 'tale_likes' as const, label: 'Pulse Likes', desc: 'When someone likes your post' },
      { key: 'tale_comments' as const, label: 'Pulse Comments', desc: 'When someone comments on your post' },
      { key: 'like_milestones' as const, label: 'Like Milestones', desc: 'When your post hits 5, 10, 25, 50, 100 likes' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { key: 'route_activity' as const, label: 'Route Activity', desc: 'Activity on your home route' },
      { key: 'streak_risk' as const, label: 'Streak Alerts', desc: 'When your reporting streak is at risk' },
    ],
  },
  {
    title: 'Digests',
    items: [
      { key: 'route_digest' as const, label: 'Daily Route Digest', desc: 'Daily summary of your route activity' },
      { key: 'weekly_recap' as const, label: 'Weekly Recap', desc: 'Your weekly contribution stats' },
    ],
  },
]

export default function NotificationSettingsScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { deviceId } = useApp()
  const [prefs, setPrefs] = useState<SocialPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) return

    supabase
      .from('notification_preferences')
      .select('*')
      .eq('device_id', deviceId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPrefs((prev) => ({ ...prev, ...data }))
        }
        setLoading(false)
      })
  }, [deviceId])

  const updatePref = useCallback(
    (key: keyof SocialPreferences, value: boolean) => {
      setPrefs((prev) => ({ ...prev, [key]: value }))

      // Upsert to Supabase
      supabase
        .from('notification_preferences')
        .upsert(
          {
            device_id: deviceId,
            [key]: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'device_id' }
        )
        .then(() => {})
    },
    [deviceId]
  )

  return (
    <SafeAreaView style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <ChevronLeft size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notification Preferences</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {PREF_SECTIONS.map((section) => (
            <View key={section.title} style={s.section}>
              <Text style={s.sectionLabel}>{section.title}</Text>
              <View style={s.card}>
                {section.items.map((item, i) => (
                  <View key={item.key}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={s.row}>
                      <View style={s.rowInfo}>
                        <Text style={s.rowLabel}>{item.label}</Text>
                        <Text style={s.rowDesc}>{item.desc}</Text>
                      </View>
                      <Switch
                        value={prefs[item.key] as boolean}
                        onValueChange={(v) => updatePref(item.key, v)}
                        trackColor={{ false: isDark ? c.stone700 : c.stone300, true: c.amber500 }}
                        thumbColor={c.white}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Quiet Hours */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Quiet Hours</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.rowInfo}>
                  <Text style={s.rowLabel}>
                    {prefs.quiet_start} — {prefs.quiet_end}
                  </Text>
                  <Text style={s.rowDesc}>No notifications during these hours</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backBtn: { marginRight: 8, padding: 4 },
    headerTitle: { fontSize: 20, fontFamily: font.bold, color: t.text },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionLabel: {
      fontSize: 13,
      fontFamily: font.bold,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    card: {
      borderRadius: 20,
      backgroundColor: t.card,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    rowInfo: { flex: 1, marginRight: 12 },
    rowLabel: { fontSize: 15, fontFamily: font.medium, color: t.text },
    rowDesc: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    divider: {
      height: 1,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      marginHorizontal: 16,
    },
  })
}
