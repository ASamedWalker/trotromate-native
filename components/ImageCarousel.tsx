import { useState, useCallback, useRef } from 'react'
import { View, FlatList, StyleSheet, Text, ViewToken } from 'react-native'
import { Image } from 'expo-image'

interface ImageCarouselProps {
  images: string[]
  width: number
}

export default function ImageCarousel({ images, width }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
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
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height: imageHeight }}
            contentFit="cover"
            transition={300}
          />
        )}
      />

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
