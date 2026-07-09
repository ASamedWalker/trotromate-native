import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  useColorScheme,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import {
  ArrowLeft,
  Search,
  Clock,
  Heart,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  MapPinPlus,
} from 'lucide-react-native'
import { TrotroIcon, TrainIcon } from '@/components/ServiceIcons'
import { c, themed, font } from '@/lib/theme'
import { useUnifiedSearch, type UnifiedResult } from '@/lib/hooks/useUnifiedSearch'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { useFavorites } from '@/lib/hooks/useFavorites'

/* ── Props ─────────────────────────────────────────── */

interface UnifiedSearchProps {
  visible: boolean
  onClose: () => void
  onRoutePreview?: (routeId: string, from: string, to: string) => void
}

/* ── Main Component ────────────────────────────────── */

export function UnifiedSearch({ visible, onClose, onRoutePreview }: UnifiedSearchProps) {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = useMemo(() => getStyles(isDark), [isDark])

  const [query, setQuery] = useState('')
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInput>(null)
  const { results, isLoading } = useUnifiedSearch(query)
  const { addSearch, getRecentSearches } = useSearchHistory()
  const { suggestions } = useSmartSuggestions()
  const { favorites } = useFavorites()

  // Auto-focus input when modal opens
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    } else {
      setQuery('')
    }
  }, [visible])

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    onClose()
  }, [onClose])

  const navigateToRoute = useCallback((routeId: string, from: string, to: string, transportType?: string) => {
    addSearch({ id: routeId, from, to, transportType: transportType as 'trotro' | 'okada' })
    handleClose()
    if (onRoutePreview && transportType !== 'train') {
      onRoutePreview(routeId, from, to)
    } else {
      router.push(`/routes/${routeId}` as Href)
    }
  }, [addSearch, handleClose, router, onRoutePreview])

  const navigateToTrain = useCallback((lineId: string) => {
    handleClose()
    router.push(`/train/${lineId}` as Href)
  }, [handleClose, router])

  const handleGo = useCallback((result: UnifiedResult) => {
    if (result.type !== 'train') {
      addSearch({ id: result.routeId, from: result.from, to: result.to, transportType: result.type as 'trotro' | 'okada' })
    }
    handleClose()
    if (result.trainLineId) {
      router.push({
        pathname: '/trip/[routeId]',
        params: { routeId: result.routeId, type: 'train', lineId: result.trainLineId },
      } as Href)
    } else {
      router.push({
        pathname: '/routes/[id]',
        params: { id: result.routeId },
      } as Href)
    }
  }, [addSearch, handleClose, router])

  const recentSearches = getRecentSearches(5)
  const topFavorites = favorites.slice(0, 3)
  const showEmpty = query.trim().length === 0
  const hasEmptyContent = suggestions.length > 0 || recentSearches.length > 0 || topFavorites.length > 0

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Search header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={s.backBtn}>
            <ArrowLeft size={22} color={t.text} />
          </TouchableOpacity>
          <View style={s.inputWrap}>
            <Search size={18} color={t.textTertiary} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Search routes or stations..."
              placeholderTextColor={t.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                <Text style={s.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showEmpty ? (
          /* ── Empty state: suggestions, recent, saved ── */
          <ScrollView
            style={s.scrollFill}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.emptyContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Smart suggestions */}
            {suggestions.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Sparkles size={14} color={c.amber500} />
                  <Text style={s.sectionTitle}>Suggested</Text>
                </View>
                {suggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug.routeId}
                    activeOpacity={0.7}
                    onPress={() => navigateToRoute(sug.routeId, sug.from, sug.to, sug.transportType)}
                    style={s.quickRow}
                  >
                    <View style={[s.quickIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                      <Sparkles size={14} color={c.amber500} />
                    </View>
                    <View style={s.quickContent}>
                      <Text style={s.quickLabel} numberOfLines={1}>{sug.from} → {sug.to}</Text>
                      <Text style={s.quickSub} numberOfLines={1}>{sug.reason}</Text>
                    </View>
                    <ChevronRight size={16} color={t.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Clock size={14} color={t.textSecondary} />
                  <Text style={s.sectionTitle}>Recent</Text>
                </View>
                {recentSearches.map((entry) => (
                  <TouchableOpacity
                    key={entry.routeId}
                    activeOpacity={0.7}
                    onPress={() => navigateToRoute(entry.routeId, entry.from, entry.to, entry.transportType)}
                    style={s.quickRow}
                  >
                    <View style={[s.quickIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                      <Clock size={14} color={t.textSecondary} />
                    </View>
                    <View style={s.quickContent}>
                      <Text style={s.quickLabel} numberOfLines={1}>{entry.from} → {entry.to}</Text>
                    </View>
                    <ChevronRight size={16} color={t.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Saved routes */}
            {topFavorites.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Heart size={14} color="#ef4444" />
                  <Text style={s.sectionTitle}>Saved</Text>
                </View>
                {topFavorites.map((fav) => (
                  <TouchableOpacity
                    key={fav.id}
                    activeOpacity={0.7}
                    onPress={() => navigateToRoute(fav.id, fav.from, fav.to)}
                    style={s.quickRow}
                  >
                    <View style={[s.quickIcon, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                      <Heart size={14} color="#ef4444" />
                    </View>
                    <View style={s.quickContent}>
                      <Text style={s.quickLabel} numberOfLines={1}>{fav.from} → {fav.to}</Text>
                    </View>
                    <ChevronRight size={16} color={t.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Fallback when no history/suggestions yet */}
            {!hasEmptyContent && (
              <View style={s.emptyHint}>
                <Search size={32} color={t.textTertiary} />
                <Text style={s.emptyHintTitle}>Search for a route</Text>
                <Text style={s.emptyHintSub}>Try "Circle to Kasoa" or "Tema"</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          /* ── Results list ── */
          <FlatList
            style={s.scrollFill}
            data={results}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.resultsContainer}
            renderItem={({ item, index }) => (
              <ResultCard
                result={item}
                index={index}
                isDark={isDark}
                onPress={() => {
                  if (item.trainLineId) navigateToTrain(item.trainLineId)
                  else navigateToRoute(item.routeId, item.from, item.to, item.type)
                }}
                onGo={() => handleGo(item)}
              />
            )}
            ListEmptyComponent={
              query.trim().length >= 2 && !isLoading ? (
                <View style={s.emptyResults}>
                  <Text style={s.emptyResultsTitle}>No routes found</Text>
                  <Text style={s.emptyResultsSub}>Try a different station or location name</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { handleClose(); router.push('/report/fare' as Href) }}
                    style={s.addRouteBtn}
                  >
                    <MapPinPlus size={16} color={c.amber500} />
                    <Text style={s.addRouteText}>Add a new route</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  )
}

/* ── Result Card with staggered animation ─────────── */

function ResultCard({ result, index, isDark, onPress, onGo }: {
  result: UnifiedResult
  index: number
  isDark: boolean
  onPress: () => void
  onGo: () => void
}) {
  const t = themed(isDark)
  const s = getCardStyles(isDark)

  const slideAnim = useRef(new Animated.Value(20)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const delay = index * 60
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
    ]).start()
  }, [index])

  const isTrain = result.type === 'train'
  const bgTint = isTrain
    ? (isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.04)')
    : (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)')
  const borderTint = isTrain
    ? (isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.08)')
    : (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)')

  const IconComponent = isTrain ? TrainIcon : TrotroIcon

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[s.card, { backgroundColor: bgTint, borderColor: borderTint }]}
      >
        {/* Transport badge */}
        <View style={[s.badge, { backgroundColor: result.color }]}>
          <IconComponent size={18} active />
        </View>

        {/* Route info */}
        <View style={s.info}>
          <View style={s.titleRow}>
            {result.lineName && (
              <View style={[s.linePill, { backgroundColor: result.color }]}>
                <Text style={s.linePillText}>{result.lineName}</Text>
              </View>
            )}
            <Text style={[s.routeName, { color: t.text }]} numberOfLines={1}>
              {result.from} → {result.to}
            </Text>
          </View>

          <View style={s.metaRow}>
            {/* Fare */}
            <Text style={[s.fare, { color: result.color }]}>
              {'\u20B5'}{result.fare?.toFixed(2) ?? '--'}
            </Text>

            {/* GPRTU badge */}
            {result.isVerified && (
              <View style={s.verifiedPill}>
                <ShieldCheck size={11} color="#16a34a" />
                <Text style={s.verifiedText}>GPRTU</Text>
              </View>
            )}

            {/* Time label */}
            {result.timeLabel !== '' && (
              <Text style={[s.timeLabel, { color: t.textSecondary }]}>
                {/* No live-dot: timing is schedule-derived, not telemetry (UX-09) */}
                {result.timeLabel}
              </Text>
            )}
          </View>
        </View>

        {/* GO button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onGo}
          style={s.goBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.goText}>GO</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  )
}

/* ── Modal styles ─────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },

    // Ensures ScrollView/FlatList fills remaining space (critical on iOS)
    scrollFill: {
      flex: 1,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontFamily: font.medium,
      color: t.text,
      padding: 0,
    },
    clearText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // Empty state
    emptyContainer: {
      paddingBottom: 40,
      flexGrow: 1,
    },
    section: {
      paddingHorizontal: 20,
      marginTop: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: font.bold,
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    quickIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickContent: {
      flex: 1,
    },
    quickLabel: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: t.text,
    },
    quickSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },

    // Empty hint (no history yet)
    emptyHint: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 8,
    },
    emptyHintTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    emptyHintSub: {
      fontSize: 14,
      fontFamily: font.regular,
      color: t.textSecondary,
    },

    // Results
    resultsContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },

    // Empty results
    emptyResults: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 6,
    },
    emptyResultsTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    emptyResultsSub: {
      fontSize: 14,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
    addRouteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
    },
    addRouteText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: c.amber500,
    },
  })
}

/* ── Card styles ──────────────────────────────────── */

const getCardStyles = (isDark: boolean) => {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 8,
      gap: 12,
    },
    badge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    linePill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    linePillText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 0.5,
    },
    routeName: {
      fontSize: 15,
      fontFamily: font.bold,
      flexShrink: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fare: {
      fontSize: 16,
      fontFamily: font.bold,
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    verifiedText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#16a34a',
    },
    timeLabel: {
      fontSize: 12,
      fontFamily: font.medium,
    },
    goBtn: {
      backgroundColor: '#22c55e',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },
    goText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
    },
  })
}
