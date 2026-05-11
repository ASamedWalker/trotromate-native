import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  useColorScheme,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, MapPin, Plus, CircleDot, Home, Briefcase, Locate } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useLocation } from '@/lib/hooks/useLocation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export default function TripScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const { user: authUser } = useAuthContext()
  const { location } = useLocation()
  const params = useLocalSearchParams<{ from?: string; to?: string }>()
  const [locationName, setLocationName] = useState('Fetching location...')
  const stopsSheetRef = useRef<BottomSheet>(null)

  React.useEffect(() => {
    if (!location) return
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?types=place,locality&limit=1&access_token=pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg`)
      .then(r => r.json())
      .then(data => {
        if (data.features?.[0]) setLocationName(data.features[0].place_name?.split(',').slice(0, 2).join(',') || data.features[0].text)
      })
      .catch(() => setLocationName('Accra, GH'))
  }, [location?.latitude])

  const [pickup, setPickup] = useState(params.from || '')
  const [dropoff, setDropoff] = useState(params.to || '')
  const [activeInput, setActiveInput] = useState<'pickup' | 'dropoff' | null>(params.from ? 'dropoff' : 'pickup')

  const [stop1, setStop1] = useState('')
  const [stop2, setStop2] = useState('')

  // Saved addresses
  const [homeAddress, setHomeAddress] = useState('')
  const [workAddress, setWorkAddress] = useState('')
  const [addressModal, setAddressModal] = useState<'home' | 'work' | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<{ text: string; place_name: string }[]>([])

  const goToConfirm = (p: string, d: string) => {
    router.push({ pathname: '/booking/confirm', params: { pickup: p, dropoff: d } } as any)
  }

  // If both params from deep link, auto-navigate
  const navigatedRef = useRef(false)
  React.useEffect(() => {
    if (params.from && params.to && !navigatedRef.current) {
      navigatedRef.current = true
      setTimeout(() => goToConfirm(params.from!, params.to!), 500)
    }
  }, [params.from, params.to])

  // Load saved addresses on mount
  React.useEffect(() => {
    if (!authUser?.id) return
    fetch(`${API_URL}/api/addresses?auth_user_id=${authUser.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.addresses) {
          data.addresses.forEach((a: any) => {
            if (a.label === 'Home') setHomeAddress(a.address)
            if (a.label === 'Work') setWorkAddress(a.address)
          })
        }
      })
      .catch(() => {})
  }, [authUser?.id])

  // Mapbox geocoding autocomplete (shared for address modal + route inputs)
  const [routeSuggestions, setRouteSuggestions] = useState<{ text: string; place_name: string }[]>([])

  const searchMapbox = (query: string, setter: (results: { text: string; place_name: string }[]) => void) => {
    if (query.length < 3) { setter([]); return }
    const proximity = location ? `&proximity=${location.longitude},${location.latitude}` : ''
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=us,gh&limit=5&types=address,poi,locality,place,neighborhood${proximity}&access_token=pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg`)
      .then(r => r.json())
      .then(data => {
        if (data.features) setter(data.features.map((f: any) => ({ text: f.text, place_name: f.place_name })))
      })
      .catch(() => {})
  }

  const searchAddress = (query: string) => {
    setAddressInput(query)
    searchMapbox(query, setAddressSuggestions)
  }

  const searchRoute = (query: string) => {
    searchMapbox(query, setRouteSuggestions)
  }

  const bg = isDark ? '#0C0A09' : '#FFFFFF'
  const cardBg = isDark ? '#1C1917' : '#F3F4F6'
  const text = isDark ? '#F9FAFB' : '#111'
  const sub = isDark ? '#78716c' : '#9CA3AF'
  const border = isDark ? '#292524' : '#E5E7EB'
  const green = '#08b64f'

  const openAddStops = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    stopsSheetRef.current?.snapToIndex(0)
  }

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // If stops were added, set dropoff to last stop
    if (stop2) setDropoff(stop2)
    else if (stop1) setDropoff(stop1)
    stopsSheetRef.current?.close()
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <ArrowLeft size={22} color={text} />
          </Pressable>
          <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: text, textAlign: 'center' }}>Your Trip</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Input boxes */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
            {/* Pickup */}
            <Pressable
              onPress={() => setActiveInput('pickup')}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52, backgroundColor: activeInput === 'pickup' ? (isDark ? '#292524' : '#F9FAFB') : 'transparent' }}
            >
              <MapPin size={18} color={green} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: text, padding: 0 }}
                placeholder="Pick your route"
                placeholderTextColor={sub}
                value={pickup}
                onChangeText={(t) => { setPickup(t); setActiveInput('pickup'); searchRoute(t) }}
                onFocus={() => setActiveInput('pickup')}
              />
            </Pressable>

            {/* + button divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: border }} />
              <Pressable
                onPress={openAddStops}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? '#292524' : '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 }}
              >
                <Plus size={14} color={text} strokeWidth={2.5} />
              </Pressable>
              <View style={{ flex: 1, height: 1, backgroundColor: border }} />
            </View>

            {/* Drop off */}
            <Pressable
              onPress={() => setActiveInput('dropoff')}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52, backgroundColor: activeInput === 'dropoff' ? (isDark ? '#292524' : '#F9FAFB') : 'transparent' }}
            >
              <CircleDot size={18} color="#EF4444" style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: text, padding: 0 }}
                placeholder="Drop off route"
                placeholderTextColor={sub}
                value={dropoff}
                onChangeText={(t) => { setDropoff(t); setActiveInput('dropoff'); searchRoute(t) }}
                onFocus={() => setActiveInput('dropoff')}
              />
            </Pressable>
          </View>
        </View>

        {/* Route suggestions */}
        {routeSuggestions.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            {routeSuggestions.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  if (activeInput === 'pickup') {
                    setPickup(s.place_name)
                    setActiveInput('dropoff')
                    setRouteSuggestions([])
                  } else {
                    setDropoff(s.place_name)
                    setRouteSuggestions([])
                    // Both filled — navigate to confirm
                    if (pickup) goToConfirm(pickup, s.place_name)
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <MapPin size={14} color={sub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: text }} numberOfLines={1}>{s.text}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: sub }} numberOfLines={2}>{s.place_name}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Shortcuts */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* Home */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              if (homeAddress) {
                if (activeInput === 'pickup') { setPickup(homeAddress); setActiveInput('dropoff') }
                else if (activeInput === 'dropoff') setDropoff(homeAddress)
                else { setPickup(homeAddress); setActiveInput('dropoff') }
              } else {
                setAddressInput('')
                setAddressModal('home')
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Home size={18} color={text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: text }}>Home</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: sub }}>{homeAddress || 'Add home address'}</Text>
            </View>
          </Pressable>

          <View style={{ height: 1, backgroundColor: border, marginLeft: 48 }} />

          {/* Work */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              if (workAddress) {
                if (activeInput === 'pickup') { setPickup(workAddress); setActiveInput('dropoff') }
                else if (activeInput === 'dropoff') setDropoff(workAddress)
                else { setPickup(workAddress); setActiveInput('dropoff') }
              } else {
                setAddressInput('')
                setAddressModal('work')
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Briefcase size={18} color={text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: text }}>Work</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: sub }}>{workAddress || 'Add work address'}</Text>
            </View>
          </Pressable>

          <View style={{ height: 1, backgroundColor: border, marginLeft: 48 }} />

          {/* Current location */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              const loc = locationName || 'Current location'
              if (activeInput === 'pickup') { setPickup(loc); setActiveInput('dropoff') }
              else if (activeInput === 'dropoff') setDropoff(loc)
              else { setPickup(loc); setActiveInput('dropoff') }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Locate size={18} color={green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: text }}>Current location</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: sub }}>{locationName}</Text>
            </View>
          </Pressable>

          {/* Thick divider */}
          <View style={{ height: 6, backgroundColor: isDark ? '#1C1917' : '#F3F4F6', marginHorizontal: -20, marginVertical: 16 }} />

          {/* Saved places */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: text }}>Saved places</Text>
            <Pressable onPress={() => { setAddressInput(''); setAddressModal('home') }}>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: green }}>+ New Place</Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 15, color: sub, textAlign: 'center', marginTop: 20 }}>No saved places</Text>
        </View>
      </SafeAreaView>

      {/* Address Modal (Home / Work) */}
      <Modal
        visible={addressModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddressModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: bg }}
        >
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20 }}>
              <Pressable onPress={() => setAddressModal(null)} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                <ArrowLeft size={22} color={text} />
              </Pressable>
              <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: text, textAlign: 'center' }}>
                {addressModal === 'home' ? 'Add home' : 'Add work'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Search input */}
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, height: 50, paddingHorizontal: 14, borderRadius: 14, marginBottom: 12 }}>
                <MapPin size={18} color={green} style={{ marginRight: 10 }} />
                <TextInput
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: text, padding: 0 }}
                  placeholder="Search address"
                  placeholderTextColor={sub}
                  value={addressInput}
                  onChangeText={searchAddress}
                  autoFocus
                />
              </View>

              {/* Suggestions */}
              {addressSuggestions.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    const addr = s.place_name
                    const lbl = addressModal === 'home' ? 'Home' : 'Work'
                    if (addressModal === 'home') setHomeAddress(addr)
                    else setWorkAddress(addr)
                    setAddressSuggestions([])
                    setAddressInput('')
                    setAddressModal(null)
                    if (authUser?.id) {
                      fetch(`${API_URL}/api/addresses`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ auth_user_id: authUser.id, label: lbl, address: addr }),
                      }).catch(() => {})
                    }
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <MapPin size={14} color={sub} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: text }}>{s.text}</Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: sub }} numberOfLines={1}>{s.place_name}</Text>
                  </View>
                </Pressable>
              ))}

              {/* Manual save button */}
              {addressInput.trim().length > 0 && addressSuggestions.length === 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    if (addressModal === 'home') setHomeAddress(addressInput.trim())
                    else setWorkAddress(addressInput.trim())
                    setAddressModal(null)
                  }}
                  style={({ pressed }) => [
                    { backgroundColor: green, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Save place</Text>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Stops Bottom Sheet */}
      <BottomSheet
        ref={stopsSheetRef}
        index={-1}
        snapPoints={['55%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#D1D5DB', width: 48, height: 5, borderRadius: 3 }}
        onClose={() => {}}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
          {/* Title */}
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: text, textAlign: 'center', marginBottom: 20 }}>Add stops</Text>

          {/* 3 connected inputs */}
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: border, overflow: 'hidden', marginBottom: 20 }}>
            {/* Pickup */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, borderBottomWidth: 1, borderBottomColor: border }}>
              <MapPin size={16} color={green} style={{ marginRight: 10 }} />
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: pickup ? text : sub }}>{pickup || 'Current location'}</Text>
            </View>

            {/* Stop 1 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, borderBottomWidth: 1, borderBottomColor: border }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? '#292524' : '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: text }}>1</Text>
              </View>
              <TextInput
                style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: text, padding: 0 }}
                placeholder="Add stop"
                placeholderTextColor={sub}
                value={stop1}
                onChangeText={setStop1}
              />
            </View>

            {/* Stop 2 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? '#292524' : '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: text }}>2</Text>
              </View>
              <TextInput
                style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: text, padding: 0 }}
                placeholder="Add stop"
                placeholderTextColor={sub}
                value={stop2}
                onChangeText={setStop2}
              />
            </View>
          </View>

          {/* Done button */}
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [
              { backgroundColor: green, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Done</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </View>
  )
}
