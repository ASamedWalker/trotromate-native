import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, View, useWindowDimensions, type ViewToken } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { Tap } from '@/components/ui'
import { font } from '@/lib/theme'

const MAX_SCALE = 4
const ZOOM_EPS = 1.1 // above this the page counts as zoomed (every decision uses it)
const DOUBLE_TAP_SCALE = 2.5
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 800

// ─── One zoomable page ──────────────────────────────────

function ZoomableImage({
  uri,
  width,
  height,
  active,
  dragY,
  closing,
  label,
  onZoomChange,
  onSingleTap,
  onDismiss,
}: {
  uri: string
  width: number
  height: number
  active: boolean
  dragY: SharedValue<number>
  closing: SharedValue<boolean>
  label: string
  onZoomChange: (zoomed: boolean) => void
  onSingleTap: () => void
  onDismiss: () => void
}) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)
  // Displayed (contain-fitted) image size at 1x; defaults to the full page until the image loads.
  const dispW = useSharedValue(width)
  const dispH = useSharedValue(height)
  const pinching = useSharedValue(false)
  const pinchEndedAt = useSharedValue(0)
  const [zoomed, setZoomed] = useState(false)

  const setZoomedBoth = useCallback(
    (z: boolean) => {
      setZoomed(z)
      onZoomChange(z)
    },
    [onZoomChange],
  )

  // Reset zoom when this page stops being the current one.
  useEffect(() => {
    if (!active) {
      scale.value = 1
      savedScale.value = 1
      translateX.value = 0
      translateY.value = 0
      if (zoomed) setZoomed(false)
    }
  }, [active, zoomed, scale, savedScale, translateX, translateY])

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinching.value = true
      savedScale.value = scale.value
      // Stop the FlatList paging for the whole pinch, even when starting from 1x.
      runOnJS(setZoomedBoth)(true)
    })
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.6, savedScale.value * e.scale))
    })
    .onFinalize(() => {
      pinching.value = false
      pinchEndedAt.value = Date.now()
      if (scale.value < ZOOM_EPS) {
        scale.value = withTiming(1)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        runOnJS(setZoomedBoth)(false)
        return
      }
      const mx = Math.max(0, (dispW.value * scale.value - width) / 2)
      const my = Math.max(0, (dispH.value * scale.value - height) / 2)
      translateX.value = withTiming(Math.min(mx, Math.max(-mx, translateX.value)))
      translateY.value = withTiming(Math.min(my, Math.max(-my, translateY.value)))
      runOnJS(setZoomedBoth)(true)
    })

  // Pan while zoomed (clamped to the image bounds).
  const panZoomed = Gesture.Pan()
    .enabled(zoomed)
    .onStart(() => {
      savedX.value = translateX.value
      savedY.value = translateY.value
    })
    .onUpdate((e) => {
      if (scale.value <= ZOOM_EPS) return
      const mx = Math.max(0, (dispW.value * scale.value - width) / 2)
      const my = Math.max(0, (dispH.value * scale.value - height) / 2)
      translateX.value = Math.min(mx, Math.max(-mx, savedX.value + e.translationX))
      translateY.value = Math.min(my, Math.max(-my, savedY.value + e.translationY))
    })

  // Swipe down to dismiss (1x only). Fails on horizontal movement so the FlatList can page.
  const panDismiss = Gesture.Pan()
    .enabled(!zoomed)
    .maxPointers(1)
    .activeOffsetY(15)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (scale.value > ZOOM_EPS || pinching.value) return
      const y = Math.max(0, e.translationY)
      translateY.value = y
      dragY.value = y
    })
    .onEnd((e) => {
      if (scale.value > ZOOM_EPS || pinching.value) return
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        closing.value = true
        dragY.value = withTiming(height, { duration: 180 })
        // Close only once the slide-out has finished, so it isn't cut off.
        translateY.value = withTiming(height, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onDismiss)()
        })
      }
    })
    .onFinalize(() => {
      // Cancelled or released short of the threshold: spring back (unless closing).
      if (closing.value || scale.value > ZOOM_EPS || dragY.value <= 0) return
      translateY.value = withSpring(0)
      dragY.value = withSpring(0)
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (pinching.value || Date.now() - pinchEndedAt.value < 200) return
      if (scale.value > ZOOM_EPS) {
        scale.value = withTiming(1)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        runOnJS(setZoomedBoth)(false)
      } else {
        // Keep the tapped point under the finger: scale is about the page centre.
        const k = DOUBLE_TAP_SCALE - 1
        const mx = Math.max(0, (dispW.value * DOUBLE_TAP_SCALE - width) / 2)
        const my = Math.max(0, (dispH.value * DOUBLE_TAP_SCALE - height) / 2)
        const tx = -(e.x - width / 2) * k
        const ty = -(e.y - height / 2) * k
        scale.value = withTiming(DOUBLE_TAP_SCALE)
        translateX.value = withTiming(Math.min(mx, Math.max(-mx, tx)))
        translateY.value = withTiming(Math.min(my, Math.max(-my, ty)))
        runOnJS(setZoomedBoth)(true)
      }
    })

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (pinching.value || Date.now() - pinchEndedAt.value < 200) return
      runOnJS(onSingleTap)()
    })

  const gesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinch, panZoomed, panDismiss),
    Gesture.Exclusive(doubleTap, singleTap),
  )

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View accessible accessibilityLabel={label} style={[{ width, height }, imageStyle]}>
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          cachePolicy="memory-disk"
          onLoad={(e) => {
            const iw = e.source.width
            const ih = e.source.height
            if (iw > 0 && ih > 0) {
              const fit = Math.min(width / iw, height / ih)
              dispW.value = iw * fit
              dispH.value = ih * fit
            }
          }}
        />
      </Animated.View>
    </GestureDetector>
  )
}

// ─── Viewer body (mounted fresh each time the Modal opens) ───

function ViewerBody({
  images,
  initialIndex,
  onClose,
  requestClose,
  closing,
  author,
  caption,
}: {
  images: string[]
  initialIndex: number
  onClose: () => void
  requestClose: () => void
  closing: SharedValue<boolean>
  author?: string
  caption?: string
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(initialIndex)
  const [pageZoomed, setPageZoomed] = useState(false)
  const chromeOn = useRef(true)
  const chromeOpacity = useSharedValue(1)
  const dragY = useSharedValue(0)
  const listRef = useRef<FlatList<string>>(null)

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 300], [1, 0], Extrapolation.CLAMP),
  }))
  const chromeFade = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value * interpolate(dragY.value, [0, 120], [1, 0], Extrapolation.CLAMP),
  }))

  // Hidden chrome stays mounted (opacity 0) so the close button remains reachable by screen readers.
  const toggleChrome = useCallback(() => {
    chromeOn.current = !chromeOn.current
    chromeOpacity.value = withTiming(chromeOn.current ? 1 : 0, { duration: 150 })
  }, [chromeOpacity])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const i = viewableItems[0]?.index
    if (i != null) {
      setIndex((prev) => {
        if (prev !== i) setPageZoomed(false)
        return i
      })
    }
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  return (
    <GestureHandlerRootView style={{ flex: 1 }} accessibilityViewIsModal onAccessibilityEscape={requestClose}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }, backdropStyle]} />
      <FlatList
        ref={listRef}
        data={images}
        horizontal
        pagingEnabled
        scrollEnabled={!pageZoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(_, i) => String(i)}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index: i }) => (
          <ZoomableImage
            uri={item}
            width={width}
            height={height}
            active={i === index}
            dragY={dragY}
            closing={closing}
            label={`Photo ${i + 1} of ${images.length}`}
            onZoomChange={setPageZoomed}
            onSingleTap={toggleChrome}
            onDismiss={onClose}
          />
        )}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFillObject, chromeFade]}
      >
        <View
          pointerEvents="box-none"
          style={[styles.topBar, { top: insets.top + 8, left: insets.left + 12, right: insets.right + 12 }]}
        >
          {images.length > 1 ? (
            <Text style={styles.counter}>
              {index + 1} / {images.length}
            </Text>
          ) : null}
          <Tap
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.closeBtn}
          >
            <X size={24} color="#fff" strokeWidth={2.5} />
          </Tap>
        </View>

        {author || caption ? (
          <View
            pointerEvents="none"
            style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}
          >
            {author ? <Text style={styles.author}>{author}</Text> : null}
            {caption ? (
              <Text style={styles.caption} numberOfLines={3}>
                {caption}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </GestureHandlerRootView>
  )
}

// ─── Public component ───────────────────────────────────

export default function ImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
  author,
  caption,
}: {
  visible: boolean
  images: string[]
  initialIndex: number
  onClose: () => void
  author?: string
  caption?: string
}) {
  const closing = useSharedValue(false)
  useEffect(() => {
    if (visible) closing.value = false
  }, [visible, closing])
  // Back press / X / a11y escape: close now, but ignore it while the swipe-dismiss is sliding out.
  const requestClose = useCallback(() => {
    if (closing.value) return
    closing.value = true
    onClose()
  }, [closing, onClose])
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {visible && images.length > 0 ? (
        <ViewerBody
          images={images}
          initialIndex={Math.min(Math.max(initialIndex, 0), images.length - 1)}
          onClose={onClose}
          requestClose={requestClose}
          closing={closing}
          author={author}
          caption={caption}
        />
      ) : null}
    </Modal>
  )
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  counter: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 23,
    color: '#fff',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  author: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 23,
    color: '#fff',
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 23,
    color: '#fff',
  },
})
