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

export default function TermsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <GlassBackButton isDark={isDark} />
        <Text style={s.headerTitle}>Terms of Service</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.content}>
          <Text style={s.updated}>Last updated: {LAST_UPDATED}</Text>

          <Text style={s.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={s.body}>
            By using Troski, you agree to these Terms of Service. If you do not agree, please do not use the app.
          </Text>

          <Text style={s.sectionTitle}>2. Service Description</Text>
          <Text style={s.body}>
            Troski is a community-powered transit information platform. Users report fares, queue statuses, incidents, and train information to help fellow commuters in Ghana. The app also features a social component ("Trotro Tales") for sharing transit experiences.
          </Text>

          <Text style={s.sectionTitle}>3. User Accounts</Text>
          <Text style={s.body}>
            To use Troski, you create an account with your phone number, verified by a one-time password (OTP). During registration we also collect basic profile information such as your name, email, city, and gender. Your wallet balance and bookings are tied to this account. If you set a display name, it will be visible on leaderboards and in Trotro Tales.
          </Text>

          <Text style={s.sectionTitle}>4. Community Guidelines</Text>
          <Text style={s.body}>
            You agree to:{'\n'}
            • Report accurate and truthful transit information{'\n'}
            • Not submit false or misleading fare reports{'\n'}
            • Not upload inappropriate, offensive, or illegal content in Trotro Tales{'\n'}
            • Not attempt to manipulate the rewards/points system{'\n'}
            • Treat other community members with respect
          </Text>

          <Text style={s.sectionTitle}>5. Crowdsourced Data</Text>
          <Text style={s.body}>
            All transit data in Troski is crowdsourced and community-contributed. We make no guarantees about the accuracy, completeness, or timeliness of any fare, queue, incident, or train information. Always verify important transit details independently. Official fares may differ from reported fares.
          </Text>

          <Text style={s.sectionTitle}>6. Rewards & Points</Text>
          <Text style={s.body}>
            Points, levels, badges, and leaderboard rankings are for community engagement only. They have no monetary value and cannot be exchanged, transferred, or redeemed for cash or goods. We reserve the right to adjust point values, reset leaderboards, or modify the rewards system at any time.
          </Text>

          <Text style={s.sectionTitle}>7. Content Ownership</Text>
          <Text style={s.body}>
            You retain ownership of photos you upload to Trotro Tales. By posting, you grant Troski a non-exclusive, royalty-free license to display your content within the app. You can delete your content at any time.
          </Text>

          <Text style={s.sectionTitle}>8. Prohibited Activities</Text>
          <Text style={s.body}>
            You may not:{'\n'}
            • Use automated tools or bots to submit reports{'\n'}
            • Attempt to reverse-engineer or exploit the app{'\n'}
            • Impersonate other users or entities{'\n'}
            • Use the app for any illegal purpose
          </Text>

          <Text style={s.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={s.body}>
            Troski is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the app, including but not limited to reliance on inaccurate transit data, missed transportation, or financial loss.
          </Text>

          <Text style={s.sectionTitle}>10. Termination</Text>
          <Text style={s.body}>
            We may suspend or terminate access for users who violate these terms or engage in activities harmful to the community. You may stop using the app at any time by uninstalling it.
          </Text>

          <Text style={s.sectionTitle}>11. Governing Law</Text>
          <Text style={s.body}>
            These terms are governed by the laws of the Republic of Ghana. Any disputes shall be resolved in the courts of Ghana.
          </Text>

          <Text style={s.sectionTitle}>12. Contact</Text>
          <Text style={s.body}>
            For questions about these terms:{'\n\n'}
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
  })
}
