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
      {/* Top row — icon + text */}
      <View style={s.topRow}>
        <View style={s.iconWrap}>
          <Gift size={22} color="#815100" />
        </View>
        <View>
          <Text style={s.title}>Invite Friends</Text>
          <Text style={s.subtitle}>Get 500 pts per referral</Text>
        </View>
      </View>

      {/* Code row — dashed box + copy + share */}
      <View style={s.codeRow}>
        <View style={s.codeBox}>
          <Text style={s.codeText}>{referralCode}</Text>
        </View>
        <View style={s.actionBtns}>
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.copyBtn}>
            {copied ? (
              <Check size={18} color={c.emerald500} />
            ) : (
              <Copy size={18} color="#815100" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={s.shareBtn}>
            <Share2 size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Fine print */}
      <Text style={s.finePrint}>
        Referrals must complete 3 trips to unlock rewards
      </Text>

      {/* Referral count */}
      {referralCount > 0 && (
        <View style={s.countRow}>
          <Users size={14} color={isDark ? c.stone400 : '#5f5b59'} />
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

  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'

  return StyleSheet.create({
    card: {
      marginBottom: 20,
      padding: 22,
      borderRadius: 28,
      backgroundColor: surfaceLowest,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0 : 0.1,
      shadowRadius: 40,
      elevation: isDark ? 0 : 6,
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(129,81,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    subtitle: {
      fontSize: 12,
      fontFamily: font.regular,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59',
      marginTop: 2,
    },

    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    codeBox: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: surfaceLow,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(178,172,170,0.3)',
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    codeText: {
      fontSize: 18,
      fontFamily: font.extrabold,
      color: t.text,
      letterSpacing: 3,
    },
    actionBtns: {
      flexDirection: 'row',
      gap: 8,
    },
    copyBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 4,
      elevation: isDark ? 0 : 2,
    },
    shareBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#815100',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#815100',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },

    finePrint: {
      fontSize: 10,
      fontFamily: font.medium,
      color: isDark ? 'rgba(255,255,255,0.4)' : '#5f5b59',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },

    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#e3dbd8',
    },
    countText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59',
    },
  })
}
