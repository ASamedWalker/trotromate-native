import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Share, useColorScheme, StyleSheet } from 'react-native'
import { Gift, Copy, Check, Share2, Users } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { supabase } from '@/lib/supabase'

export function ReferralCard() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const { deviceId } = useDeviceId()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) return

    async function fetchCode() {
      try {
        const { data: profile } = await supabase
          .from('contributor_profiles')
          .select('id, referral_code, referral_count')
          .eq('device_id', deviceId)
          .single()

        if (!profile) { setLoading(false); return }

        let code = profile.referral_code
        if (!code) {
          code = `TROSKI-${deviceId!.substring(0, 4).toUpperCase()}`
          await supabase
            .from('contributor_profiles')
            .update({ referral_code: code })
            .eq('id', profile.id)
        }

        setReferralCode(code)

        const { count } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_device_id', deviceId)

        setReferralCount(count || 0)
      } catch {
        // Ignore
      }
      setLoading(false)
    }
    fetchCode()
  }, [deviceId])

  const handleCopy = async () => {
    if (!referralCode) return
    try {
      const Clipboard = require('expo-clipboard')
      await Clipboard.setStringAsync(referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      await handleShare()
    }
  }

  const handleShare = async () => {
    if (!referralCode) return
    try {
      await Share.share({
        message: `Use my referral code ${referralCode} on Troski and we both get 50 points! Check trotro fares, okada prices & more. https://www.troski.me`,
      })
    } catch {
      // User cancelled
    }
  }

  if (loading || !referralCode) return null

  return (
    <View style={s.card}>
      {/* Top row — icon + text + share arrow */}
      <View style={s.topRow}>
        <View style={s.iconWrap}>
          <Gift size={22} color={isDark ? c.amber400 : c.amber600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Invite Friends</Text>
          <Text style={s.subtitle}>You both earn 50 bonus points</Text>
        </View>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={s.shareBtn}>
          <Share2 size={18} color={c.white} />
        </TouchableOpacity>
      </View>

      {/* Code row */}
      <View style={s.codeRow}>
        <View style={s.codeBox}>
          <Text style={s.codeText}>{referralCode}</Text>
        </View>
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.copyBtn}>
          {copied ? (
            <>
              <Check size={16} color={c.emerald500} />
              <Text style={[s.copyText, { color: c.emerald500 }]}>Copied</Text>
            </>
          ) : (
            <>
              <Copy size={16} color={isDark ? c.amber400 : c.amber600} />
              <Text style={s.copyText}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Referral count */}
      {referralCount > 0 && (
        <View style={s.countRow}>
          <Users size={14} color={isDark ? c.stone400 : c.stone500} />
          <Text style={s.countText}>
            {referralCount} friend{referralCount !== 1 ? 's' : ''} joined
          </Text>
        </View>
      )}
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)

  // M3 surface tones
  const surfaceContainer = isDark ? '#211F26' : '#F3EDF7'
  const surfaceContainerHigh = isDark ? '#2B2930' : '#ECE6F0'
  const outlineVariant = isDark ? '#49454F' : '#CAC4D0'

  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginBottom: 16,
      padding: 20,
      borderRadius: 24,
      backgroundColor: surfaceContainer,
      borderWidth: 1,
      borderColor: outlineVariant,
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
      letterSpacing: 0.15,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },
    shareBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
    },

    codeRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    codeBox: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: surfaceContainerHigh,
      borderWidth: 1,
      borderColor: outlineVariant,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    codeText: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
      letterSpacing: 2.5,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
    },
    copyText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: isDark ? c.amber400 : c.amber600,
    },

    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: outlineVariant,
    },
    countText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
  })
}
