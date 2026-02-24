import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { TrendingUp, BarChart3 } from 'lucide-react-native'
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
}: FareTrendChartProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const screenWidth = Dimensions.get('window').width
  const chartWidth = screenWidth - 40 // 20px margin on each side

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

  return (
    <View style={s.card}>
      {/* Header with period toggle */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color={c.amber500} />
          <Text style={s.title}>Fare Trend</Text>
        </View>
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

      {/* Chart */}
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

        {/* Data points */}
        {points.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={data.length <= 10 ? 4 : 2.5}
            fill={c.amber500}
            stroke={isDark ? c.stone900 : c.white}
            strokeWidth={2}
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
  })
}
