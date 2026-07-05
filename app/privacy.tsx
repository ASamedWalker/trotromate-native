import { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GlassBackButton } from '@/components/GlassBackButton'
import { themed, font } from '@/lib/theme'

const LAST_UPDATED = 'February 6, 2026'

export default function PrivacyScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <GlassBackButton isDark={isDark} />
        <Text style={s.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.content}>
          <Text style={s.updated}>Last updated: {LAST_UPDATED}</Text>

          <Text style={s.sectionTitle}>1. Introduction</Text>
          <Text style={s.body}>
            Troski ("we", "our", "the app") is a community-powered transit information platform for Ghana. This Privacy Policy explains how we collect, use, and protect your information in compliance with the Ghana Data Protection Act, 2012 (Act 843).
          </Text>

          <Text style={s.sectionTitle}>2. Information We Collect</Text>
          <Text style={s.body}>
            <Text style={s.bold}>Account &amp; Profile:</Text> To create an account, we collect your phone number and verify it via a one-time password (OTP). We also collect optional profile information you provide, such as your name, email, city, and gender. We generate a device identifier stored on your device to support anonymous crowdsourced contributions.
          </Text>
          <Text style={s.body}>
            <Text style={s.bold}>Reports:</Text> When you submit fare reports, queue reports, incident reports, or train reports, we store the report data along with your device ID and approximate location (station/route name, not GPS coordinates).
          </Text>
          <Text style={s.body}>
            <Text style={s.bold}>Photos:</Text> If you share a Trotro Tale, the photo is uploaded and stored. You can delete your tales at any time.
          </Text>
          <Text style={s.body}>
            <Text style={s.bold}>Usage Data:</Text> We collect basic analytics about app usage (screens visited, features used) to improve the app experience.
          </Text>
          <Text style={s.body}>
            <Text style={s.bold}>Wallet &amp; Bookings:</Text> If you top up your wallet or make a booking, we store the transaction data (amount, method, date) needed to process and reconcile it.
          </Text>
          <Text style={s.body}>
            <Text style={s.bold}>Device Data:</Text> We collect basic device information (device model, OS version, push notification token) to support app functionality and notifications.
          </Text>

          <Text style={s.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={s.body}>
            • Display crowdsourced transit data to all users{'\n'}
            • Calculate and display leaderboards and rewards{'\n'}
            • Improve the accuracy and reliability of transit information{'\n'}
            • Send you notifications about fare changes and queue alerts (if enabled)
          </Text>

          <Text style={s.sectionTitle}>4. Data Sharing</Text>
          <Text style={s.body}>
            We do not sell, trade, or rent your personal information. Aggregated, anonymized transit data (average fares, queue lengths) may be shared publicly to benefit commuters. Individual reports are attributed only to anonymous display names.
          </Text>

          <Text style={s.sectionTitle}>5. Data Security</Text>
          <Text style={s.body}>
            Your data is stored securely on Supabase servers with encryption at rest and in transit. Access is restricted through Row-Level Security policies. However, no method of electronic storage is 100% secure.
          </Text>

          <Text style={s.sectionTitle}>6. Your Rights</Text>
          <Text style={s.body}>
            Under the Ghana Data Protection Act (Act 843), you have the right to:{'\n'}
            • Access your personal data{'\n'}
            • Request correction of inaccurate data{'\n'}
            • Request deletion of your data{'\n'}
            • Withdraw consent for data processing{'\n\n'}
            To exercise these rights, contact us at the address below. Since accounts are device-based, clearing app data effectively removes your local association with your reports.
          </Text>

          <Text style={s.sectionTitle}>7. Data Retention</Text>
          <Text style={s.body}>
            Report data is retained indefinitely to maintain historical transit records. Your device ID and display name can be reset by clearing app data. Points and rewards history are tied to your device ID.
          </Text>

          <Text style={s.sectionTitle}>8. Children's Privacy</Text>
          <Text style={s.body}>
            Troski is not directed at children under 13. We do not knowingly collect data from children.
          </Text>

          <Text style={s.sectionTitle}>9. Changes to This Policy</Text>
          <Text style={s.body}>
            We may update this policy from time to time. Changes will be reflected in the "Last updated" date. Continued use of the app constitutes acceptance of the updated policy.
          </Text>

          <Text style={s.sectionTitle}>10. Contact Us</Text>
          <Text style={s.body}>
            For questions about this Privacy Policy or to exercise your data rights:{'\n\n'}
            Email: support@troski.me{'\n'}
            Location: Accra, Ghana
          </Text>

          <View style={{ height: 40 }} />
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
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 16 },
    updated: { fontSize: 13, color: t.textTertiary, marginBottom: 20 },
    sectionTitle: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
      marginTop: 20,
      marginBottom: 8,
    },
    body: { fontSize: 14, color: t.textSecondary, lineHeight: 22 },
    bold: { fontFamily: font.semibold, color: t.text },
  })
}
