import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import {
  ChevronRight,
  Bell,
  Eye,
  FileText,
  Shield,
  HelpCircle,
  Trash2,
  Sun,
  Moon,
  Smartphone,
  Camera,
  Globe,
} from 'lucide-react-native'
import { Linking } from 'react-native'
import { GlassBackButton } from '@/components/GlassBackButton'
import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Updates from 'expo-updates'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { usePreferences, type ThemeMode } from '@/lib/hooks/usePreferences'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'

export default function SettingsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const { prefs, updatePref } = usePreferences()
  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']

  const themeOptions: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
    { key: 'system', label: 'System', icon: Smartphone },
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
  ]

  const handleThemeChange = (mode: ThemeMode) => {
    updatePref('theme', mode)
    Appearance.setColorScheme(mode === 'system' ? null : mode)
  }

  const handleClearData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will clear your cached data, preferences, and dismissed items. Your reports and points are safe on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              '@troski_preferences',
              'activity_dismissed_ids',
              '@troski_favorites',
              '@troski_onboarding_done',
            ])
            Alert.alert('Done', 'Local data cleared.')
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <GlassBackButton isDark={isDark} />
          <Text style={s.headerTitle}>Settings</Text>
        </View>

        {/* Profile Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Profile</Text>
          <View style={s.card}>
            <TouchableOpacity
              onPress={() => router.push('/settings/edit-name' as Href)}
              activeOpacity={0.7}
              style={s.profileRow}
            >
              <InitialsAvatar
                name={profile?.display_name}
                deviceId={deviceId ?? undefined}
                size={48}
              />
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{profile?.display_name ?? 'Commuter'}</Text>
                <Text style={s.profileSub}>{levelInfo.emoji} {levelInfo.name}</Text>
              </View>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Appearance</Text>
          <View style={s.card}>
            <View style={s.themeRow}>
              {themeOptions.map((opt) => {
                const Icon = opt.icon
                const active = prefs.theme === opt.key
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => handleThemeChange(opt.key)}
                    activeOpacity={0.7}
                    style={[s.themeOption, active && s.themeOptionActive]}
                  >
                    <Icon size={18} color={active ? c.amber500 : t.textSecondary} />
                    <Text style={[s.themeLabel, active && s.themeLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Notifications</Text>
          <View style={s.card}>
            <View style={s.settingRow}>
              <Bell size={18} color={t.textSecondary} />
              <View style={s.settingInfo}>
                <Text style={s.settingLabel}>Push Notifications</Text>
                <Text style={s.settingDesc}>Get notified about fare drops and alerts</Text>
              </View>
              <Switch
                value={prefs.pushNotifications}
                onValueChange={(v) => updatePref('pushNotifications', v)}
                trackColor={{ false: isDark ? c.stone700 : c.stone300, true: c.amber500 }}
                thumbColor={c.white}
              />
            </View>
            <View style={s.divider} />
            <TouchableOpacity
              onPress={() => router.push('/settings/notifications' as Href)}
              activeOpacity={0.7}
              style={s.linkRow}
            >
              <View style={{ width: 18 }} />
              <Text style={s.linkLabel}>Notification Preferences</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Privacy</Text>
          <View style={s.card}>
            <View style={s.settingRow}>
              <Eye size={18} color={t.textSecondary} />
              <View style={s.settingInfo}>
                <Text style={s.settingLabel}>Profile Visibility</Text>
                <Text style={s.settingDesc}>Show your name on the leaderboard</Text>
              </View>
              <Switch
                value={prefs.profileVisibility}
                onValueChange={(v) => updatePref('profileVisibility', v)}
                trackColor={{ false: isDark ? c.stone700 : c.stone300, true: c.amber500 }}
                thumbColor={c.white}
              />
            </View>
          </View>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>About</Text>
          <View style={s.card}>
            <TouchableOpacity
              onPress={() => router.push('/terms' as Href)}
              activeOpacity={0.7}
              style={s.linkRow}
            >
              <FileText size={18} color={t.textSecondary} />
              <Text style={s.linkLabel}>Terms of Service</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              onPress={() => router.push('/privacy' as Href)}
              activeOpacity={0.7}
              style={s.linkRow}
            >
              <Shield size={18} color={t.textSecondary} />
              <Text style={s.linkLabel}>Privacy Policy</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity activeOpacity={0.7} style={s.linkRow}>
              <HelpCircle size={18} color={t.textSecondary} />
              <Text style={s.linkLabel}>Help & Support</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Data</Text>
          <View style={s.card}>
            <TouchableOpacity onPress={handleClearData} activeOpacity={0.7} style={s.linkRow}>
              <Trash2 size={18} color={c.red500} />
              <Text style={[s.linkLabel, { color: c.red500 }]}>Clear Local Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Follow Us */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Follow Us</Text>
          <View style={s.card}>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.instagram.com/troski.app/')}
              activeOpacity={0.7}
              style={s.linkRow}
            >
              <Camera size={18} color="#E4405F" />
              <Text style={s.linkLabel}>Instagram</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.facebook.com/troski.me')}
              activeOpacity={0.7}
              style={s.linkRow}
            >
              <Globe size={18} color="#1877F2" />
              <Text style={s.linkLabel}>Facebook</Text>
              <ChevronRight size={18} color={t.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.version}>Troski v{Updates.runtimeVersion ?? '?'}</Text>
          <Text style={s.footerText}>Made with love in Accra</Text>
          {!__DEV__ && (
            <Text style={s.footerText}>
              {Updates.isEmbeddedLaunch ? 'Embedded' : `OTA ${Updates.updateId?.slice(0, 8) ?? '—'}`}
              {' · '}{Updates.channel ?? 'no-channel'}
            </Text>
          )}
        </View>
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
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
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
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    profileInfo: { marginLeft: 14, flex: 1 },
    profileName: { fontSize: 16, fontFamily: font.semibold, color: t.text },
    profileSub: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    settingInfo: { marginLeft: 14, flex: 1 },
    settingLabel: { fontSize: 15, fontFamily: font.medium, color: t.text },
    settingDesc: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    linkLabel: { fontSize: 15, fontFamily: font.medium, color: t.text, marginLeft: 14, flex: 1 },
    themeRow: {
      flexDirection: 'row',
      padding: 8,
      gap: 8,
    },
    themeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: isDark ? c.stone900 : c.stone50,
      gap: 6,
    },
    themeOptionActive: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      borderWidth: 1.5,
      borderColor: c.amber500,
    },
    themeLabel: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    themeLabelActive: {
      color: c.amber500,
      fontFamily: font.semibold,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      marginHorizontal: 16,
    },
    footer: { alignItems: 'center', paddingVertical: 32 },
    version: { fontSize: 13, fontFamily: font.semibold, color: c.amber500 },
    footerText: { fontSize: 12, color: t.textTertiary, marginTop: 4 },
  })
}
