import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  useColorScheme,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ArrowLeft,
  Truck,
  Users,
  Banknote,
  TrendingUp,
  Plus,
  MapPin,
  Navigation,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import {
  getDriverProfile,
  registerDriver,
  getDriverTrips,
  logTrip,
  type DriverProfile,
  type DriverTrip,
  type DriverStats,
} from '@/lib/services/driver'

const POPULAR_STATIONS = [
  'Circle', 'Madina', 'Tema', 'Kaneshie', 'Lapaz', 'Achimota',
]

export default function DriverDashboardScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)
  const { deviceId } = useApp()

  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [stats, setStats] = useState<DriverStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  // Registration
  const [showRegister, setShowRegister] = useState(false)
  const [regName, setRegName] = useState('')
  const [regRole, setRegRole] = useState<'driver' | 'mate'>('driver')
  const [regVehicle, setRegVehicle] = useState('')
  const [registering, setRegistering] = useState(false)

  // Log trip
  const [showLogTrip, setShowLogTrip] = useState(false)
  const [tripFrom, setTripFrom] = useState('')
  const [tripTo, setTripTo] = useState('')
  const [tripPassengers, setTripPassengers] = useState('')
  const [tripFare, setTripFare] = useState('')
  const [loggingTrip, setLoggingTrip] = useState(false)

  const fetchTrips = useCallback(async () => {
    if (!deviceId) return
    const result = await getDriverTrips(deviceId, period)
    setTrips(result.trips)
    setStats(result.stats)
  }, [deviceId, period])

  useEffect(() => {
    if (!deviceId) return
    async function init() {
      setLoading(true)
      const p = await getDriverProfile(deviceId!)
      if (p) {
        setProfile(p)
        await getDriverTrips(deviceId!, period).then((r) => {
          setTrips(r.trips)
          setStats(r.stats)
        })
      } else {
        setShowRegister(true)
      }
      setLoading(false)
    }
    init()
  }, [deviceId, period])

  async function handleRegister() {
    if (!deviceId || !regName.trim()) return
    setRegistering(true)
    const p = await registerDriver(deviceId, regName.trim(), regRole, regVehicle || undefined)
    if (p) {
      setProfile(p)
      setShowRegister(false)
    }
    setRegistering(false)
  }

  async function handleLogTrip() {
    if (!deviceId || !tripFrom.trim() || !tripTo.trim()) return
    setLoggingTrip(true)
    await logTrip(
      deviceId,
      tripFrom.trim(),
      tripTo.trim(),
      parseInt(tripPassengers) || 0,
      parseFloat(tripFare) || 0
    )
    setShowLogTrip(false)
    setTripFrom('')
    setTripTo('')
    setTripPassengers('')
    setTripFare('')
    setLoggingTrip(false)
    fetchTrips()
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingState}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <ArrowLeft size={18} color={t.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Driver Dashboard</Text>
          {profile && (
            <Text style={s.headerSub}>
              {profile.display_name} · {profile.role === 'mate' ? 'Mate' : 'Driver'}
            </Text>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Registration */}
        {showRegister && !profile && (
          <View style={s.regCard}>
            <View style={s.regHeader}>
              <View style={s.regIcon}>
                <Truck size={24} color={c.amber500} />
              </View>
              <View>
                <Text style={s.regTitle}>Join as Driver/Mate</Text>
                <Text style={s.regSub}>Track your trips and earnings</Text>
              </View>
            </View>

            <TextInput
              placeholder="Your name"
              placeholderTextColor={t.textSecondary}
              value={regName}
              onChangeText={setRegName}
              style={s.input}
            />

            <View style={s.roleRow}>
              {(['driver', 'mate'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRegRole(r)}
                  activeOpacity={0.7}
                  style={[s.roleBtn, regRole === r && s.roleBtnActive]}
                >
                  <Text style={[s.roleBtnText, regRole === r && s.roleBtnTextActive]}>
                    {r === 'driver' ? 'Driver' : 'Mate'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Vehicle number (optional)"
              placeholderTextColor={t.textSecondary}
              value={regVehicle}
              onChangeText={setRegVehicle}
              style={s.input}
            />

            <TouchableOpacity
              onPress={handleRegister}
              disabled={!regName.trim() || registering}
              activeOpacity={0.8}
              style={[s.primaryBtn, !regName.trim() && s.primaryBtnDisabled]}
            >
              <Text style={s.primaryBtnText}>
                {registering ? 'Registering...' : 'Get Started'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard */}
        {profile && (
          <>
            {/* Period Tabs */}
            <View style={s.periodTabs}>
              {(['today', 'week', 'month'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.7}
                  style={[s.periodTab, period === p && s.periodTabActive]}
                >
                  <Text style={[s.periodTabText, period === p && s.periodTabTextActive]}>
                    {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats Grid */}
            <View style={s.statsGrid}>
              <View style={[s.statCard, s.statCardAmber]}>
                <View style={s.statHeader}>
                  <Truck size={14} color={c.amber500} />
                  <Text style={s.statLabel}>Trips</Text>
                </View>
                <Text style={s.statValue}>{stats?.total_trips ?? 0}</Text>
              </View>
              <View style={[s.statCard, s.statCardGreen]}>
                <View style={s.statHeader}>
                  <Banknote size={14} color="#22c55e" />
                  <Text style={s.statLabel}>Earnings</Text>
                </View>
                <Text style={s.statValue}>₵{(stats?.total_earnings ?? 0).toFixed(2)}</Text>
              </View>
              <View style={[s.statCard, s.statCardDefault]}>
                <View style={s.statHeader}>
                  <Users size={14} color="#0ea5e9" />
                  <Text style={s.statLabel}>Passengers</Text>
                </View>
                <Text style={s.statValue}>{stats?.total_passengers ?? 0}</Text>
              </View>
              <View style={[s.statCard, s.statCardDefault]}>
                <View style={s.statHeader}>
                  <TrendingUp size={14} color="#8b5cf6" />
                  <Text style={s.statLabel}>Avg Fare</Text>
                </View>
                <Text style={s.statValue}>₵{(stats?.avg_fare ?? 0).toFixed(2)}</Text>
              </View>
            </View>

            {/* Log Trip Button */}
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setShowLogTrip(true)}
                activeOpacity={0.8}
                style={s.logTripBtn}
              >
                <Plus size={18} color="#fff" />
                <Text style={s.logTripBtnText}>Log a Trip</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Trips */}
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={s.sectionTitle}>Recent Trips</Text>
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <View key={trip.id} style={s.tripCard}>
                    <View style={s.tripIcon}>
                      <Navigation size={14} color={c.amber500} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.tripRoute} numberOfLines={1}>
                        {trip.from_location} → {trip.to_location}
                      </Text>
                      <Text style={s.tripMeta}>
                        {trip.passengers} pax · {new Date(trip.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={s.tripFare}>₵{trip.fare_collected.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <View style={s.emptyState}>
                  <View style={s.emptyIcon}>
                    <Truck size={24} color={t.textSecondary} />
                  </View>
                  <Text style={s.emptyTitle}>No trips yet</Text>
                  <Text style={s.emptySub}>Log your first trip to start tracking</Text>
                </View>
              )}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* Log Trip Modal */}
      <Modal visible={showLogTrip} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Log a Trip</Text>

            <View style={s.modalInputRow}>
              <MapPin size={14} color={c.amber500} />
              <TextInput
                placeholder="From where?"
                placeholderTextColor={t.textSecondary}
                value={tripFrom}
                onChangeText={setTripFrom}
                style={s.modalInput}
              />
            </View>
            <View style={s.modalInputRow}>
              <Navigation size={14} color="#22c55e" />
              <TextInput
                placeholder="To where?"
                placeholderTextColor={t.textSecondary}
                value={tripTo}
                onChangeText={setTripTo}
                style={s.modalInput}
              />
            </View>

            {/* Quick station picks */}
            <View style={s.stationChips}>
              {POPULAR_STATIONS.map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => !tripFrom ? setTripFrom(st) : setTripTo(st)}
                  activeOpacity={0.7}
                  style={s.stationChip}
                >
                  <Text style={s.stationChipText}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Passengers</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={t.textSecondary}
                  value={tripPassengers}
                  onChangeText={setTripPassengers}
                  keyboardType="numeric"
                  style={s.fieldInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Fare (₵)</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={t.textSecondary}
                  value={tripFare}
                  onChangeText={setTripFare}
                  keyboardType="decimal-pad"
                  style={s.fieldInput}
                />
              </View>
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity
                onPress={() => setShowLogTrip(false)}
                style={s.cancelBtn}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLogTrip}
                disabled={!tripFrom.trim() || !tripTo.trim() || loggingTrip}
                activeOpacity={0.8}
                style={[s.confirmBtn, (!tripFrom.trim() || !tripTo.trim()) && { opacity: 0.5 }]}
              >
                <Text style={s.confirmText}>{loggingTrip ? 'Logging...' : 'Log Trip'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? c.stone800 : c.stone100, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontFamily: font.bold, color: t.text },
    headerSub: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },

    // Registration
    regCard: { marginHorizontal: 20, padding: 24, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
    regHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    regIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)', alignItems: 'center', justifyContent: 'center' },
    regTitle: { fontSize: 18, fontFamily: font.bold, color: t.text },
    regSub: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },
    input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, fontSize: 14, fontFamily: font.medium, color: t.text, marginBottom: 12 },
    roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, alignItems: 'center' },
    roleBtnActive: { backgroundColor: c.amber500 },
    roleBtnText: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    roleBtnTextActive: { color: '#fff' },
    primaryBtn: { paddingVertical: 12, borderRadius: 12, backgroundColor: c.amber500, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { fontSize: 14, fontFamily: font.semibold, color: '#fff' },

    // Period tabs
    periodTabs: { flexDirection: 'row', gap: 4, marginHorizontal: 20, padding: 4, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, marginBottom: 16 },
    periodTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    periodTabActive: { backgroundColor: isDark ? '#44403c' : '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    periodTabText: { fontSize: 12, fontFamily: font.semibold, color: t.textSecondary },
    periodTabTextActive: { color: t.text },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
    statCard: { width: '47%', padding: 16, borderRadius: 16, borderWidth: 1 },
    statCardAmber: { backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)', borderColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' },
    statCardGreen: { backgroundColor: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)', borderColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' },
    statCardDefault: { backgroundColor: t.card, borderColor: t.border },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    statLabel: { fontSize: 11, fontFamily: font.medium, color: t.textSecondary },
    statValue: { fontSize: 22, fontFamily: font.bold, color: t.text },

    // Log trip button
    logTripBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: c.amber500 },
    logTripBtnText: { fontSize: 14, fontFamily: font.semibold, color: '#fff' },

    // Trips list
    sectionTitle: { fontSize: 16, fontFamily: font.bold, color: t.text, marginBottom: 12 },
    tripCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, marginBottom: 8 },
    tripIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    tripRoute: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    tripMeta: { fontSize: 11, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 },
    tripFare: { fontSize: 14, fontFamily: font.bold, color: '#22c55e', marginLeft: 8 },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? c.stone800 : c.stone100, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    emptyTitle: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    emptySub: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 4 },

    // Modal
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modal: { backgroundColor: t.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontFamily: font.bold, color: t.text, marginBottom: 16 },
    modalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, marginBottom: 8 },
    modalInput: { flex: 1, fontSize: 14, fontFamily: font.medium, color: t.text, padding: 0 },
    stationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    stationChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: isDark ? c.stone800 : c.stone100, borderWidth: 1, borderColor: t.border },
    stationChipText: { fontSize: 11, fontFamily: font.medium, color: t.text },
    fieldLabel: { fontSize: 11, fontFamily: font.medium, color: t.textSecondary, marginBottom: 4 },
    fieldInput: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, fontSize: 14, fontFamily: font.medium, color: t.text },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? c.stone800 : c.stone100, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: font.semibold, color: t.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: c.amber500, alignItems: 'center' },
    confirmText: { fontSize: 14, fontFamily: font.semibold, color: '#fff' },
  })
}
