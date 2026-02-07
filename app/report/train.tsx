import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  TrainFront,
  Clock,
  Users,
  Coins,
  Timer,
  Check,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  MapPin,
  Sparkles,
  CircleDot,
  Gauge,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { useSubmitTrainReport } from '@/lib/hooks/useTrain'
import { useApp } from '@/lib/contexts/AppContext'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { fetchTrainLineDetail } from '@/lib/services/train'
import type { TrainStation, TrainLine } from '@/lib/types'

const SKY = '#0ea5e9'

const CROWD_LEVELS = [
  { id: 'empty', label: 'Empty', description: 'Plenty of seats', color: '#22c55e', Icon: CircleDot },
  { id: 'few_seats', label: 'Few Seats', description: 'Some seats left', color: '#eab308', Icon: Gauge },
  { id: 'standing', label: 'Standing', description: 'Standing room only', color: '#f97316', Icon: Users },
  { id: 'packed', label: 'Packed', description: 'Very crowded', color: '#ef4444', Icon: Users },
]

const REPORT_TYPES = [
  { id: 'schedule', label: 'Train Spotted', description: 'Train just arrived or left', Icon: Clock, color: SKY },
  { id: 'crowd', label: 'How Full?', description: 'Report crowding level', Icon: Users, color: '#8b5cf6' },
  { id: 'fare', label: 'Report Fare', description: 'What did you pay?', Icon: Coins, color: '#f59e0b' },
  { id: 'delay', label: 'Running Late', description: 'Report a delay', Icon: Timer, color: '#ef4444' },
]

const STEP_LABELS = ['Line', 'Station', 'Report']

export default function TrainReportScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ lineId?: string; stationId?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, refreshProfile, setLastReward } = useApp()
  const haptics = useHaptics()
  const { submit, isSubmitting } = useSubmitTrainReport(deviceId)
  const { lines, isLoading: linesLoading } = useTrainLines()

  const [step, setStep] = useState(params.lineId ? (params.stationId ? 3 : 2) : 1)
  const [selectedLine, setSelectedLine] = useState<TrainLine | null>(null)
  const [stations, setStations] = useState<TrainStation[]>([])
  const [selectedStation, setSelectedStation] = useState<TrainStation | null>(null)
  const [reportType, setReportType] = useState<string | null>(null)

  // Report type-specific fields
  const [direction, setDirection] = useState<string | null>(null)
  const [crowdLevel, setCrowdLevel] = useState<string | null>(null)
  const [fare, setFare] = useState('')
  const [delayMins, setDelayMins] = useState('')

  // Pre-select line if passed via params
  useEffect(() => {
    if (params.lineId && lines.length > 0) {
      const line = lines.find((l) => l.id === params.lineId)
      if (line) handleSelectLine(line)
    }
  }, [params.lineId, lines])

  const handleSelectLine = async (line: TrainLine) => {
    setSelectedLine(line)
    const detail = await fetchTrainLineDetail(line.id)
    if (detail) setStations(detail.stations)
    setStep(2)
  }

  const handleSelectStation = (station: TrainStation) => {
    setSelectedStation(station)
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!selectedLine || !selectedStation || !reportType) {
      Alert.alert('Missing Info', 'Please complete all steps')
      return
    }

    if (reportType === 'fare') {
      const fareVal = parseFloat(fare)
      if (isNaN(fareVal) || fareVal <= 0) {
        Alert.alert('Invalid Fare', 'Please enter a valid fare amount')
        return
      }
    }

    if (reportType === 'delay') {
      const delayVal = parseInt(delayMins, 10)
      if (isNaN(delayVal) || delayVal <= 0) {
        Alert.alert('Invalid Delay', 'Please enter delay in minutes')
        return
      }
    }

    const result = await submit({
      lineId: selectedLine.id,
      stationId: selectedStation.id,
      reportType,
      direction: direction || undefined,
      crowdLevel: crowdLevel || undefined,
      reportedFare: reportType === 'fare' ? parseFloat(fare) : undefined,
      delayMins: reportType === 'delay' ? parseInt(delayMins, 10) : undefined,
    })

    if (result) {
      haptics.success()
      await refreshProfile()
      setLastReward(result)
      router.back()
    } else {
      Alert.alert('Error', 'Failed to submit report. Please try again.')
    }
  }

  const lineColor = selectedLine?.color || SKY

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Hero Header ──────────────────────────────────── */}
        <View style={[s.hero, { backgroundColor: lineColor }]}>
          <View style={s.heroGlow} />
          <View style={s.heroContent}>
            <View style={s.heroTopRow}>
              <View style={s.heroIconBox}>
                <TrainFront size={26} color={c.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>Train Report</Text>
                <Text style={s.heroSub}>Help fellow commuters</Text>
              </View>
              <View style={s.pointsBadge}>
                <Sparkles size={12} color={c.white} />
                <Text style={s.pointsText}>+10 pts</Text>
              </View>
            </View>

            {/* Step Progress */}
            <View style={s.progressRow}>
              {STEP_LABELS.map((label, i) => {
                const stepNum = i + 1
                const isActive = step >= stepNum
                const isCurrent = step === stepNum
                return (
                  <View key={label} style={s.progressItem}>
                    {i > 0 && (
                      <View style={[s.progressLine, isActive && s.progressLineActive]} />
                    )}
                    <View
                      style={[
                        s.progressDot,
                        isActive && s.progressDotActive,
                        isCurrent && s.progressDotCurrent,
                      ]}
                    >
                      {step > stepNum ? (
                        <Check size={10} color={c.white} strokeWidth={3} />
                      ) : (
                        <Text style={[s.progressNum, isActive && s.progressNumActive]}>
                          {stepNum}
                        </Text>
                      )}
                    </View>
                    <Text style={[s.progressLabel, isActive && s.progressLabelActive]}>
                      {label}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        {/* ─── Step 1: Select Line ─────────────────────────── */}
        {step === 1 && (
          <View style={s.body}>
            <View style={s.sectionHeader}>
              <TrainFront size={16} color={SKY} />
              <Text style={s.sectionTitle}>Select Train Line</Text>
            </View>

            {linesLoading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator size="small" color={SKY} />
                <Text style={s.loadingText}>Loading lines...</Text>
              </View>
            ) : lines.length === 0 ? (
              <View style={s.emptyBox}>
                <TrainFront size={32} color={t.textTertiary} />
                <Text style={s.emptyText}>No train lines available yet</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {lines.map((line) => (
                  <TouchableOpacity
                    key={line.id}
                    onPress={() => handleSelectLine(line)}
                    activeOpacity={0.7}
                    style={s.lineCard}
                  >
                    {/* Colored accent */}
                    <View style={[s.lineAccent, { backgroundColor: line.color }]} />
                    <View style={s.lineBody}>
                      <View style={[s.lineIconBox, { backgroundColor: `${line.color}15` }]}>
                        <TrainFront size={18} color={line.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.lineName}>{line.name}</Text>
                        <View style={s.lineMetaRow}>
                          <Text style={s.lineMeta}>
                            {line.station_count} stations
                          </Text>
                          {line.stats && line.stats.total_reports > 0 && (
                            <>
                              <View style={s.lineDotSep} />
                              <Text style={s.lineMeta}>
                                {line.stats.total_reports} reports
                              </Text>
                            </>
                          )}
                          {line.official_fare && (
                            <>
                              <View style={s.lineDotSep} />
                              <Text style={[s.lineMeta, { color: line.color, fontFamily: font.semibold }]}>
                                ₵{line.official_fare.toFixed(2)}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <ChevronRight size={18} color={t.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ─── Step 2: Select Station ──────────────────────── */}
        {step === 2 && (
          <View style={s.body}>
            {/* Selected line pill */}
            <TouchableOpacity
              onPress={() => setStep(1)}
              activeOpacity={0.7}
              style={s.breadcrumb}
            >
              <View style={[s.breadcrumbDot, { backgroundColor: lineColor }]} />
              <Text style={s.breadcrumbText}>{selectedLine?.name}</Text>
              <Text style={s.breadcrumbChange}>Change</Text>
            </TouchableOpacity>

            <View style={[s.sectionHeader, { marginTop: 16 }]}>
              <MapPin size={16} color={lineColor} />
              <Text style={s.sectionTitle}>Select Station</Text>
            </View>

            <View style={s.stationCard}>
              {stations.map((station, index) => {
                const isFirst = index === 0
                const isLast = index === stations.length - 1
                const isTerminal = isFirst || isLast

                return (
                  <TouchableOpacity
                    key={station.id}
                    onPress={() => handleSelectStation(station)}
                    activeOpacity={0.7}
                    style={s.stationRow}
                  >
                    {/* Metro timeline */}
                    <View style={s.connector}>
                      {!isFirst && (
                        <View style={[s.lineSegTop, { backgroundColor: lineColor }]} />
                      )}
                      {isTerminal ? (
                        <View style={[s.terminalDot, { backgroundColor: lineColor }]}>
                          <View style={s.terminalInner} />
                        </View>
                      ) : (
                        <View style={[s.stationDot, { borderColor: lineColor }]} />
                      )}
                      {!isLast && (
                        <View style={[s.lineSegBottom, { backgroundColor: lineColor }]} />
                      )}
                    </View>

                    <View style={s.stationInfo}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.stationName, isTerminal && s.stationNameBold]}>
                          {station.name}
                        </Text>
                        {isFirst && <Text style={s.stationHint}>Origin</Text>}
                        {isLast && <Text style={s.stationHint}>Terminus</Text>}
                      </View>
                      <ChevronRight size={16} color={t.textTertiary} />
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* ─── Step 3: Report Type + Details ───────────────── */}
        {step === 3 && (
          <View style={s.body}>
            {/* Selected station breadcrumb */}
            <TouchableOpacity
              onPress={() => setStep(2)}
              activeOpacity={0.7}
              style={s.breadcrumb}
            >
              <MapPin size={14} color={lineColor} />
              <Text style={s.breadcrumbText}>
                {selectedStation?.name}
              </Text>
              <View style={s.breadcrumbSep} />
              <View style={[s.breadcrumbDot, { backgroundColor: lineColor }]} />
              <Text style={[s.breadcrumbText, { fontSize: 12 }]}>{selectedLine?.name}</Text>
              <Text style={s.breadcrumbChange}>Change</Text>
            </TouchableOpacity>

            {/* Report type selection */}
            <View style={[s.sectionHeader, { marginTop: 16 }]}>
              <Sparkles size={16} color={lineColor} />
              <Text style={s.sectionTitle}>What are you reporting?</Text>
            </View>

            <View style={s.typeGrid}>
              {REPORT_TYPES.map((type) => {
                const isSelected = reportType === type.id
                const Icon = type.Icon
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setReportType(type.id)}
                    activeOpacity={0.7}
                    style={[
                      s.typeCard,
                      isSelected && { borderColor: type.color, backgroundColor: `${type.color}08` },
                    ]}
                  >
                    {/* Color accent bar */}
                    {isSelected && (
                      <View style={[s.typeAccent, { backgroundColor: type.color }]} />
                    )}
                    <View style={[s.typeIconBox, { backgroundColor: `${type.color}15` }]}>
                      <Icon size={20} color={type.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.typeLabel}>{type.label}</Text>
                      <Text style={s.typeDesc}>{type.description}</Text>
                    </View>
                    {isSelected && (
                      <View style={[s.checkCircle, { backgroundColor: type.color }]}>
                        <Check size={12} color={c.white} strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* ─── Type-specific fields ───────────────── */}

            {reportType === 'schedule' && (
              <View style={s.detailSection}>
                <Text style={s.detailLabel}>Direction of travel</Text>
                <View style={s.dirRow}>
                  {[
                    { id: 'inbound', label: 'Inbound', sub: 'To Accra', Icon: ArrowDown, color: '#0ea5e9' },
                    { id: 'outbound', label: 'Outbound', sub: 'To Tema', Icon: ArrowUp, color: '#8b5cf6' },
                  ].map((dir) => {
                    const isActive = direction === dir.id
                    return (
                      <TouchableOpacity
                        key={dir.id}
                        onPress={() => setDirection(dir.id)}
                        activeOpacity={0.7}
                        style={[
                          s.dirCard,
                          isActive && { borderColor: dir.color, backgroundColor: `${dir.color}08` },
                        ]}
                      >
                        <View style={[s.dirIconBox, isActive && { backgroundColor: dir.color }]}>
                          <dir.Icon
                            size={18}
                            color={isActive ? c.white : t.textSecondary}
                          />
                        </View>
                        <Text style={[s.dirLabel, isActive && { color: dir.color }]}>
                          {dir.label}
                        </Text>
                        <Text style={s.dirSub}>{dir.sub}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {reportType === 'crowd' && (
              <View style={s.detailSection}>
                <Text style={s.detailLabel}>How full is the train?</Text>
                <View style={s.crowdGrid}>
                  {CROWD_LEVELS.map((level) => {
                    const isSelected = crowdLevel === level.id
                    const LevelIcon = level.Icon
                    return (
                      <TouchableOpacity
                        key={level.id}
                        onPress={() => setCrowdLevel(level.id)}
                        activeOpacity={0.7}
                        style={[
                          s.crowdCard,
                          isSelected && {
                            borderColor: level.color,
                            backgroundColor: `${level.color}10`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.crowdIconBox,
                            { backgroundColor: `${level.color}15` },
                            isSelected && { backgroundColor: level.color },
                          ]}
                        >
                          <LevelIcon
                            size={18}
                            color={isSelected ? c.white : level.color}
                          />
                        </View>
                        <Text style={[s.crowdLabel, isSelected && { color: level.color, fontFamily: font.bold }]}>
                          {level.label}
                        </Text>
                        <Text style={s.crowdDesc}>{level.description}</Text>
                        {isSelected && (
                          <View style={[s.crowdCheck, { backgroundColor: level.color }]}>
                            <Check size={10} color={c.white} strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {reportType === 'fare' && (
              <View style={s.detailSection}>
                <Text style={s.detailLabel}>Fare Amount (GH₵)</Text>
                <View style={s.fareCard}>
                  <View style={s.fareInputRow}>
                    <View style={s.cediBox}>
                      <Text style={s.cediSign}>₵</Text>
                    </View>
                    <TextInput
                      value={fare}
                      onChangeText={setFare}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={t.textTertiary}
                      style={s.fareInput}
                    />
                  </View>
                  <View style={s.fareQuickRow}>
                    {['1.00', '2.00', '3.00', '5.00'].map((amount) => {
                      const isActive = fare === amount
                      return (
                        <TouchableOpacity
                          key={amount}
                          onPress={() => setFare(amount)}
                          activeOpacity={0.7}
                          style={[
                            s.fareChip,
                            isActive && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
                          ]}
                        >
                          <Text
                            style={[
                              s.fareChipText,
                              isActive && { color: c.white },
                            ]}
                          >
                            ₵{amount}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              </View>
            )}

            {reportType === 'delay' && (
              <View style={s.detailSection}>
                <Text style={s.detailLabel}>Delay Duration</Text>
                <View style={s.delayCard}>
                  <View style={s.delayInputRow}>
                    <View style={s.delayIconBox}>
                      <Timer size={20} color="#ef4444" />
                    </View>
                    <TextInput
                      value={delayMins}
                      onChangeText={setDelayMins}
                      placeholder="Minutes"
                      keyboardType="number-pad"
                      placeholderTextColor={t.textTertiary}
                      style={s.delayInput}
                    />
                    <Text style={s.delayUnit}>min</Text>
                  </View>
                  <View style={s.delayQuickRow}>
                    {[
                      { val: '5', label: '5 min' },
                      { val: '10', label: '10 min' },
                      { val: '15', label: '15 min' },
                      { val: '30', label: '30 min' },
                    ].map((item) => {
                      const isActive = delayMins === item.val
                      return (
                        <TouchableOpacity
                          key={item.val}
                          onPress={() => setDelayMins(item.val)}
                          activeOpacity={0.7}
                          style={[
                            s.delayChip,
                            isActive && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
                          ]}
                        >
                          <Text
                            style={[
                              s.delayChipText,
                              isActive && { color: c.white },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* ─── Submit Button ──────────────────────── */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || !reportType}
              activeOpacity={0.85}
              style={[
                s.submitBtn,
                { backgroundColor: reportType ? (REPORT_TYPES.find((r) => r.id === reportType)?.color || SKY) : t.textTertiary },
                (isSubmitting || !reportType) && s.submitBtnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={c.white} />
              ) : (
                <>
                  <TrainFront size={20} color={c.white} />
                  <Text style={s.submitText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },

    // ── Hero Header ──
    hero: {
      paddingBottom: 20,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroContent: { paddingHorizontal: 24, paddingTop: 12 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center' },
    heroIconBox: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    heroTitle: { color: c.white, fontSize: 20, fontFamily: font.bold },
    heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: font.regular, marginTop: 1 },
    pointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    pointsText: { color: c.white, fontSize: 12, fontFamily: font.bold },

    // ── Step Progress ──
    progressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginTop: 20,
      gap: 0,
    },
    progressItem: {
      alignItems: 'center',
      flex: 1,
      position: 'relative',
    },
    progressDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressDotActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
    progressDotCurrent: {
      backgroundColor: c.white,
      shadowColor: c.white,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    progressNum: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: font.bold },
    progressNumActive: { color: 'rgba(255,255,255,0.8)' },
    progressLabel: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
      fontFamily: font.medium,
      marginTop: 6,
    },
    progressLabelActive: { color: 'rgba(255,255,255,0.85)' },
    progressLine: {
      position: 'absolute',
      top: 13,
      right: '50%',
      left: -100,
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.15)',
      zIndex: -1,
    },
    progressLineActive: { backgroundColor: 'rgba(255,255,255,0.4)' },

    // ── Body ──
    body: { paddingHorizontal: 20, paddingTop: 20 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontFamily: font.bold, color: t.text },

    // ── Loading / Empty ──
    loadingBox: {
      padding: 40,
      borderRadius: 20,
      backgroundColor: t.card,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    loadingText: { fontSize: 13, fontFamily: font.regular, color: t.textSecondary },
    emptyBox: {
      padding: 40,
      borderRadius: 20,
      backgroundColor: t.card,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    emptyText: { fontSize: 14, fontFamily: font.regular, color: t.textSecondary },

    // ── Line Selection Cards ──
    lineCard: {
      flexDirection: 'row',
      borderRadius: 16,
      backgroundColor: t.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    lineAccent: { width: 4 },
    lineBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    lineIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    lineName: { fontFamily: font.semibold, fontSize: 15, color: t.text },
    lineMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    lineMeta: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },
    lineDotSep: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: t.textTertiary,
      marginHorizontal: 6,
    },

    // ── Breadcrumb ──
    breadcrumb: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 14,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      gap: 8,
    },
    breadcrumbDot: { width: 8, height: 8, borderRadius: 4 },
    breadcrumbText: { fontFamily: font.medium, color: t.text, fontSize: 14 },
    breadcrumbChange: { color: SKY, fontSize: 13, fontFamily: font.semibold, marginLeft: 'auto' },
    breadcrumbSep: {
      width: 1,
      height: 16,
      backgroundColor: t.border,
      marginHorizontal: 2,
    },

    // ── Station Selection Timeline ──
    stationCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      paddingVertical: 8,
      paddingRight: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
    },
    connector: {
      width: 48,
      alignItems: 'center',
      alignSelf: 'stretch',
      position: 'relative',
    },
    lineSegTop: {
      position: 'absolute',
      top: 0,
      width: 4,
      height: '50%',
      borderRadius: 2,
    },
    lineSegBottom: {
      position: 'absolute',
      bottom: 0,
      width: 4,
      height: '50%',
      borderRadius: 2,
    },
    terminalDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    terminalInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.white,
    },
    stationDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      backgroundColor: t.card,
      zIndex: 1,
    },
    stationInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    stationName: { fontFamily: font.medium, fontSize: 15, color: t.text },
    stationNameBold: { fontFamily: font.bold, fontSize: 16 },
    stationHint: { fontSize: 11, fontFamily: font.regular, color: t.textTertiary, marginTop: 1 },

    // ── Report Type Cards ──
    typeGrid: { gap: 10, marginBottom: 24 },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.border,
      backgroundColor: t.card,
      overflow: 'hidden',
    },
    typeAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    typeIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    typeLabel: { fontFamily: font.semibold, fontSize: 15, color: t.text },
    typeDesc: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Detail Sections ──
    detailSection: { marginBottom: 24 },
    detailLabel: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.text,
      marginBottom: 12,
    },

    // ── Direction Picker ──
    dirRow: { flexDirection: 'row', gap: 10 },
    dirCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.border,
      backgroundColor: t.card,
    },
    dirIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: t.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    dirLabel: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    dirSub: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 },

    // ── Crowd Level Grid ──
    crowdGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    crowdCard: {
      width: '48%' as any,
      flexGrow: 1,
      flexBasis: '46%' as any,
      alignItems: 'center',
      paddingVertical: 18,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.border,
      backgroundColor: t.card,
      position: 'relative',
    },
    crowdIconBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    crowdLabel: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    crowdDesc: { fontSize: 11, fontFamily: font.regular, color: t.textSecondary, marginTop: 2, textAlign: 'center' },
    crowdCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Fare Input ──
    fareCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    fareInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.cardAlt,
      borderRadius: 14,
      paddingRight: 16,
      marginBottom: 14,
    },
    cediBox: {
      width: 48,
      height: 52,
      backgroundColor: '#f59e0b',
      borderTopLeftRadius: 14,
      borderBottomLeftRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cediSign: { color: c.white, fontFamily: font.bold, fontSize: 20 },
    fareInput: {
      flex: 1,
      marginLeft: 14,
      fontSize: 22,
      fontFamily: font.bold,
      color: t.text,
      paddingVertical: 12,
    },
    fareQuickRow: {
      flexDirection: 'row',
      gap: 8,
    },
    fareChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: t.cardAlt,
      alignItems: 'center',
    },
    fareChipText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: isDark ? c.stone300 : c.stone600,
    },

    // ── Delay Input ──
    delayCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    delayInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.cardAlt,
      borderRadius: 14,
      paddingHorizontal: 4,
      marginBottom: 14,
    },
    delayIconBox: {
      width: 44,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    delayInput: {
      flex: 1,
      fontSize: 22,
      fontFamily: font.bold,
      color: t.text,
      paddingVertical: 12,
      marginLeft: 4,
    },
    delayUnit: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.textSecondary,
      marginRight: 16,
    },
    delayQuickRow: { flexDirection: 'row', gap: 8 },
    delayChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: t.cardAlt,
      alignItems: 'center',
    },
    delayChipText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: isDark ? c.stone300 : c.stone600,
    },

    // ── Submit Button ──
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
      elevation: 0,
    },
    submitText: { color: c.white, fontFamily: font.bold, fontSize: 16 },
  })
}
