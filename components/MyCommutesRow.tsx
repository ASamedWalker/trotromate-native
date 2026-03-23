import { View, Text, TouchableOpacity, ScrollView, useColorScheme, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Sunrise, Sunset, MapPin, Plus } from 'lucide-react-native'
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

  // If no commutes saved yet, show top suggestion as a "save" prompt
  const showSuggestion = commutes.length === 0 && suggestions.length > 0
  const topSuggestion = suggestions[0]

  if (commutes.length === 0 && !showSuggestion) return null

  return (
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
          <Plus size={14} color={c.amber500} />
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
        <Plus size={14} color={t.textSecondary} />
        <Text style={s.addText}>Save route</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function CommuteChip({ commute, isDark, onPress }: { commute: MyCommute; isDark: boolean; onPress: () => void }) {
  const t = themed(isDark)
  const s = getStyles(isDark)
  const Icon = ICON_MAP[commute.icon] || MapPin

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={s.chip}>
      <Icon size={14} color={c.amber500} />
      <Text style={s.chipText} numberOfLines={1}>
        {commute.from} → {commute.to}
      </Text>
    </TouchableOpacity>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 20,
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 100,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      maxWidth: 240,
    },
    chipText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.text,
    },
    suggestChip: {
      borderColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)',
      backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
    },
    suggestText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: c.amber500,
      flexShrink: 1,
    },
    addChip: {
      borderStyle: 'dashed' as const,
    },
    addText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
  })
}
