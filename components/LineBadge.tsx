import { View, Text } from 'react-native'
import { font } from '@/lib/theme'
import { corridorFor } from '@/lib/constants/corridors'

/** Corridor code on its colour, e.g. [MAD·CIR] in blue. */
export function LineBadge({ from, to, big = false }: { from: string; to: string; big?: boolean }) {
  const { code, color } = corridorFor(from, to)
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: 8, paddingHorizontal: big ? 10 : 8, paddingVertical: big ? 4 : 2 }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: big ? 14 : 12, color: '#FFFFFF', letterSpacing: 0.4 }}>{code}</Text>
    </View>
  )
}
