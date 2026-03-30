import { View, Text, useColorScheme, StyleSheet } from 'react-native'
import { Lightbulb } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useCommuterTips, type CommuterTip } from '@/lib/hooks/useCommuterTips'

interface Props {
  /** Filter tips by category (e.g. 'train', 'trotro', 'gprtu') */
  category?: string
  /** Override with a specific tip instead of using hook */
  tip?: CommuterTip
}

export function DailyTipCard({ category, tip: overrideTip }: Props) {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { dailyTip } = useCommuterTips(category)

  const tip = overrideTip ?? dailyTip

  const isGPRTU = tip.category === 'gprtu'

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
      <Text style={s.author}>Shared by {tip.author_name}</Text>
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
    author: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  })
}
