import { useState, useCallback, useRef } from 'react'
import { View, FlatList, StyleSheet, Text, TouchableOpacity, ViewToken } from 'react-native'
import { Image } from 'expo-image'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

interface ImageCarouselProps {
  images: string[]
  width: number
}

export default function ImageCarousel({ images, width }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const imageHeight = (width * 3) / 4 // 4:3 aspect ratio

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index)
      }
    },
    []
  )

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const goTo = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true })
  }, [])

  // Single image — no carousel
  if (images.length === 1) {
    return (
      <Image
        source={{ uri: images[0] }}
        style={{ width, height: imageHeight }}
        contentFit="cover"
        transition={300}
      />
    )
  }

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        nestedScrollEnabled
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height: imageHeight }}
            contentFit="cover"
            transition={300}
          />
        )}
      />

      {/* Left chevron */}
      {activeIndex > 0 && (
        <TouchableOpacity
          style={[styles.chevron, styles.chevronLeft]}
          activeOpacity={0.8}
          onPress={() => goTo(activeIndex - 1)}
        >
          <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Right chevron */}
      {activeIndex < images.length - 1 && (
        <TouchableOpacity
          style={[styles.chevron, styles.chevronRight]}
          activeOpacity={0.8}
          onPress={() => goTo(activeIndex + 1)}
        >
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Dot indicators */}
      <View style={styles.dotsContainer}>
        {images.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Page counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {activeIndex + 1}/{images.length}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chevron: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  chevronLeft: {
    left: 10,
  },
  chevronRight: {
    right: 10,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 10,
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})
