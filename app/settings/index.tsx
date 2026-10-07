import { useMemo, useState, useEffect, type ReactNode } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  Linking,
  AppState,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLanguage } from '@/lib/i18n'
import { useRouter, type Href } from 'expo-router'
import {
  ChevronRight,
  Bell,
  FileText,
  Shield,
  Trash2,
  Globe,
  SlidersHorizontal,
  MessageCircle,
  Mail,
  LogOut,
  Instagram,
  Facebook,
} from 'lucide-react-native'
import { BackButton } from '@/components/BackButton'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Updates from 'expo-updates'
import Constants from 'expo-constants'
import { themed, font, brand } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { signOutAndWipe } from '@/lib/services/signOut'
import { deleteAccount } from '@/lib/services/account'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { usePreferences } from '@/lib/hooks/usePreferences'
import { LEVELS } from '@/lib/constants/rewards'
import InitialsAvatar from '@/components/InitialsAvatar'
import { LanguageSheet } from '@/components/LanguageSheet'
import { SUPPORT_WHATSAPP } from '@/lib/config/support'

export default function SettingsScreen() {
  const router = useRouter()
  const s = useMemo(() => getStyles(), [])
  const { lang, languages } = useLanguage()
  const [langOpen, setLangOpen] = useState(false)
  const [showBuild, setShowBuild] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { profile, deviceId, resetIdentity } = useApp()
  const { prefs, updatePref } = usePreferences()
  const levelInfo = LEVELS[profile?.current_level ?? 'passenger']

  const handleClearData = () => {
    Alert.alert(
      'Clear cached data',
      'This clears cached data, preferences, and dismissed items on this phone. You stay signed in, and your reports and coins are safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              '@troski_preferences_v2',
              'activity_dismissed_ids',
              'troski-favorite-routes',
            ])
            Alert.alert('Done', 'Cached data cleared.')
          },
        },
      ]
    )
  }

  const { isAuthenticated, user } = useAuthContext()
  const phone = user?.phone ? (user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : null

  // OS permission is the real gate for push; null until read.
  const [osPushGranted, setOsPushGranted] = useState<boolean | null>(null)
  useEffect(() => {
    const check = () => {
      import('expo-notifications')
        .then((N) => N.getPermissionsAsync())
        .then(({ status }) => setOsPushGranted(status === 'granted'))
        .catch(() => setOsPushGranted(null))
    }
    check()
    // Re-check when returning from the OS Settings app.
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check() })
    return () => sub.remove()
  }, [])

  const handleEmailSupport = async () => {
    const url = 'mailto:support@troski.me?subject=Troski%20Help%20%26%20Support'
    // No canOpenURL: iOS returns false unless mailto is in LSApplicationQueriesSchemes.
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert('Email support', 'Email us at support@troski.me')
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOutAndWipe(deviceId, resetIdentity)
          router.replace({ pathname: '/auth/phone', params: { from: 'signout' } } as unknown as Href)
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This removes your profile, phone number and coins. Your fare reports and Pulse posts stay, shown as "Former rider". Wallet money must be withdrawn first. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              const { error, code } = await deleteAccount(resetIdentity)
              if (code === 'session_ended') {
                // The phone was already wiped; leave the signed-in screens.
                router.replace({ pathname: '/auth/phone', params: { from: 'signout' } } as unknown as Href)
                Alert.alert('Signed out', error ?? undefined)
                return
              }
              if (error) {
                Alert.alert(code === 'wallet_not_empty' ? 'Withdraw your balance first' : 'Could not delete account', error)
                return
              }
              router.replace({ pathname: '/auth/phone', params: { from: 'signout' } } as unknown as Href)
            } catch {
              Alert.alert('Could not delete account', 'Please check your connection and try again.')
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
    )
  }

  const langNative = languages.find((l) => l.code === lang)?.native ?? 'English'

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Header */}
        <View style={s.header}>
          <BackButton />
          <Text style={s.headerTitle}>Settings</Text>
        </View>

        {/* Profile card */}
        <View style={s.section}>
          <TouchableOpacity
            onPress={() => router.push('/settings/edit-name' as Href)}
            activeOpacity={0.7}
            style={[s.card, s.profileRow]}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            <InitialsAvatar name={profile?.display_name} deviceId={deviceId ?? undefined} size={56} />
            <View style={s.profileInfo}>
              <Text style={s.profileName} numberOfLines={1}>{profile?.display_name ?? 'Commuter'}</Text>
              {isAuthenticated && phone ? <Text style={s.profileSub}>{phone}</Text> : null}
              <View style={s.tierRow}>
                <View style={s.tierPill}>
                  <Text style={s.tierText}>{levelInfo.name}</Text>
                </View>
                {typeof profile?.total_points === 'number' ? (
                  <Text style={s.profileSub}> · {profile.total_points} coins</Text>
                ) : null}
              </View>
            </View>
            <Text style={s.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Preferences</Text>
          <View style={s.card}>
            <Row
              s={s}
              icon={<Globe size={18} color="#111111" />}
              label="Language"
              value={langNative}
              onPress={() => setLangOpen(true)}
            />
            <View style={s.divider} />
            <Row
              s={s}
              icon={<Bell size={18} color="#111111" />}
              label="Push notifications"
              sub="Fare changes, alerts, Pulse replies"
              right={
                <Switch
                  accessibilityLabel="Push notifications"
                  value={prefs.pushNotifications && osPushGranted !== false}
                  onValueChange={async (v) => {
                    if (!v) {
                      updatePref('pushNotifications', false)
                      return
                    }
                    // The pref alone can't deliver anything — the OS permission
                    // is the real gate. Request it here so the toggle is honest.
                    const Notifications = await import('expo-notifications')
                    const { status } = await Notifications.getPermissionsAsync()
                    const final =
                      status === 'granted'
                        ? status
                        : (await Notifications.requestPermissionsAsync()).status
                    setOsPushGranted(final === 'granted')
                    updatePref('pushNotifications', final === 'granted')
                    if (final !== 'granted') {
                      Alert.alert(
                        'Notifications are off in Settings',
                        'Your phone is blocking Troski notifications. Turn them on in system Settings to receive alerts.',
                        [
                          { text: 'Not now', style: 'cancel' },
                          { text: 'Open Settings', onPress: () => Linking.openSettings() },
                        ],
                      )
                    }
                  }}
                  trackColor={{ false: '#D6D3D1', true: brand.orange }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={s.divider} />
            <Row
              s={s}
              icon={<SlidersHorizontal size={18} color="#111111" />}
              label="Choose what you get"
              onPress={() => router.push('/settings/notifications' as Href)}
              chevron
            />
          </View>
        </View>

        {/* Help */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Help</Text>
          <View style={s.card}>
            {SUPPORT_WHATSAPP ? (
              <>
                <Row
                  s={s}
                  icon={<MessageCircle size={18} color="#15803D" />}
                  tileBg="#DCFCE7"
                  label="Chat on WhatsApp"
                  sub="Talk to the Troski team"
                  onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() => {})}
                  chevron
                />
                <View style={s.divider} />
              </>
            ) : null}
            <Row
              s={s}
              icon={<Mail size={18} color="#111111" />}
              label="Email support"
              sub="support@troski.me"
              onPress={handleEmailSupport}
              chevron
            />
          </View>
        </View>

        {/* Legal & data */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Legal & data</Text>
          <View style={s.card}>
            <Row
              s={s}
              icon={<FileText size={18} color="#111111" />}
              label="Terms of Service"
              onPress={() => router.push('/terms' as Href)}
              chevron
            />
            <View style={s.divider} />
            <Row
              s={s}
              icon={<Shield size={18} color="#111111" />}
              label="Privacy Policy"
              onPress={() => router.push('/privacy' as Href)}
              chevron
            />
            <View style={s.divider} />
            <Row
              s={s}
              icon={<Trash2 size={18} color="#111111" />}
              label="Clear cached data"
              sub="Frees space. Account, reports and coins stay."
              onPress={handleClearData}
            />
          </View>
        </View>

        {/* Sign out (only with a real session) */}
        {isAuthenticated && (
          <View style={s.section}>
            <TouchableOpacity
              onPress={handleSignOut}
              activeOpacity={0.8}
              style={s.signOutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <LogOut size={18} color="#111111" />
              <Text style={s.signOutLabel}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={deleting}
              activeOpacity={0.7}
              style={s.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              {deleting ? <ActivityIndicator color="#B91C1C" /> : <Text style={s.deleteLabel}>Delete account</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.socialRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.instagram.com/troski.app/')}
              activeOpacity={0.7}
              style={s.socialBtn}
              accessibilityRole="button"
              accessibilityLabel="Troski on Instagram"
            >
              <Instagram size={20} color="#111111" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.facebook.com/troski.me')}
              activeOpacity={0.7}
              style={s.socialBtn}
              accessibilityRole="button"
              accessibilityLabel="Troski on Facebook"
            >
              <Facebook size={20} color="#111111" />
            </TouchableOpacity>
          </View>
          <Text
            style={s.version}
            onLongPress={() => setShowBuild((v) => !v)}
            suppressHighlighting
          >
            Troski {Constants.expoConfig?.version ?? '?'} · Made in Accra
          </Text>
          {showBuild && !__DEV__ && (
            <Text style={s.buildText}>
              {Updates.isEmbeddedLaunch ? 'Embedded' : `OTA ${Updates.updateId?.slice(0, 8) ?? '—'}`}
              {' · '}{Updates.channel ?? 'no-channel'}
            </Text>
          )}
        </View>
      </ScrollView>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </SafeAreaView>
  )
}

type Styles = ReturnType<typeof getStyles>

function Row({
  s,
  icon,
  tileBg,
  label,
  sub,
  value,
  right,
  chevron,
  onPress,
}: {
  s: Styles
  icon: ReactNode
  tileBg?: string
  label: string
  sub?: string
  value?: string
  right?: ReactNode
  chevron?: boolean
  onPress?: () => void
}) {
  const inner = (
    <>
      <View style={[s.tile, tileBg ? { backgroundColor: tileBg } : null]}>{icon}</View>
      <View style={s.rowInfo}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {right}
      {value || chevron ? <ChevronRight size={18} color="#9CA3AF" /> : null}
    </>
  )
  if (!onPress) return <View style={s.row}>{inner}</View>
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.row} accessibilityRole="button">
      {inner}
    </TouchableOpacity>
  )
}

const getStyles = () => {
  const t = themed(false)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { paddingBottom: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 0,
    },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: '#111111', letterSpacing: -0.5 },
    section: { paddingHorizontal: 24, marginTop: 28 },
    sectionLabel: {
      fontSize: 14,
      fontFamily: font.medium,
      color: '#6B7280',
      marginLeft: 4,
      marginBottom: 8,
    },
    card: {
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#EFEDEB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    profileInfo: { marginLeft: 14, flex: 1 },
    profileName: { fontSize: 18, fontFamily: font.semibold, color: '#111111' },
    profileSub: { fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
    tierRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    tierPill: { backgroundColor: '#FFEDD5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
    tierText: { fontSize: 12, fontFamily: font.semibold, color: '#9A3412' },
    editText: { fontSize: 14, fontFamily: font.semibold, color: '#C2361A', marginLeft: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tile: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#F5F5F4',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowInfo: { marginLeft: 14, flex: 1 },
    rowLabel: { fontSize: 16, fontFamily: font.medium, color: '#111111' },
    rowSub: { fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
    rowValue: { fontSize: 15, fontFamily: font.regular, color: '#6B7280', marginRight: 6 },
    divider: { height: 1, backgroundColor: '#F2F1EF', marginLeft: 64 },
    signOutBtn: {
      height: 48,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E7E5E4',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    deleteBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    deleteLabel: { fontSize: 15, fontFamily: font.semibold, color: '#B91C1C' },
    signOutLabel: { fontSize: 16, fontFamily: font.semibold, color: '#111111' },
    footer: { alignItems: 'center', paddingTop: 28, paddingBottom: 8 },
    socialRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    socialBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: '#E7E5E4',
      alignItems: 'center',
      justifyContent: 'center',
    },
    version: { fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
    buildText: { fontSize: 12, fontFamily: font.regular, color: '#6B7280', marginTop: 4 },
  })
}
