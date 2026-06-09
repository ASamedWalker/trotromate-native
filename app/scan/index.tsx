import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

/* Corner-bracket scan frame. Live camera is added when expo-camera lands —
   for now this is the framing placeholder. */
function ScanFrame() {
  return (
    <View style={styles.scanArea}>
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
      <View style={styles.scanInner} />
    </View>
  )
}

export default function ScanPayScreen() {
  const router = useRouter()
  const [manual, setManual] = useState(false)
  const [busCode, setBusCode] = useState('')
  const canContinue = busCode.trim().length >= 3

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}><ArrowLeft size={22} color="#111" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Pay with QR</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab */}
      <View style={styles.tab}><Text style={styles.tabText}>Scan QR Code</Text></View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 30, alignItems: 'center' }}>
          <ScanFrame />
          <Text style={styles.hint}>Use your device camera to scan QR code on Troski&apos;s buses to make your payment</Text>
          {!manual && <Text style={styles.orManually}>OR Manually</Text>}
        </View>

        {/* Bottom action (lifts above keyboard) */}
        <View style={styles.bottom}>
          {!manual ? (
            <TouchableOpacity style={styles.btn} activeOpacity={0.9} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setManual(true) }}>
              <Text style={styles.btnText}>Input Bus Code</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.codeCard}>
                <Text style={styles.label}>Bus Code</Text>
                <TextInput
                  value={busCode}
                  onChangeText={(t) => setBusCode(t.toUpperCase())}
                  placeholder="e.g. TRSK 235"
                  placeholderTextColor="#C4C4C4"
                  autoCapitalize="characters"
                  autoFocus
                  style={styles.input}
                />
              </View>
              <TouchableOpacity
                style={[styles.btn, !canContinue && { opacity: 0.5 }]}
                activeOpacity={0.9}
                disabled={!canContinue}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: '/scan/confirm', params: { code: busCode.trim() } } as never) }}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const FRAME = 240

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 18, color: '#111' },

  tab: { backgroundColor: BRAND, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontFamily: font.bold, fontSize: 14, color: '#fff' },

  scanArea: { width: FRAME, height: FRAME, justifyContent: 'center', alignItems: 'center' },
  scanInner: { width: FRAME - 36, height: FRAME - 36, borderRadius: 20, backgroundColor: '#F3F4F6' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: '#111' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },

  hint: { fontFamily: font.regular, fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19, marginTop: 24, paddingHorizontal: 20 },
  orManually: { fontFamily: font.bold, fontSize: 14, color: '#374151', marginTop: 26 },

  codeCard: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F1F1F0' },
  label: { fontFamily: font.bold, fontSize: 14, color: '#111', marginBottom: 10 },
  input: { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA', paddingHorizontal: 14, fontFamily: font.semibold, fontSize: 16, color: '#111' },

  bottom: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28 },
  btn: { height: 54, borderRadius: 14, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
