import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native'
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { TrendingUp, BarChart3, Share2 } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'

export interface FareTrendPoint {
  day: string
  avg_fare: number
  min_fare: number
  max_fare: number
  report_count: number
}

interface FareTrendChartProps {
  data: FareTrendPoint[]
  officialFare: number
  isLoading?: boolean
  onPeriodChange?: (days: number) => void
  selectedPeriod?: number
  routeName?: string
}

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
]

const CHART_HEIGHT = 160
const CHART_PADDING = { top: 20, right: 16, bottom: 28, left: 42 }

export function FareTrendChart({
  data,
  officialFare,
  isLoading,
  onPeriodChange,
  selectedPeriod = 30,
  routeName,
}: FareTrendChartProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const chartRef = useRef<View>(null)
  const chartLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Reset selection when data changes (e.g., switching 30D → 7D)
  useEffect(() => {
    setSelectedIdx(null)
  }, [data])

  const screenWidth = Dimensions.get('window').width
  const chartWidth = screenWidth - 40 - 32 // 20px margin + 16px padding on each side

  const drawWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right
  const drawHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

  const { avgPath, rangePath, yTicks, xLabels, officialY, points } = useMemo(() => {
    if (!data.length) return { avgPath: '', rangePath: '', yTicks: [], xLabels: [], officialY: 0, points: [] }

    // Y-axis range: include official fare and all reported fares
    const allValues = data.flatMap((d) => [d.avg_fare, d.min_fare, d.max_fare]).concat(officialFare)
    const minVal = Math.floor(Math.min(...allValues) * 0.9 * 2) / 2
    const maxVal = Math.ceil(Math.max(...allValues) * 1.1 * 2) / 2
    const yRange = maxVal - minVal || 1

    const toX = (i: number) => CHART_PADDING.left + (i / Math.max(data.length - 1, 1)) * drawWidth
    const toY = (v: number) => CHART_PADDING.top + drawHeight - ((v - minVal) / yRange) * drawHeight

    // Average line path
    const avg = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.avg_fare).toFixed(1)}`).join(' ')

    // Min-max range area
    const upper = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.max_fare).toFixed(1)}`).join(' ')
    const lower = [...data].reverse().map((d, i) => {
      const origIdx = data.length - 1 - i
      return `L${toX(origIdx).toFixed(1)},${toY(d.min_fare).toFixed(1)}`
    }).join(' ')
    const range = `${upper} ${lower} Z`

    // Y-axis ticks (3-4 ticks)
    const tickCount = 4
    const yTicks = Array.from({ length: tickCount }, (_, i) => {
      const val = minVal + (yRange * i) / (tickCount - 1)
      return { val: Math.round(val * 100) / 100, y: toY(val) }
    })

    // X-axis labels (show first, middle, last)
    const xLabels: { label: string; x: number }[] = []
    const labelIndices = data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1]

    for (const idx of labelIndices) {
      const d = new Date(data[idx].day)
      const label = `${d.getDate()}/${d.getMonth() + 1}`
      xLabels.push({ label, x: toX(idx) })
    }

    // Data points for touch targets
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.avg_fare), ...d }))

    return {
      avgPath: avg,
      rangePath: range,
      yTicks,
      xLabels,
      officialY: toY(officialFare),
      points: pts,
    }
  }, [data, officialFare, drawWidth, drawHeight])

  if (isLoading) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <BarChart3 size={18} color={c.amber500} />
          <Text style={s.title}>Fare Trend</Text>
        </View>
        <View style={{ height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={c.amber500} />
        </View>
      </View>
    )
  }

  if (!data.length) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <BarChart3 size={18} color={c.amber500} />
          <Text style={s.title}>Fare Trend</Text>
        </View>
        <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={28} color={t.textTertiary} />
          <Text style={[s.emptyText, { marginTop: 8 }]}>Not enough data yet</Text>
          <Text style={s.emptySubtext}>Chart appears after 2+ days of reports</Text>
        </View>
      </View>
    )
  }

  const gridColor = isDark ? '#292524' : '#e7e5e3'
  const textColor = isDark ? c.stone500 : c.stone400
  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null

  const handleShare = useCallback(async () => {
    const totalReports = data.reduce((sum, d) => sum + d.report_count, 0)
    const latestAvg = data[data.length - 1]?.avg_fare
    const name = routeName || 'this route'
    const message = latestAvg
      ? `Trotro fares on ${name}: ₵${latestAvg.toFixed(2)} avg (Official: ₵${officialFare.toFixed(2)}) based on ${totalReports} community reports. Track real fares on Troski! https://troski.app`
      : `Track real trotro fares on Troski! https://troski.app`
    try {
      await Share.share({ message, title: 'Troski Fare Trend' })
    } catch {}
  }, [data, officialFare, routeName])

  return (
    <View style={s.card}>
      {/* Header with period toggle + share */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color={c.amber500} />
          <Text style={s.title}>Fare Trend</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={handleShare} hitSlop={8} style={s.shareBtn}>
            <Share2 size={14} color={c.amber500} />
          </TouchableOpacity>
          <View style={s.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.days}
                onPress={() => onPeriodChange?.(p.days)}
                style={[s.periodBtn, selectedPeriod === p.days && s.periodBtnActive]}
              >
                <Text style={[s.periodText, selectedPeriod === p.days && s.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Chart with touch-based point selection */}
      <View
        style={{ position: 'relative' }}
        ref={chartRef}
        onLayout={(e) => {
          chartLayoutRef.current = e.nativeEvent.layout
        }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => {
          const touchX = e.nativeEvent.locationX
          const touchY = e.nativeEvent.locationY
          // Find nearest point within 30px tap radius
          let nearest = -1
          let nearestDist = 30
          for (let i = 0; i < points.length; i++) {
            const dx = touchX - points[i].x
            const dy = touchY - points[i].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < nearestDist) {
              nearestDist = dist
              nearest = i
            }
          }
          setSelectedIdx(nearest === -1 ? null : nearest === selectedIdx ? null : nearest)
        }}
      >
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.amber500} stopOpacity={isDark ? '0.15' : '0.12'} />
              <Stop offset="1" stopColor={c.amber500} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((tick, i) => (
            <Line
              key={i}
              x1={CHART_PADDING.left}
              y1={tick.y}
              x2={chartWidth - CHART_PADDING.right}
              y2={tick.y}
              stroke={gridColor}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          ))}
          {yTicks.map((tick, i) => (
            <SvgText
              key={`label-${i}`}
              x={CHART_PADDING.left - 6}
              y={tick.y + 4}
              textAnchor="end"
              fill={textColor}
              fontSize={10}
            >
              {tick.val.toFixed(1)}
            </SvgText>
          ))}

          {/* Official fare reference line */}
          <Line
            x1={CHART_PADDING.left}
            y1={officialY}
            x2={chartWidth - CHART_PADDING.right}
            y2={officialY}
            stroke={isDark ? '#34d399' : '#059669'}
            strokeWidth={1}
            strokeDasharray="6,4"
          />
          <SvgText
            x={chartWidth - CHART_PADDING.right}
            y={officialY - 6}
            textAnchor="end"
            fill={isDark ? '#34d399' : '#059669'}
            fontSize={9}
          >
            Official
          </SvgText>

          {/* Min-max range area */}
          <Path d={rangePath} fill="url(#rangeGrad)" />

          {/* Average fare line */}
          <Path d={avgPath} fill="none" stroke={c.amber500} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Selected point vertical indicator */}
          {selectedPoint && (
            <Line
              x1={selectedPoint.x}
              y1={CHART_PADDING.top}
              x2={selectedPoint.x}
              y2={CHART_HEIGHT - CHART_PADDING.bottom}
              stroke={c.amber500}
              strokeWidth={1}
              strokeOpacity={0.4}
              strokeDasharray="3,3"
            />
          )}

          {/* Data points — visible dots */}
          {points.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={selectedIdx === i ? 6 : data.length <= 10 ? 4 : 2.5}
              fill={c.amber500}
              stroke={isDark ? c.stone900 : c.white}
              strokeWidth={selectedIdx === i ? 3 : 2}
            />
          ))}

          {/* X-axis labels */}
          {xLabels.map((xl, i) => (
            <SvgText
              key={i}
              x={xl.x}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              fill={textColor}
              fontSize={10}
            >
              {xl.label}
            </SvgText>
          ))}
        </Svg>

        {/* Tooltip card */}
        {selectedPoint && (
          <View
            style={[
              s.tooltip,
              {
                left: Math.max(8, Math.min(selectedPoint.x - 65, chartWidth - 138)),
                top: Math.max(0, selectedPoint.y - 72),
              },
            ]}
            pointerEvents="none"
          >
            <Text style={s.tooltipDate}>
              {new Date(selectedPoint.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={s.tooltipFare}>₵{selectedPoint.avg_fare.toFixed(2)}</Text>
            <Text style={s.tooltipRange}>
              Range: ₵{selectedPoint.min_fare.toFixed(2)} – ₵{selectedPoint.max_fare.toFixed(2)}
            </Text>
            <Text style={s.tooltipReports}>{selectedPoint.report_count} reports</Text>
          </View>
        )}
      </View>

      {/* Summary row */}
      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <View style={[s.summaryDot, { backgroundColor: c.amber500 }]} />
          <Text style={s.summaryLabel}>Avg reported</Text>
        </View>
        <View style={s.summaryItem}>
          <View style={[s.summaryDot, { backgroundColor: isDark ? '#34d399' : '#059669' }]} />
          <Text style={s.summaryLabel}>Official fare</Text>
        </View>
        <Text style={s.summaryCount}>
          {data.reduce((sum, d) => sum + d.report_count, 0)} reports
        </Text>
      </View>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      paddingBottom: 12,
      borderRadius: 20,
      backgroundColor: t.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
    },
    periodRow: {
      flexDirection: 'row',
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: t.cardAlt,
    },
    periodBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    periodBtnActive: {
      backgroundColor: c.amber500,
    },
    periodText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    periodTextActive: {
      color: c.white,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    emptySubtext: {
      fontSize: 12,
      color: t.textTertiary,
      marginTop: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 12,
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    summaryLabel: {
      fontSize: 11,
      color: t.textSecondary,
    },
    summaryCount: {
      fontSize: 11,
      color: t.textTertiary,
      marginLeft: 'auto',
    },
    shareBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
    },
    tooltip: {
      position: 'absolute' as const,
      width: 130,
      backgroundColor: isDark ? c.stone800 : c.white,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: isDark ? c.stone700 : c.stone200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 6,
      elevation: 6,
    },
    tooltipDate: {
      fontSize: 10,
      fontFamily: font.medium,
      color: t.textTertiary,
      marginBottom: 2,
    },
    tooltipFare: {
      fontSize: 16,
      fontFamily: font.bold,
      color: c.amber500,
    },
    tooltipRange: {
      fontSize: 10,
      color: t.textSecondary,
      marginTop: 2,
    },
    tooltipReports: {
      fontSize: 10,
      color: t.textTertiary,
      marginTop: 1,
    },
  })
}
