import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  useColorScheme,
  StyleSheet,
  Platform,
} from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { AlertTriangle, Shield } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { getEmergencyContact, saveEmergencyContact } from '@/lib/services/safety'

export function SOSButton({ from, to }: { from?: string; to?: string }) {
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)
  const { deviceId } = useApp()

  const [contact, setContact] = useState<{ contact_name: string; contact_phone: string } | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['1%'], [])

  useEffect(() => {
    if (!deviceId) return
    getEmergencyContact(deviceId).then((c) => {
      if (c) setContact(c)
    })
  }, [deviceId])

  // Open/close sheet based on showSetup state
  useEffect(() => {
    if (showSetup) {
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
    }
  }, [showSetup])

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1 && showSetup) setShowSetup(false)
  }, [showSetup])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )

  async function handleSave() {
    if (!deviceId || !name.trim() || !phone.trim()) return
    setSaving(true)
    const saved = await saveEmergencyContact(deviceId, name.trim(), phone.trim())
    if (saved) {
      setContact(saved)
      setShowSetup(false)
    }
    setSaving(false)
  }

  function handleSOS() {
    if (!contact) {
      setShowSetup(true)
      return
    }

    const message = from && to
      ? `SOS! I need help. I'm on a trotro from ${from} to ${to}. Please check on me.`
      : `SOS! I need help. I'm on a trotro and need assistance. Please check on me.`

    const phoneClean = contact.contact_phone.replace(/\D/g, '')
    Linking.openURL(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`)
  }

  return (
    <>
      <TouchableOpacity onPress={handleSOS} activeOpacity={0.7} style={s.button}>
        <AlertTriangle size={16} color="#ef4444" />
        <Text style={s.buttonText}>SOS</Text>
      </TouchableOpacity>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={s.handle}
        backgroundStyle={s.sheet}
        style={s.sheetShadow}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={s.sheetContent}>
          <View style={s.modalHeader}>
            <View style={s.modalIcon}>
              <Shield size={20} color="#ef4444" />
            </View>
            <View>
              <Text style={s.modalTitle}>Emergency Contact</Text>
              <Text style={s.modalSub}>Set up your SOS contact</Text>
            </View>
          </View>

          <BottomSheetTextInput
            placeholder="Contact name"
            placeholderTextColor={t.textSecondary}
            value={name}
            onChangeText={setName}
            style={s.input}
          />
          <BottomSheetTextInput
            placeholder="Phone number (e.g. +233...)"
            placeholderTextColor={t.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={s.input}
          />

          <View style={s.modalActions}>
            <TouchableOpacity onPress={() => setShowSetup(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!name.trim() || !phone.trim() || saving}
              style={[s.saveBtn, (!name.trim() || !phone.trim()) && s.saveBtnDisabled]}
            >
              <Text style={s.saveText}>{saving ? 'Saving...' : 'Save Contact'}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  const outlineVariant = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'

  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
    },
    buttonText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: '#ef4444',
    },

    /* ── Bottom Sheet ── */
    sheet: {
      backgroundColor: isDark ? 'rgba(12,10,9,0.97)' : 'rgba(252,245,242,0.97)',
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
    },
    sheetShadow: {
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 40,
      elevation: 20,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: outlineVariant,
    },
    sheetContent: {
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    modalIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: { fontSize: 16, fontFamily: font.bold, color: t.text },
    modalSub: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary },

    input: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
      marginBottom: 12,
    },

    modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontFamily: font.semibold, color: t.textSecondary },
    saveBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#ef4444',
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { fontSize: 14, fontFamily: font.semibold, color: '#fff' },
  })
}
