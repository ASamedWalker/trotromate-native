import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useNewUpdatesCount } from '@/lib/hooks/useSupabaseRealtime'

interface Props {
  tables?: ('fare_reports' | 'queue_reports' | 'incident_reports' | 'tale_posts')[]
  routeId?: string
  onRefresh: () => void
}

/**
 * Animated "X new updates" banner that slides down when new realtime events arrive.
 */
export default function NewUpdatesBanner({
  tables = ['fare_reports', 'queue_reports', 'incident_reports'],
  routeId,
  onRefresh,
}: Props) {
  const { count, clear } = useNewUpdatesCount(tables, routeId)
  const slideAnim = useRef(new Animated.Value(-50)).current

  useEffect(() => {
    if (count > 0) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start()
    } else {
      slideAnim.setValue(-50)
    }
  }, [count, slideAnim])

  if (count === 0) return null

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        onPress={() => {
          clear()
          onRefresh()
        }}
        activeOpacity={0.8}
        style={styles.btn}
      >
        <ArrowUp size={14} color={c.white} />
        <Text style={styles.text}>
          {count} new update{count !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.amber500,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: c.amber500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: c.white,
    fontSize: 14,
    fontFamily: font.semibold,
  },
})
