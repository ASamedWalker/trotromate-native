import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Sunrise, Sunset, MapPin, Plus, Bookmark } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useMyCommutes, type MyCommute } from '@/lib/hooks/useMyCommutes'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'

const ICON_MAP = {
  sunrise: Sunrise,
  sunset: Sunset,
  'map-pin': MapPin,
} as const

interface Props {
  onAddPress: () => void
}

export function MyCommutesRow({ onAddPress }: Props) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const { commutes } = useMyCommutes()
  const { suggestions } = useSmartSuggestions()

  const showSuggestion = commutes.length === 0 && suggestions.length > 0
  const topSuggestion = suggestions[0]

  if (commutes.length === 0 && !showSuggestion) return null

  return (
    <View style={s.wrapper}>
      {/* Section label */}
      <View style={s.labelRow}>
        <Bookmark size={12} color={t.textTertiary} />
        <Text style={s.label}>Saved places</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {commutes.map((commute) => (
          <CommuteChip
            key={commute.id}
            commute={commute}
            isDark={isDark}
            onPress={() => router.push(`/routes/${commute.routeId}`)}
          />
        ))}

        {showSuggestion && topSuggestion && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onAddPress}
            style={[s.chip, s.suggestChip]}
          >
            <Plus size={13} color={c.amber500} />
            <Text style={s.suggestText} numberOfLines={1}>
              Save {topSuggestion.from} → {topSuggestion.to}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAddPress}
          style={[s.chip, s.addChip]}
        >
          <Plus size={13} color={t.textTertiary} />
          <Text style={s.addText}>Add route</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function CommuteChip({ commute, isDark, onPress }: { commute: MyCommute; isDark: boolean; onPress: () => void }) {
  const t = themed(isDark)
  const s = getStyles(isDark)
  const Icon = ICON_MAP[commute.icon] || MapPin

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={s.chip}>
      <View style={s.chipIcon}>
        <Icon size={12} color={c.amber500} />
      </View>
      <Text style={s.chipText} numberOfLines={1}>
        {commute.from} → {commute.to}
      </Text>
    </TouchableOpacity>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    wrapper: {
      marginTop: 14,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 22,
      marginBottom: 8,
    },
    label: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    scrollContent: {
      paddingHorizontal: 20,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 100,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      maxWidth: 240,
    },
    chipIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.text,
    },
    suggestChip: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)',
      backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)',
    },
    suggestText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: c.amber500,
      flexShrink: 1,
    },
    addChip: {
      borderWidth: 1,
      borderStyle: 'dashed' as const,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      backgroundColor: 'transparent',
    },
    addText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textTertiary,
    },
  })
}
