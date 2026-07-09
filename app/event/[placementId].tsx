import React, { useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ImageBackground } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Clapperboard, Music, Beer, PartyPopper, Mic2, MapPin,
  CalendarDays, Clock, Ticket, Navigation,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { GlassBackButton } from '@/components/GlassBackButton'

const BRAND = '#FF4D1C'

/**
 * Event / movie detail — opened from the "What's On in Accra" home section.
 * The full listing is passed as a JSON `item` param (no refetch needed);
 * the consumer reads the pitch here and decides, then "Take me there"
 * deep-links into trip planning.
 */

interface DetailItem {
  kind: 'movie' | 'event'
  placementId: string
  title: string
  category: string
  description?: string
  venue: string
  venueStop: string
  rating?: string
  date?: string
  time?: string
  priceFrom?: number
  posterUrl?: string
  gradient?: [string, string]
  sponsored?: boolean
}

const CATEGORY_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  concert: { icon: Music, label: 'Concert', color: '#C026D3', bg: '#FDF4FF' },
  bar: { icon: Beer, label: 'Bar & Nightlife', color: '#D97706', bg: '#FFFBEB' },
  festival: { icon: PartyPopper, label: 'Festival', color: '#059669', bg: '#ECFDF5' },
  comedy: { icon: Mic2, label: 'Comedy', color: '#0284C7', bg: '#F0F9FF' },
}

function formatFullDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EventDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ item?: string }>()

  const item: DetailItem | null = useMemo(() => {
    try {
      return params.item ? JSON.parse(params.item) : null
    } catch {
      return null
    }
  }, [params.item])

  // The 'click' metric was already recorded when the card was tapped on Home;
  // this CTA is intentionally untracked to avoid double counting.
  const takeMeThere = useCallback(() => {
    if (!item) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(`/routes/search?to=${encodeURIComponent(item.venueStop)}` as any)
  }, [item, router])

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
          This listing is no longer available.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: BRAND }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const isMovie = item.kind === 'movie'
  const meta = !isMovie ? CATEGORY_META[item.category] : null
  const gradient: [string, string] = item.gradient ?? ['#475569', '#020617']
  const fullDate = formatFullDate(item.date)

  const heroInner = (
    <View style={{ flex: 1, justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <GlassBackButton isDark color="#fff" />
        {item.sponsored && (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 }}>SPONSORED</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isMovie ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Clapperboard size={13} color="#fff" />
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#fff' }}>
              {item.category}{item.rating ? ` · ${item.rating}` : ''}
            </Text>
          </View>
        ) : meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 }}>
            <meta.icon size={13} color="#fff" />
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#fff' }}>{meta.label}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* ── Hero (poster or gradient) ── */}
        {item.posterUrl ? (
          <ImageBackground source={{ uri: item.posterUrl }} style={{ height: 320 }} resizeMode="cover">
            <LinearGradient colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.45)']} style={{ flex: 1 }}>
              {heroInner}
            </LinearGradient>
          </ImageBackground>
        ) : (
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 320 }}>
            {heroInner}
          </LinearGradient>
        )}

        {/* ── Body ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <HeroText size={28} style={{ color: '#000' }}>{item.title}</HeroText>

          {/* Info rows */}
          <View
            style={{
              marginTop: 20, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 14,
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
            }}
          >
            {fullDate && (
              <InfoRow icon={CalendarDays} label="Date" value={fullDate} />
            )}
            {item.time ? <InfoRow icon={Clock} label={isMovie ? 'Showtimes' : 'Time'} value={item.time} /> : null}
            <InfoRow icon={MapPin} label="Venue" value={item.venue} />
            <InfoRow
              icon={Ticket}
              label={isMovie ? 'Tickets' : 'Entry'}
              value={item.priceFrom != null ? `From GH₵${item.priceFrom}` : 'At the venue'}
            />
          </View>

          {/* Description */}
          {item.description ? (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginBottom: 8 }}>
                {isMovie ? 'About this movie' : 'About this event'}
              </Text>
              <Text style={{ fontFamily: font.regular, fontSize: 15, color: '#374151' }}>
                {item.description}
              </Text>
            </View>
          ) : null}

          {item.sponsored && (
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#6B7280', marginTop: 20 }}>
              This is a paid placement. Troski shows sponsored listings to keep the app free.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 12,
          backgroundColor: '#FAFAF9',
          borderTopWidth: 1, borderTopColor: '#F3F4F6',
        }}
      >
        <TouchableOpacity
          onPress={takeMeThere}
          activeOpacity={0.85}
          style={{
            height: 56, borderRadius: 12, backgroundColor: BRAND,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 4,
          }}
        >
          <Navigation size={18} color="#fff" />
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#fff' }}>
            Take me to {item.venueStop}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3EE', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={BRAND} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#000', marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  )
}
