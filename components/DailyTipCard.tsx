import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { Lightbulb, Plus, X, Send } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useCommuterTips, submitTip, type CommuterTip } from '@/lib/hooks/useCommuterTips'
import { useApp } from '@/lib/contexts/AppContext'
import { TIP_POINTS } from '@/lib/constants/rewards'

const CATEGORIES = [
  { key: 'trotro', label: 'Trotro' },
  { key: 'train', label: 'Train' },
  { key: 'gprtu', label: 'GPRTU' },
  { key: 'safety', label: 'Safety' },
  { key: 'general', label: 'General' },
] as const

interface Props {
  category?: string
  tip?: CommuterTip
}

export function DailyTipCard({ category, tip: overrideTip }: Props) {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { dailyTip } = useCommuterTips(category)
  const { profile, deviceId, setLastReward } = useApp()

  const [showSubmit, setShowSubmit] = useState(false)
  const [tipText, setTipText] = useState('')
  const [selectedCat, setSelectedCat] = useState(category ?? 'general')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const tip = overrideTip ?? dailyTip
  const isGPRTU = tip.category === 'gprtu'

  async function handleSubmit() {
    if (!tipText.trim() || !deviceId) return
    setSubmitting(true)
    const ok = await submitTip(
      tipText.trim(),
      profile?.display_name ?? 'Anonymous',
      deviceId,
      selectedCat,
    )
    setSubmitting(false)
    if (ok) {
      setSubmitted(true)
      setTipText('')
      setTimeout(() => {
        setShowSubmit(false)
        setSubmitted(false)
        // Fire confetti with +5 points preview
        setLastReward({
          points_awarded: TIP_POINTS,
          new_total: (profile?.total_points ?? 0) + TIP_POINTS,
          level_up: false,
          badges_earned: [],
          new_streak: profile?.current_streak ?? 0,
        })
      }, 800)
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={[s.iconWrap, isGPRTU && s.iconWrapGPRTU]}>
          <Lightbulb size={16} color={isGPRTU ? '#15803d' : (isDark ? c.amber400 : '#815100')} />
        </View>
        <Text style={s.title}>
          {isGPRTU ? 'GPRTU Tip' : 'Daily Commuter Tip'}
        </Text>
        {isGPRTU && (
          <View style={s.gprtuBadge}>
            <Text style={s.gprtuBadgeText}>GPRTU</Text>
          </View>
        )}
      </View>
      <Text style={s.tipText}>"{tip.tip}"</Text>
      <View style={s.footer}>
        <Text style={s.author}>Shared by {tip.author_name}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowSubmit(true)}
          style={s.submitBtn}
        >
          <Plus size={12} color={isDark ? c.amber400 : '#815100'} />
          <Text style={s.submitBtnText}>Share a Tip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Submit Tip Modal ── */}
      <Modal visible={showSubmit} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalContainer}
        >
          <Pressable style={s.backdrop} onPress={() => setShowSubmit(false)} />
          <View style={s.sheet}>
            {/* Handle */}
            <View style={s.handleRow}>
              <View style={s.handle} />
            </View>

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={s.sheetIconWrap}>
                <Lightbulb size={20} color={isDark ? c.amber400 : '#815100'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Share a Commuter Tip</Text>
                <Text style={s.sheetSub}>Help fellow commuters with your knowledge</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSubmit(false)} activeOpacity={0.7}>
                <X size={22} color={t.textTertiary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={s.successState}>
                <Text style={s.successEmoji}>🎉</Text>
                <Text style={s.successTitle}>Tip Submitted!</Text>
                <Text style={s.successSub}>You'll earn +5 points when it's approved!</Text>
              </View>
            ) : (
              <>
                {/* Category pills */}
                <View style={s.catRow}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      activeOpacity={0.7}
                      onPress={() => setSelectedCat(cat.key)}
                      style={[
                        s.catPill,
                        selectedCat === cat.key && s.catPillActive,
                      ]}
                    >
                      <Text style={[
                        s.catPillText,
                        selectedCat === cat.key && s.catPillTextActive,
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Text input */}
                <TextInput
                  style={s.input}
                  placeholder="e.g. The 6 AM trotro from Madina is usually empty..."
                  placeholderTextColor={t.textTertiary}
                  value={tipText}
                  onChangeText={setTipText}
                  multiline
                  maxLength={280}
                  textAlignVertical="top"
                />

                {/* Character count */}
                <Text style={s.charCount}>{tipText.length}/280</Text>

                {/* Submit button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  disabled={tipText.trim().length < 10 || submitting}
                  style={[
                    s.sendBtn,
                    (tipText.trim().length < 10 || submitting) && s.sendBtnDisabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={16} color="#fff" />
                      <Text style={s.sendBtnText}>Submit Tip</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={s.disclaimer}>
                  Tips are reviewed before appearing. You earn +5 points when approved!
                </Text>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapGPRTU: {
      backgroundColor: isDark ? 'rgba(21,128,61,0.15)' : 'rgba(21,128,61,0.1)',
    },
    title: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
      flex: 1,
    },
    gprtuBadge: {
      backgroundColor: isDark ? 'rgba(21,128,61,0.15)' : 'rgba(21,128,61,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    gprtuBadgeText: {
      fontSize: 9,
      fontFamily: font.bold,
      color: '#15803d',
      letterSpacing: 1,
    },
    tipText: {
      fontSize: 13,
      fontFamily: font.regular,
      fontStyle: 'italic',
      color: t.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    author: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(129,81,0,0.08)',
    },
    submitBtnText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: isDark ? c.amber400 : '#815100',
    },

    /* ── Modal ── */
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: { flex: 1 },
    sheet: {
      backgroundColor: t.sheetBg,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    sheetIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    sheetSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },

    /* Category pills */
    catRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    catPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    catPillActive: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(129,81,0,0.1)',
      borderColor: isDark ? c.amber400 : '#815100',
    },
    catPillText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    catPillTextActive: {
      fontFamily: font.semibold,
      color: isDark ? c.amber400 : '#815100',
    },

    /* Input */
    input: {
      minHeight: 100,
      maxHeight: 160,
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      fontSize: 14,
      fontFamily: font.regular,
      color: t.text,
      lineHeight: 20,
    },
    charCount: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      textAlign: 'right',
      marginTop: 6,
      marginBottom: 16,
    },

    /* Submit */
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: isDark ? c.amber500 : '#815100',
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
    sendBtnText: {
      fontSize: 15,
      fontFamily: font.bold,
      color: '#fff',
    },
    disclaimer: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },

    /* Success */
    successState: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    successEmoji: {
      fontSize: 40,
      marginBottom: 12,
    },
    successTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
      marginBottom: 4,
    },
    successSub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
  })
}
