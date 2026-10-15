import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { TrafficCone, Banknote, TriangleAlert, MessageCircleQuestionMark, Camera } from 'lucide-react-native'
import { brand, font, ui } from '@/lib/theme'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { META, PAD } from '@/components/pulse/PulseBits'
import { AdinkraAccent } from '@/components/AdinkraAccent'
import type { AdinkraName } from '@/lib/brand/adinkra'

type Tile = { key: string; label: string; Icon: typeof TrafficCone; href: Href; hint: string; symbol: AdinkraName }

/**
 * One-tap report bar (UX v2 P6): Queue · Fare · Problem · Ask, plus a quiet "+ Photo" link.
 * Replaces "What's happening?" as the main way in; the composer stays behind Ask and Photo.
 */
export function PulseReportBar({ station }: { station: { id: string; name: string } | null }) {
  const router = useRouter()
  const haptics = useHaptics()
  const tiles: Tile[] = [
    {
      key: 'queue', label: 'Queue', Icon: TrafficCone, hint: 'Say how long the queue is', symbol: 'funtunfunefu',
      href: (station
        ? { pathname: '/report/queue', params: { station_id: station.id, station_name: station.name } }
        : '/report/queue') as Href,
    },
    { key: 'fare', label: 'Fare', Icon: Banknote, hint: 'Report what you paid', symbol: 'nteasee', href: '/report/fare' as Href },
    { key: 'problem', label: 'Problem', Icon: TriangleAlert, hint: 'Report a breakdown, accident or road closure', symbol: 'denkyem', href: '/report/incident' as Href },
    // Nyansapo banner copy moved here: the wisdom knot, ask or answer the way.
    { key: 'ask', label: 'Ask', Icon: MessageCircleQuestionMark, symbol: 'nyansapo', hint: 'Ask riders which car to take. Know the way? Answer someone else.', href: '/report/photo?mode=text&kind=question' as Href },
  ]
  return (
    <View style={{ paddingHorizontal: PAD, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tiles.map((t) => (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.8}
            onPress={() => { haptics.light(); router.push(t.href) }}
            accessibilityRole="button"
            accessibilityLabel={t.label === 'Ask' ? 'Ask a question' : `Report ${t.label.toLowerCase()}`}
            accessibilityHint={t.hint}
            style={{
              flex: 1, height: 88, borderRadius: 16, backgroundColor: ui.card, borderWidth: 1, borderColor: '#E7E5E4',
              alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
            }}
          >
            {/* Corner symbol per tile (Nyansapo, the wisdom knot, on Ask). */}
            <AdinkraAccent symbol={t.symbol} size={40} color={brand.orange} opacity={0.1} position="topRight" inset={-8} rotate={-12} />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: brand.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
              <t.Icon size={20} color={brand.orangeText} />
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: ui.text }} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => router.push('/report/photo' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Post a photo or video"
        style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12 }}
      >
        <Camera size={14} color={META} />
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: META }}>+ Photo</Text>
      </TouchableOpacity>
    </View>
  )
}
