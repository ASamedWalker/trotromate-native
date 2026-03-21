import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, type Href } from 'expo-router'
import { MapPin, ChevronRight, Compass, ArrowRight } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { REGION_HEROES, type RegionHero } from '@/lib/config/regions'

const HORIZONTAL_PADDING = 20
const CARD_GAP = 14
const CARD_HEIGHT = 190

export default function ExploreGhana() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2 - 40 // Show a peek of the next card
  const flatListRef = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handlePress = useCallback(
    (region: RegionHero) => {
      router.push(`/(tabs)/routes?region=${region.key}` as Href)
    },
    [router],
  )

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0)
    }
  }).current

  const renderCard = useCallback(
    ({ item }: { item: RegionHero }) => (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => handlePress(item)}
        style={[s.card, { width: cardWidth }]}
      >
        {/* Hero image — placeholder color shows instantly, photo fades in */}
        <Image
          source={{ uri: item.heroImage }}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: item.placeholderColor }]}
          contentFit="cover"
          transition={400}
          cachePolicy="disk"
        />

        {/* Multi-stop gradient for natural depth */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)']}
          locations={[0, 0.2, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Location badge — top left */}
        <View style={s.badge}>
          <MapPin size={10} color={c.white} />
          <Text style={s.badgeText}>{item.label}</Text>
        </View>

        {/* Bottom content area */}
        <View style={s.cardContent}>
          <Text style={s.cardCity}>{item.label}</Text>
          <Text style={s.cardTagline}>{item.tagline}</Text>

          {/* CTA row */}
          <View style={s.ctaRow}>
            <Text style={s.ctaText}>Explore routes</Text>
            <ArrowRight size={14} color={c.amber400} />
          </View>
        </View>
      </TouchableOpacity>
    ),
    [s, cardWidth, handlePress],
  )

  return (
    <View style={s.container}>
      {/* Section header with icon */}
      <View style={s.sectionHeader}>
        <View style={s.titleRow}>
          <Compass size={20} color={c.amber500} />
          <Text style={s.sectionTitle}>Explore Ghana</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/routes' as Href)}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={s.seeAll}>See all</Text>
          <ChevronRight size={16} color={c.amber500} />
        </TouchableOpacity>
      </View>

      {/* City cards carousel with snap */}
      <FlatList
        ref={flatListRef}
        data={REGION_HEROES}
        renderItem={renderCard}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, gap: CARD_GAP }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        nestedScrollEnabled
      />

      {/* Dot indicators */}
      <View style={s.dots}>
        {REGION_HEROES.map((item, i) => (
          <View
            key={item.key}
            style={[
              s.dot,
              {
                backgroundColor:
                  i === activeIndex
                    ? c.amber500
                    : isDark
                      ? c.stone700
                      : c.stone300,
                width: i === activeIndex ? 20 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      marginTop: 24,
    },

    /* ── Section header ── */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    seeAll: {
      color: c.amber500,
      fontFamily: font.medium,
      fontSize: 14,
    },

    /* ── Card ── */
    card: {
      height: CARD_HEIGHT,
      borderRadius: 22,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: c.black,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        },
        android: {
          elevation: 8,
        },
      }),
    },

    /* ── Location badge ── */
    badge: {
      position: 'absolute',
      top: 14,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 20,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: c.white,
      letterSpacing: 0.3,
    },

    /* ── Bottom content ── */
    cardContent: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 18,
    },
    cardCity: {
      fontSize: 24,
      fontFamily: font.bold,
      color: c.white,
      letterSpacing: 0.2,
    },
    cardTagline: {
      fontSize: 13,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 3,
    },

    /* ── CTA row ── */
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    ctaText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: c.amber400,
    },

    /* ── Dot indicators ── */
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      marginTop: 12,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
  })
}
