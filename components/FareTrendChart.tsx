import { Component, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
  Share,
  PanResponder,
} from 'react-native'
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { TrendingUp, BarChart3, Share2 } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'

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

// Error boundary to prevent chart crashes from taking down the whole screen
class ChartErrorBoundary extends Component<
  { children: React.ReactNode; onRetry: () => void; isDark: boolean },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onRetry: () => void; isDark: boolean }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('FareTrendChart render error:', error?.message || error)
  }

  render() {
    if (this.state.hasError) {
      const t = themed(this.props.isDark)
      return (
        <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={28} color={t.textTertiary} />
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: t.textSecondary, marginTop: 8 }}>
            Chart unavailable
          </Text>
          <TouchableOpacity
            onPress={() => {
              this.setState({ hasError: false })
              this.props.onRetry()
            }}
            style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: c.amber500 }}
          >
            <Text style={{ fontSize: 12, fontFamily: font.medium, color: c.white }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

// Safe number helper — ensures we never pass NaN/Infinity to SVG
function safeNum(val: number, fallback: number = 0): number {
  return typeof val === 'number' && isFinite(val) ? val : fallback
}

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
  const s = useMemo(() => getStyles(isDark), [isDark])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [chartError, setChartError] = useState(false)

  // Keep latest points in a ref so PanResponder always has current data
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const selectedIdxRef = useRef<number | null>(null)
  selectedIdxRef.current = selectedIdx

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIdx(null)
    setChartError(false)
  }, [data])

  const screenWidth = Dimensions.get('window').width
  const chartWidth = Math.max(100, screenWidth - 40 - 32)

  const drawWidth = Math.max(10, chartWidth - CHART_PADDING.left - CHART_PADDING.right)
  const drawHeight = Math.max(10, CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)

  // PanResponder for reliable touch handling
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onPanResponderRelease: (evt) => {
      const { locationX, locationY } = evt.nativeEvent
      const pts = pointsRef.current
      if (!pts || !pts.length) return
      let nearest = -1
      let nearestDist = 30
      for (let i = 0; i < pts.length; i++) {
        const dx = locationX - pts[i].x
        const dy = locationY - pts[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = i
        }
      }
      const prev = selectedIdxRef.current
      setSelectedIdx(nearest === -1 ? null : nearest === prev ? null : nearest)
    },
  }), [])

  // Compute chart data
  const chartData = useMemo(() => {
    try {
      if (!data || !Array.isArray(data) || data.length < 2) {
        return null
      }

      // Filter out bad data points — check every field
      const validData = data.filter(d =>
        d != null &&
        typeof d.day === 'string' && d.day.length > 0 &&
        typeof d.avg_fare === 'number' && isFinite(d.avg_fare) && d.avg_fare >= 0 &&
        typeof d.min_fare === 'number' && isFinite(d.min_fare) && d.min_fare >= 0 &&
        typeof d.max_fare === 'number' && isFinite(d.max_fare) && d.max_fare >= 0 &&
        typeof d.report_count === 'number' && isFinite(d.report_count)
      )
      // Need at least 2 points for a meaningful chart
      if (validData.length < 2) return null

      const safeFare = safeNum(officialFare, 1)

      // Y-axis range
      const allValues = validData.flatMap((d) => [d.avg_fare, d.min_fare, d.max_fare]).concat(safeFare)
      const rawMin = Math.min(...allValues)
      const rawMax = Math.max(...allValues)
      const minVal = Math.floor(safeNum(rawMin, 0) * 0.9 * 2) / 2
      const maxVal = Math.ceil(safeNum(rawMax, 10) * 1.1 * 2) / 2
      const yRange = Math.max(maxVal - minVal, 0.1)

      const toX = (i: number) => safeNum(CHART_PADDING.left + (i / (validData.length - 1)) * drawWidth)
      const toY = (v: number) => safeNum(CHART_PADDING.top + drawHeight - ((v - minVal) / yRange) * drawHeight)

      // Average line path
      const avgPath = validData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.avg_fare).toFixed(1)}`).join(' ')

      // Min-max range area
      const upper = validData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.max_fare).toFixed(1)}`).join(' ')
      const lower = [...validData].reverse().map((d, i) => {
        const origIdx = validData.length - 1 - i
        return `L${toX(origIdx).toFixed(1)},${toY(d.min_fare).toFixed(1)}`
      }).join(' ')
      const rangePath = `${upper} ${lower} Z`

      // Y-axis ticks
      const tickCount = 4
      const yTicks = Array.from({ length: tickCount }, (_, i) => {
        const val = minVal + (yRange * i) / (tickCount - 1)
        return { val: Math.round(val * 100) / 100, y: safeNum(toY(val)) }
      })

      // X-axis labels (first, middle, last)
      const labelIndices = validData.length <= 3
        ? validData.map((_, i) => i)
        : [0, Math.floor(validData.length / 2), validData.length - 1]

      const xLabels = labelIndices.map(idx => {
        const d = new Date(validData[idx].day)
        return {
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          x: safeNum(toX(idx)),
        }
      })

      // Data points
      const points = validData.map((d, i) => ({
        x: safeNum(toX(i)),
        y: safeNum(toY(d.avg_fare)),
        day: d.day,
        avg_fare: d.avg_fare,
        min_fare: d.min_fare,
        max_fare: d.max_fare,
        report_count: d.report_count,
      }))

      return {
        avgPath,
        rangePath,
        yTicks,
        xLabels,
        officialY: safeNum(toY(safeFare)),
        points,
        totalReports: validData.reduce((sum, d) => sum + d.report_count, 0),
      }
    } catch (e) {
      console.warn('FareTrendChart compute error:', e)
      return null
    }
  }, [data, officialFare, drawWidth, drawHeight])

  // Keep ref in sync
  pointsRef.current = chartData?.points || []

  const handleShare = useCallback(async () => {
    const totalReports = (data || []).reduce((sum, d) => sum + (d?.report_count || 0), 0)
    const latestAvg = data?.[data.length - 1]?.avg_fare
    const name = routeName || 'this route'
    const message = latestAvg != null
      ? `Trotro fares on ${name}: ${formatGHS(latestAvg)} avg (Official: ${formatGHS(officialFare)}) based on ${totalReports} community reports. Track real fares on Troski! https://troski.app`
      : `Track real trotro fares on Troski! https://troski.app`
    try {
      await Share.share({ message, title: 'Troski Fare Trend' })
    } catch (e) { console.warn("[troski] silent error:", e) }
  }, [data, officialFare, routeName])

  const handlePeriodChange = useCallback((days: number) => {
    setSelectedIdx(null)
    setChartError(false)
    onPeriodChange?.(days)
  }, [onPeriodChange])

  // Header with period toggle (shared across all states)
  const renderHeader = () => (
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
              onPress={() => handlePeriodChange(p.days)}
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
  )

  if (isLoading) {
    return (
      <View style={s.card}>
        {renderHeader()}
        <View style={{ height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={c.amber500} />
        </View>
      </View>
    )
  }

  if (!chartData || chartError) {
    return (
      <View style={s.card}>
        {renderHeader()}
        <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={28} color={t.textTertiary} />
          <Text style={[s.emptyText, { marginTop: 8 }]}>Not enough data yet</Text>
          <Text style={s.emptySubtext}>Chart appears after 2+ days of reports</Text>
        </View>
      </View>
    )
  }

  const { avgPath, rangePath, yTicks, xLabels, officialY, points, totalReports } = chartData
  const gridColor = isDark ? '#292524' : '#e7e5e3'
  const textColor = isDark ? c.stone500 : c.stone400

  // Bounds-safe selected index
  const safeIdx = selectedIdx !== null && selectedIdx >= 0 && selectedIdx < points.length ? selectedIdx : null
  const selectedPoint = safeIdx !== null ? points[safeIdx] : null

  return (
    <View style={s.card}>
      {renderHeader()}

      <ChartErrorBoundary isDark={isDark} onRetry={() => setChartError(false)}>
        {/* Interactive chart */}
        <View style={{ position: 'relative' }}>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.amber500} stopOpacity={isDark ? '0.15' : '0.12'} />
                <Stop offset="1" stopColor={c.amber500} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Y-axis grid lines + labels */}
            {yTicks.map((tick, i) => (
              <Line key={i} x1={CHART_PADDING.left} y1={tick.y} x2={chartWidth - CHART_PADDING.right} y2={tick.y} stroke={gridColor} strokeWidth={1} strokeDasharray="4,4" />
            ))}
            {yTicks.map((tick, i) => (
              <SvgText key={`yl-${i}`} x={CHART_PADDING.left - 6} y={tick.y + 4} textAnchor="end" fill={textColor} fontSize={10}>
                {safeNum(tick.val).toFixed(1)}
              </SvgText>
            ))}

            {/* Official fare reference line */}
            <Line x1={CHART_PADDING.left} y1={officialY} x2={chartWidth - CHART_PADDING.right} y2={officialY} stroke={isDark ? '#34d399' : '#059669'} strokeWidth={1} strokeDasharray="6,4" />
            <SvgText x={chartWidth - CHART_PADDING.right} y={officialY - 6} textAnchor="end" fill={isDark ? '#34d399' : '#059669'} fontSize={9}>
              Official
            </SvgText>

            {/* Min-max range area */}
            {rangePath ? <Path d={rangePath} fill="url(#rangeGrad)" /> : null}

            {/* Average fare line */}
            {avgPath ? <Path d={avgPath} fill="none" stroke={c.amber500} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}

            {/* Selected point vertical indicator */}
            {selectedPoint && (
              <Line x1={selectedPoint.x} y1={CHART_PADDING.top} x2={selectedPoint.x} y2={CHART_HEIGHT - CHART_PADDING.bottom} stroke={c.amber500} strokeWidth={1} strokeOpacity={0.4} strokeDasharray="3,3" />
            )}

            {/* Data points */}
            {points.map((pt, i) => (
              <Circle key={i} cx={pt.x} cy={pt.y} r={safeIdx === i ? 6 : points.length <= 10 ? 4 : 2.5} fill={c.amber500} stroke={isDark ? c.stone900 : c.white} strokeWidth={safeIdx === i ? 3 : 2} />
            ))}

            {/* X-axis labels */}
            {xLabels.map((xl, i) => (
              <SvgText key={`xl-${i}`} x={xl.x} y={CHART_HEIGHT - 4} textAnchor="middle" fill={textColor} fontSize={10}>
                {xl.label}
              </SvgText>
            ))}
          </Svg>

          {/* Touch overlay */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }} collapsable={false} {...panResponder.panHandlers} />

          {/* Tooltip */}
          {selectedPoint && (
            <View
              style={[s.tooltip, {
                left: Math.max(8, Math.min(selectedPoint.x - 65, chartWidth - 138)),
                top: Math.max(0, selectedPoint.y - 72),
              }]}
              pointerEvents="none"
            >
              <Text style={s.tooltipDate}>
                {formatDay(selectedPoint.day)}
              </Text>
              <Text style={s.tooltipFare}>{formatGHS(safeNum(selectedPoint.avg_fare))}</Text>
              <Text style={s.tooltipRange}>
                Range: {formatGHS(safeNum(selectedPoint.min_fare))} – {formatGHS(safeNum(selectedPoint.max_fare))}
              </Text>
              <Text style={s.tooltipReports}>{selectedPoint.report_count ?? 0} reports</Text>
            </View>
          )}
        </View>
      </ChartErrorBoundary>

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
        <Text style={s.summaryCount}>{totalReports} reports</Text>
      </View>
    </View>
  )
}

function formatDay(day: string): string {
  try {
    const d = new Date(day)
    if (isNaN(d.getTime())) return day || ''
    return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
  } catch {
    return day || ''
  }
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
