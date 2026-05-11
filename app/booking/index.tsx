import { useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Search, Home, Briefcase } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLocation } from '@/lib/hooks/useLocation'
import Mapbox from '@rnmapbox/maps'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'

const MAP_STYLE_LIGHT = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11'

export default function BookingScreen() {
  const router = useRouter()
  const deepParams = useLocalSearchParams<{ from?: string; to?: string }>()

  // If deep link has from/to, go straight to trip screen
  useEffect(() => {
    if (deepParams.from || deepParams.to) {
      router.push({ pathname: '/booking/trip', params: { from: deepParams.from, to: deepParams.to } } as any)
    }
  }, [deepParams.from, deepParams.to])
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const bottomSheetRef = useRef<BottomSheet>(null)

  const { location } = useLocation()
  const { vehicles } = useVehiclePositions()
  const activeVehicles = vehicles.filter(v => !v.isStale)

  const centerCoord = location
    ? [location.longitude, location.latitude]
    : [-0.187, 5.6037]

  const snapPoints = useMemo(() => ['50%', '92%'], [])

  return (
    <View style={s.root}>
      {/* ── Map ── */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          centerCoordinate={centerCoord as [number, number]}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={800}
        />
        <Mapbox.UserLocation visible />
        {activeVehicles.length > 0 && (
          <Mapbox.ShapeSource
            id="bk-vehicles"
            shape={{
              type: 'FeatureCollection',
              features: activeVehicles.map(v => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [v.longitude, v.latitude] },
                properties: {},
              })),
            }}
          >
            <Mapbox.CircleLayer
              id="bk-dots"
              style={{
                circleRadius: 5,
                circleColor: '#F59E0B',
                circleStrokeColor: isDark ? '#0C0A09' : '#FFFFFF',
                circleStrokeWidth: 2.5,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* ── Back button ── */}
      <SafeAreaView edges={['top']} style={s.overlay} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.8 }]}
        >
          <ArrowLeft size={20} color={isDark ? '#FAFAF9' : '#1C1917'} />
        </Pressable>
      </SafeAreaView>

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        handleIndicatorStyle={s.handle}
        backgroundStyle={s.sheetBg}
        enablePanDownToClose={false}
      >
        <BottomSheetScrollView
          contentContainerStyle={s.sheetScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search bar */}
          <Pressable
            onPress={() => router.push('/booking/trip' as any)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#292524' : '#F3F4F6', height: 50, paddingHorizontal: 14, borderRadius: 14, marginBottom: 20 }}
          >
            <Search size={18} color={isDark ? '#78716c' : '#9CA3AF'} />
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: isDark ? '#57534e' : '#9CA3AF', marginLeft: 10 }}>Where to?</Text>
          </Pressable>

          {/* Home shortcut */}
          <Pressable onPress={() => router.push('/booking/trip' as any)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#292524' : '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Home size={18} color={isDark ? '#F9FAFB' : '#111'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: isDark ? '#F9FAFB' : '#111' }}>Home</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: isDark ? '#78716c' : '#9CA3AF' }}>Add home address</Text>
            </View>
          </Pressable>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: isDark ? '#292524' : '#E5E7EB', marginLeft: 48 }} />

          {/* Work shortcut */}
          <Pressable onPress={() => router.push('/booking/trip' as any)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#292524' : '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Briefcase size={18} color={isDark ? '#F9FAFB' : '#111'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: isDark ? '#F9FAFB' : '#111' }}>Work</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: isDark ? '#78716c' : '#9CA3AF' }}>Add work address</Text>
            </View>
          </Pressable>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: isDark ? '#292524' : '#E5E7EB' }} />

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  )
}

/* ── Styles ── */

function getStyles(isDark: boolean) {
  const bg = isDark ? '#0C0A09' : '#FAFAF9'
  const surface = isDark ? '#1C1917' : '#FFFFFF'
  const text = isDark ? '#FAFAF9' : '#1C1917'
  const sub = isDark ? '#78716c' : '#534434'

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: bg },

    /* Overlay */
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      paddingHorizontal: 16,
    },
    backBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: surface,
      justifyContent: 'center', alignItems: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
        android: { elevation: 4 },
      }),
    },

    /* Sheet */
    sheetBg: { backgroundColor: surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    handle: { backgroundColor: isDark ? '#44403c' : '#D8C3AD', width: 48, height: 6, borderRadius: 3 },
    sheetScroll: { paddingHorizontal: 20, paddingTop: 8 },

    /* Title */
    title: {
      fontFamily: font.bold, fontSize: 24, color: text,
      textAlign: 'center', letterSpacing: -0.5, marginBottom: 20, marginTop: 4,
    },

    /* Search */
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: isDark ? '#292524' : '#F6ECE6',
      height: 56, paddingHorizontal: 16, borderRadius: 16, marginBottom: 24,
    },
    searchEmoji: { fontSize: 14 },
    searchInput: {
      flex: 1, fontFamily: font.regular, fontSize: 16,
      color: text, paddingVertical: 0,
    },

    /* Empty */
    empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
    emptyTitle: { fontFamily: font.bold, fontSize: 17, color: text },
    emptySub: { fontFamily: font.regular, fontSize: 14, color: sub },

    /* Route cards */
    routeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      backgroundColor: isDark ? '#1C1917' : '#FFF8F5',
      padding: 16, borderRadius: 16, marginBottom: 8,
      borderWidth: 1, borderColor: isDark ? '#292524' : '#F6ECE6',
      ...Platform.select({
        ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12 },
        android: { elevation: 1 },
      }),
    },
    routeIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: isDark ? '#292524' : '#F6ECE6',
      justifyContent: 'center', alignItems: 'center',
    },
    routeCenter: { flex: 1, gap: 4 },
    routeName: { fontFamily: font.semibold, fontSize: 18, color: text },
    routeSub: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    routeFare: { fontFamily: font.semibold, fontSize: 13, color: '#F59E0B' },
    routeMins: { fontFamily: font.regular, fontSize: 13, color: sub },

    /* Live */
    livePill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: isDark ? '#44403c' : '#D8C3AD' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
    deadDot: { backgroundColor: isDark ? '#44403c' : '#D8C3AD' },
    liveNum: { fontFamily: font.regular, fontSize: 13, color: sub },
  })
}
