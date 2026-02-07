import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { X, ChevronRight } from 'lucide-react-native'
import { c, font } from '@/lib/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const HORIZONTAL_PADDING = 20
const BANNER_GAP = 12
const BANNER_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2
const BANNER_HEIGHT = 140

export interface PromoBannerItem {
  id: string
  title: string
  subtitle: string
  ctaText?: string
  bgColor: string
  textColor?: string
  imageUrl?: string
  onPress?: () => void
}

// Default promos — replace with API-driven data later
export const DEFAULT_PROMOS: PromoBannerItem[] = [
  {
    id: 'welcome',
    title: 'Welcome to Troski!',
    subtitle: 'Report fares & earn points. Help fellow commuters.',
    ctaText: 'Start Contributing',
    bgColor: '#f59e0b',
    textColor: '#ffffff',
  },
  {
    id: 'train',
    title: 'Tema–Accra Train',
    subtitle: 'Live schedules, delays & crowd reports.',
    ctaText: 'View Schedule',
    bgColor: '#0ea5e9',
    textColor: '#ffffff',
  },
  {
    id: 'tales',
    title: 'Trotro Tales',
    subtitle: 'Share your commute stories & photos.',
    ctaText: 'Share a Tale',
    bgColor: '#ec4899',
    textColor: '#ffffff',
  },
]

interface Props {
  promos?: PromoBannerItem[]
  onPromoPress?: (promo: PromoBannerItem) => void
  onDismiss?: (promoId: string) => void
}

export default function PromoBanner({
  promos = DEFAULT_PROMOS,
  onPromoPress,
  onDismiss,
}: Props) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const flatListRef = useRef<FlatList>(null)
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const visiblePromos = promos.filter((p) => !dismissedIds.has(p.id))

  // Auto-scroll every 5s
  useEffect(() => {
    if (visiblePromos.length <= 1) return

    autoScrollTimer.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % visiblePromos.length
        flatListRef.current?.scrollToIndex({ index: next, animated: true })
        return next
      })
    }, 5000)

    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current)
    }
  }, [visiblePromos.length])

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissedIds((prev) => new Set(prev).add(id))
      onDismiss?.(id)
    },
    [onDismiss]
  )

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0)
    }
  }).current

  if (visiblePromos.length === 0) return null

  const renderPromo = ({ item }: { item: PromoBannerItem }) => {
    const textColor = item.textColor ?? '#ffffff'
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPromoPress?.(item)}
        style={[s.banner, { width: BANNER_WIDTH, backgroundColor: item.bgColor }]}
      >
        {/* Dismiss button */}
        <TouchableOpacity
          onPress={() => handleDismiss(item.id)}
          style={s.dismissBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={14} color={`${textColor}99`} />
        </TouchableOpacity>

        {/* Decorative circles */}
        <View style={[s.circle, s.circle1, { backgroundColor: `${textColor}10` }]} />
        <View style={[s.circle, s.circle2, { backgroundColor: `${textColor}08` }]} />

        {/* Content */}
        <View style={s.content}>
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={s.promoImage}
              contentFit="cover"
              transition={300}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: textColor }]}>{item.title}</Text>
            <Text style={[s.subtitle, { color: `${textColor}CC` }]} numberOfLines={2}>
              {item.subtitle}
            </Text>
            {item.ctaText && (
              <View style={[s.ctaRow, { backgroundColor: `${textColor}20` }]}>
                <Text style={[s.ctaText, { color: textColor }]}>{item.ctaText}</Text>
                <ChevronRight size={14} color={textColor} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      <FlatList
        ref={flatListRef}
        data={visiblePromos}
        renderItem={renderPromo}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_WIDTH + BANNER_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, gap: BANNER_GAP }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* Dots */}
      {visiblePromos.length > 1 && (
        <View style={s.dots}>
          {visiblePromos.map((p, i) => (
            <View
              key={p.id}
              style={[
                s.dot,
                {
                  backgroundColor:
                    i === activeIndex
                      ? c.amber500
                      : isDark
                        ? '#44403c'
                        : '#d6d3d1',
                  width: i === activeIndex ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { marginTop: 12 },
  banner: {
    height: BANNER_HEIGHT,
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  dismissBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: { width: 120, height: 120, top: -30, right: -20 },
  circle2: { width: 80, height: 80, bottom: -20, left: -10 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  promoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: font.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: font.regular,
    lineHeight: 18,
    marginBottom: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  ctaText: {
    fontSize: 12,
    fontFamily: font.semibold,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
})
