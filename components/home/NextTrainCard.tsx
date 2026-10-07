import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { SvgXml } from 'react-native-svg'
import { ChevronRight } from 'lucide-react-native'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import { nextDepartures, formatRemaining } from '@/lib/utils/train-stations'
import { font } from '@/lib/theme'

const patternCache = new Map<string, string>()
function trainPattern(w: number, h: number): string {
  const key = `${w}x${h}`
  let xml = patternCache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, h, 26, 'rgba(255,255,255,0.05)'); patternCache.set(key, xml) }
  return xml
}

// Next scheduled departure across all lines (same util the Train tab's board uses).
export default function NextTrainCard() {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    timer.current = setInterval(() => setNow(new Date()), 30000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  const next = nextDepartures(now)[0]
  if (!next) return null
  const today = next.offset === 0

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/train' as any) }}
      onLayout={(e) => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
      accessibilityRole="button"
      accessibilityLabel={`Next train, ${next.lineName}, ${next.origin} to ${next.destination}, ${next.when} ${next.departTime}`}
      style={{ marginHorizontal: 20, borderRadius: 18, backgroundColor: '#0c1220', padding: 18, overflow: 'hidden' }}
    >
      {size.w > 0 ? (
        <View style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
          <SvgXml xml={trainPattern(size.w, size.h)} width={size.w} height={size.h} />
        </View>
      ) : null}
      <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.6)' }}>
        NEXT TRAIN · {next.lineName.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 17, color: '#FFFFFF' }} numberOfLines={2}>
            {next.origin} → {next.destination}
          </Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {today ? `in ${formatRemaining(next.remainingMinutes!)}` : next.when} · departs {next.departTime}
          </Text>
        </View>
        <ChevronRight size={22} color="rgba(255,255,255,0.7)" />
      </View>
    </TouchableOpacity>
  )
}
