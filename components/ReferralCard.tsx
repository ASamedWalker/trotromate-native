import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Share, useColorScheme } from 'react-native'
import { Gift, Copy, Check, Share2, Users } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { supabase } from '@/lib/supabase'

export function ReferralCard() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const { deviceId } = useDeviceId()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) return

    async function fetchCode() {
      try {
        // Get profile
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

        // Count referrals
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
      // Native module not available — fall back to Share
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
    <View
      style={{
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 20,
        marginTop: 16,
        overflow: 'hidden',
        backgroundColor: c.amber500,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View
          style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Gift size={20} color={c.white} />
        </View>
        <View>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.white }}>
            Invite Friends, Earn Points
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            You both get 50 points
          </Text>
        </View>
      </View>

      {/* Code + Copy */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: c.white, letterSpacing: 2 }}>
            {referralCode}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCopy}
          activeOpacity={0.7}
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {copied ? <Check size={20} color={c.white} /> : <Copy size={20} color={c.white} />}
        </TouchableOpacity>
      </View>

      {/* Share Button */}
      <TouchableOpacity
        onPress={handleShare}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: c.white,
        }}
      >
        <Share2 size={16} color={c.amber500} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: c.amber500 }}>
          Share Invite
        </Text>
      </TouchableOpacity>

      {/* Count */}
      {referralCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <Users size={14} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            {referralCount} friend{referralCount !== 1 ? 's' : ''} joined
          </Text>
        </View>
      )}
    </View>
  )
}
