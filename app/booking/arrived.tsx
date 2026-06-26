import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Check, Star } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'
import InitialsAvatar from '@/components/InitialsAvatar'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { submitRideRating } from '@/lib/services/ratings'
import { fetchAssignedVehicle, type AssignedVehicle } from '@/lib/services/fleet'
import { submitDriverRating } from '@/lib/services/driver-ratings'

const BRAND = '#FF4D1C'
const TAGS = ['On time', 'Friendly', 'Fast', 'Professional']
const STATS = [['8.4', 'Km', 'Distance'], ['30', 'mins', 'Duration'], ['2', '', 'Stops']]

export default function ArrivedScreen() {
  const router = useRouter()
  // GO Mode passes the real ride stats; the booking path passes from/to + route_id
  const params = useLocalSearchParams<{ distance?: string; duration?: string; stops?: string; route?: string; routeId?: string; from?: string; to?: string; route_id?: string }>()
  const { deviceId } = useDeviceId()
  const isGoTrip = !!params.duration

  // Booking trips: the real driver to rate (looked up from the route's fleet van).
  const [driver, setDriver] = useState<AssignedVehicle | null>(null)
  useEffect(() => {
    if (isGoTrip) return
    fetchAssignedVehicle(params.from, params.to).then(setDriver).catch(() => {})
  }, [isGoTrip, params.from, params.to])
  const driverFirst = driver?.driverName?.split(' ')[0] ?? 'your driver'
  const stats: [string, string, string][] = isGoTrip
    ? [
        [params.distance && params.distance !== '' ? params.distance : '—', params.distance ? 'Km' : '', 'Distance'],
        [params.duration!, 'mins', 'Duration'],
        [params.stops ?? '0', '', 'Stops'],
      ]
    : (STATS as [string, string, string][])
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')

  const toggleTag = (t: string) => {
    Haptics.selectionAsync()
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    // Fire-and-forget: never hold the user on the celebration screen
    if (rating > 0 && deviceId) {
      submitRideRating({
        rating,
        tags,
        deviceId,
        routeId: params.routeId || params.route_id || null,
        tripType: isGoTrip ? 'go' : 'booking',
      }).catch(() => {})
      // Booking trips also rate the DRIVER (with the rider's comment).
      if (!isGoTrip && driver?.driverId) {
        const body = [comment.trim(), tags.join(', ')].filter(Boolean).join(comment.trim() ? ' — ' : '')
        submitDriverRating({
          driverId: driver.driverId,
          vanId: driver.vanId,
          routeLabel: params.from && params.to ? `${params.from} → ${params.to}` : null,
          deviceId,
          stars: rating,
          comment: body || null,
        }).catch(() => {})
      }
    }
    router.dismissAll()
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      {/* Hero — arrival photo like the Figma, dark gradient so the card pops */}
      <View style={s.hero}>
        <Image
          source={require('@/assets/images/successful_receipt.png')}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'transparent', 'rgba(0,0,0,0.35)']}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView edges={['top']}>
          <View style={{ height: 8 }} />
        </SafeAreaView>
      </View>

      {/* You've Arrived — frosted glass panel FIXED over the hero edge.
          It lives outside the ScrollView so scrolling content passes
          beneath it and never rides up into the photo. */}
      <View style={s.arrivedWrap}>
        <View style={s.arrivedClip}>
          <BlurView intensity={55} tint="light" style={s.arrivedBlur}>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.arrived}>You&apos;ve Arrived !</Text>
              <Text style={s.arrivedSub}>Safe trip completed</Text>
            </View>

            <View style={s.statsRow}>
              {stats.map(([n, unit, label], i) => (
                <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 22, color: BRAND }}>
                    {n}{unit ? <Text style={{ fontSize: 13, color: BRAND }}> {unit}</Text> : null}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          </BlurView>
        </View>
        {/* Check badge straddles the glass edge — outside the clip so it isn't cut */}
        <View style={s.checkBadge}>
          <View style={s.checkCircle}><Check size={26} color="#fff" strokeWidth={3.5} /></View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16 }}>

        {/* Driver — booking flow only; a trotro GO ride has no assigned driver */}
        {!isGoTrip && driver?.driverName && (
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 14 }]}>
          {driver.driverPhotoUrl ? (
            <Image source={{ uri: driver.driverPhotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <InitialsAvatar name={driver.driverName} size={44} />
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#111' }}>{driver.driverName}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Bus Driver · {driver.plate}</Text>
          </View>
        </View>
        )}

        {/* Rate — GO trips rate the ride/line; booking trips rate the driver */}
        <View style={[s.card, { marginTop: 14, padding: 18 }]}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#111' }}>
            {isGoTrip ? 'Rate your experience' : 'Rate your driver'}
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {isGoTrip ? `How was your ride${params.route ? ` on ${params.route}` : ''}?` : `How was your ride with ${driverFirst}?`}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 18 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} testID={`rate-star-${n}`} accessibilityLabel={`Rate ${n} star`} onPress={() => { Haptics.selectionAsync(); setRating(n) }} hitSlop={4}>
                <Star size={34} color={n <= rating ? '#F5A623' : '#D1D5DB'} fill={n <= rating ? '#F5A623' : 'transparent'} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TAGS.map((t) => {
              const on = tags.includes(t)
              return (
                <TouchableOpacity key={t} onPress={() => toggleTag(t)} style={[s.tag, on && s.tagOn]}>
                  <Text style={[s.tagText, on && { color: BRAND }]}>{t}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {!isGoTrip && (
            <View style={s.commentBox}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment about your driver (optional)"
                placeholderTextColor="#9CA3AF"
                style={{ fontFamily: font.regular, fontSize: 14, color: '#111', minHeight: 44 }}
                multiline
                maxLength={280}
              />
            </View>
          )}
        </View>

        {/* Done */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleDone}
          style={s.doneBtn}
        >
          <Text style={s.doneText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  hero: { height: 300, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },

  // Frosted arrived panel — shadow on the wrapper (iOS drops shadows on
  // overflow:hidden views), blur clipped inside, badge floating above
  arrivedWrap: { marginTop: -64, marginHorizontal: 20, zIndex: 2, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 5 },
  arrivedClip: { borderRadius: 20, overflow: 'hidden' },
  arrivedBlur: {
    paddingTop: 38,
    paddingBottom: 18,
    paddingHorizontal: 18,
    // iOS: white wash over real blur = frosted glass; Android: translucent card fallback
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.93)',
  },
  checkBadge: { position: 'absolute', top: -26, left: 0, right: 0, alignItems: 'center' },
  checkCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
  arrived: { fontFamily: font.bold, fontSize: 18, color: '#111', marginTop: 10 },
  arrivedSub: { fontFamily: font.regular, fontSize: 13, color: '#6B7280', marginTop: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },

  commentBox: { marginTop: 14, backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#F3F4F6' },
  tagOn: { backgroundColor: '#FFF0EB', borderWidth: 1, borderColor: BRAND },
  tagText: { fontFamily: font.semibold, fontSize: 13, color: '#6B7280' },

  doneBtn: { height: 54, borderRadius: 16, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  doneText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
