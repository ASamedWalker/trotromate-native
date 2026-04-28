import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react-native'
import { useRouter, type Href } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useApp } from '@/lib/contexts/AppContext'
import { useLeaderboard } from '@/lib/hooks/useRewards'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { ReferralCard } from '@/components/ReferralCard'
import InitialsAvatar from '@/components/InitialsAvatar'
import { SkeletonRewards } from '@/components/Skeleton'
import type { LeaderboardEntry } from '@/lib/types'

/* ── Constants ──────────────────────────────────────── */

const MAROON = '#6B1D1D'

const PODIUM_RING: Record<number, string> = {
  1: '#f59e0b',
  2: '#a78bfa',
  3: '#22c55e',
}

/* ── Podium Avatar ──────────────────────────────────── */

function PodiumAvatar({ entry, rank, isFirst }: {
  entry?: LeaderboardEntry
  rank: number
  isFirst?: boolean
}) {
  const size = isFirst ? 112 : 80
  const ringWidth = isFirst ? 6 : 4
  const ringColor = PODIUM_RING[rank] ?? c.stone400

  return (
    <View style={{ alignItems: 'center', width: isFirst ? 130 : 100 }}>
      {isFirst && <Text style={{ fontSize: 28, marginBottom: 4 }}>👑</Text>}

      <View style={{ alignItems: 'center', marginBottom: 10 }}>
        <View style={{
          width: size + ringWidth * 2 + 4,
          height: size + ringWidth * 2 + 4,
          borderRadius: (size + ringWidth * 2 + 4) / 2,
          borderWidth: ringWidth,
          borderColor: ringColor,
          padding: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: '#4A1212',
          }}>
            <InitialsAvatar
              name={entry?.display_name ?? null}
              deviceId={entry?.device_id ?? ''}
              size={size}
            />
          </View>
        </View>

        {/* Rank badge */}
        {isFirst ? (
          <View style={{
            marginTop: -14,
            backgroundColor: '#f59e0b',
            paddingHorizontal: 12,
            paddingVertical: 3,
            borderRadius: 12,
          }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, color: '#2a1700' }}>MVP</Text>
          </View>
        ) : (
          <View style={{
            position: 'absolute',
            bottom: -4,
            right: isFirst ? undefined : -2,
            backgroundColor: '#fff',
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 10, fontFamily: font.bold, color: '#312e2d' }}>{rank}</Text>
          </View>
        )}
      </View>

      <Text
        style={{
          fontSize: isFirst ? 18 : 14,
          fontFamily: font.bold,
          color: '#fff',
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {entry?.display_name ?? '--'}
      </Text>

      <Text style={{
        fontSize: isFirst ? 14 : 12,
        fontFamily: font.bold,
        color: isFirst ? '#f59e0b' : 'rgba(255,255,255,0.8)',
        marginTop: 2,
      }}>
        {entry ? `${formatPts(entry.weekly_points)} pts` : '--'}
      </Text>
    </View>
  )
}

/* ── Helpers ─────────────────────────────────────────── */

function formatPts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

/* ── Main Screen ─────────────────────────────────────── */

export default function RewardsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)
  const { deviceId, refreshProfile } = useApp()
  const { entries: leaderboard, isLoading, refetch: refetchLeaderboard } = useLeaderboard(deviceId)
  useRefreshOnFocus([['profile', deviceId], ['leaderboard', deviceId]])

  const [period, setPeriod] = useState<'week' | 'all'>('all')
  const [showEarnInfo, setShowEarnInfo] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshProfile(), refetchLeaderboard()])
    setRefreshing(false)
  }, [refreshProfile, refetchLeaderboard])

  const sortedBoard = useMemo(() => {
    if (period === 'all') {
      return [...leaderboard].sort((a, b) => b.total_points - a.total_points)
    }
    return leaderboard
  }, [leaderboard, period])

  const pointsKey = period === 'all' ? 'total_points' : 'weekly_points'

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.white}
            colors={[c.amber500]}
          />
        }
      >
        {/* ═══ MAROON HERO ═══ */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.hero}>
          <View style={[s.heroDecor, { top: -40, right: -30, width: 160, height: 160 }]} />
          <View style={[s.heroDecor, { bottom: 40, left: -50, width: 120, height: 120 }]} />

          {isLoading ? (
            <SkeletonRewards isDark={isDark} />
          ) : (
            <>
              <Text style={s.heroTitle}>Leaderboard</Text>
              <Text style={s.heroSubtitle}>Season 4 • Accra Metro</Text>

              {/* Period tabs */}
              <View style={s.periodRow}>
                <TouchableOpacity
                  onPress={() => setPeriod('week')}
                  activeOpacity={0.7}
                  style={[s.periodTab, period === 'week' && s.periodTabActive]}
                >
                  <Text style={[s.periodText, period === 'week' && s.periodTextActive]}>
                    THIS WEEK
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPeriod('all')}
                  activeOpacity={0.7}
                  style={[s.periodTab, period === 'all' && s.periodTabActive]}
                >
                  <Text style={[s.periodText, period === 'all' && s.periodTextActive]}>
                    ALL TIME
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Podium */}
              {sortedBoard.length > 0 ? (
                <View style={s.podiumRow}>
                  <View style={{ marginTop: 24 }}>
                    <PodiumAvatar entry={sortedBoard[1]} rank={2} />
                  </View>
                  <PodiumAvatar entry={sortedBoard[0]} rank={1} isFirst />
                  <View style={{ marginTop: 24 }}>
                    <PodiumAvatar entry={sortedBoard[2]} rank={3} />
                  </View>
                </View>
              ) : (
                <View style={s.emptyPodium}>
                  <Trophy size={40} color="rgba(255,255,255,0.3)" />
                  <Text style={s.emptyPodiumText}>No contributors yet this week</Text>
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* ═══ Overlap content ═══ */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.overlapContent}>
          {/* Referral card — Stitch style */}
          <ReferralCard />

          {/* Ranked list 4–7 */}
          {!isLoading && sortedBoard.length > 3 && (
            <View style={s.rankedSection}>
              <Text style={s.rankedSectionTitle}>Top Contributors</Text>

              {sortedBoard.slice(3, 8).map((entry) => {
                const isMe = entry.device_id === deviceId

                return (
                  <View
                    key={entry.id}
                    style={[s.rankedRow, isMe && s.rankedRowMe]}
                  >
                    <View style={s.rankedLeft}>
                      <Text style={s.rankedRankNum}>{entry.rank}</Text>
                      <View style={s.rankedAvatarWrap}>
                        <InitialsAvatar
                          name={entry.display_name ?? null}
                          deviceId={entry.device_id ?? ''}
                          size={40}
                        />
                      </View>
                      <Text style={s.rankedName} numberOfLines={1}>
                        {(entry.display_name ?? 'Anonymous').toUpperCase()}
                        {isMe ? ' (YOU)' : ''}
                      </Text>
                    </View>
                    <Text style={s.rankedPts}>
                      {formatPts(entry[pointsKey])} pts
                    </Text>
                  </View>
                )
              })}

              <TouchableOpacity
                onPress={() => router.push('/leaderboard' as Href)}
                activeOpacity={0.7}
                style={s.viewFullBtn}
              >
                <Text style={s.viewFullText}>View Full Leaderboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ How to Earn Points ═══ */}
          <View style={s.section}>
            <TouchableOpacity
              onPress={() => setShowEarnInfo(!showEarnInfo)}
              activeOpacity={0.7}
              style={s.earnHeader}
            >
              <View style={s.earnIconWrap}>
                <TrendingUp size={20} color={isDark ? c.amber400 : '#815100'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.earnTitle}>Earn Points</Text>
                <Text style={s.earnSubtitle}>Report fares, queues & more</Text>
              </View>
              {showEarnInfo ? (
                <ChevronUp size={20} color={t.textTertiary} />
              ) : (
                <ChevronDown size={20} color={t.textTertiary} />
              )}
            </TouchableOpacity>

            {showEarnInfo && (
              <View style={s.earnBody}>
                {[
                  { action: 'Report a fare', points: '+10', icon: '🚐' },
                  { action: 'Report queue status', points: '+5', icon: '🕐' },
                  { action: 'Report incident', points: '+15', icon: '⚠️' },
                  { action: 'Report train', points: '+10', icon: '🚆' },
                  { action: 'Share a tale', points: '+8', icon: '📸' },
                  { action: '7-day streak bonus', points: '+5', icon: '🔥' },
                ].map((item, index, arr) => (
                  <View
                    key={index}
                    style={[s.earnRow, index < arr.length - 1 && s.earnRowBorder]}
                  >
                    <Text style={s.earnEmoji}>{item.icon}</Text>
                    <Text style={s.earnAction}>{item.action}</Text>
                    <View style={s.earnPointsPill}>
                      <Zap size={12} color="#815100" />
                      <Text style={s.earnPointsText}>{item.points}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

/* ── Styles ──────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)

  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const surfaceHigh = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? t.bg : '#fcf5f2' },
    section: { marginBottom: 16 },

    /* ═══ MAROON HERO ═══ */
    hero: {
      backgroundColor: MAROON,
      paddingTop: 40,
      paddingBottom: 48,
      paddingHorizontal: 20,
      overflow: 'hidden',
    },
    heroDecor: {
      position: 'absolute',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroTitle: {
      fontSize: 32,
      fontFamily: font.extrabold,
      color: '#fff',
      textAlign: 'center',
      letterSpacing: -1,
    },
    heroSubtitle: {
      fontSize: 12,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 3,
      marginTop: 6,
      marginBottom: 20,
    },

    periodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginBottom: 20,
    },
    periodTab: {
      paddingBottom: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    periodTabActive: {
      borderBottomColor: '#fff',
    },
    periodText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: 'rgba(255,255,255,0.4)',
      letterSpacing: 1.5,
    },
    periodTextActive: {
      color: '#fff',
    },

    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
    },
    emptyPodium: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyPodiumText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 14,
      fontFamily: font.medium,
      marginTop: 12,
    },

    /* ═══ Overlap content ═══ */
    overlapContent: {
      marginTop: -20,
      paddingHorizontal: 20,
    },

    /* ═══ Ranked list ═══ */
    rankedSection: {
      marginBottom: 16,
    },
    rankedSectionTitle: {
      fontSize: 11,
      fontFamily: font.bold,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59',
      textTransform: 'uppercase',
      letterSpacing: 3,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    rankedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 14,
      backgroundColor: surfaceLow,
      marginBottom: 8,
    },
    rankedRowMe: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)',
    },
    rankedLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    rankedRankNum: {
      width: 22,
      fontSize: 14,
      fontFamily: font.bold,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59',
      textAlign: 'center',
    },
    rankedAvatarWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      opacity: 0.8,
    },
    rankedName: {
      flex: 1,
      fontSize: 13,
      fontFamily: font.bold,
      color: t.text,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    rankedPts: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
    },
    viewFullBtn: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    viewFullText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: '#815100',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },

    /* ═══ Earn Points ═══ */
    earnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      borderRadius: 16,
      backgroundColor: surfaceLowest,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 3,
    },
    earnIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(129,81,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    earnTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    earnSubtitle: {
      fontSize: 12,
      fontFamily: font.regular,
      color: isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59',
      marginTop: 2,
    },
    earnBody: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      backgroundColor: surfaceLowest,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      marginTop: -12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 3,
    },
    earnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    earnRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e3dbd8',
    },
    earnEmoji: {
      fontSize: 20,
      width: 28,
      textAlign: 'center',
    },
    earnAction: {
      flex: 1,
      fontSize: 15,
      fontFamily: font.medium,
      color: t.text,
    },
    earnPointsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(129,81,0,0.08)',
    },
    earnPointsText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
    },
  })
}
