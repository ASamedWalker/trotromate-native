import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@/lib/i18n'
import { brand, font } from '@/lib/theme'

interface LanguageSheetProps {
  visible: boolean
  onClose: () => void
}

export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { lang, setLanguage, languages } = useLanguage()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close language picker"
        >
          <View style={styles.backdrop} />
        </Pressable>
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>App language</Text>
          <Text style={styles.sub}>Menus and buttons change. Stop names stay the same.</Text>
          <View style={styles.list}>
            {languages.map((l) => {
              const selected = l.code === lang
              return (
                <TouchableOpacity
                  key={l.code}
                  activeOpacity={0.6}
                  style={styles.row}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={l.label === l.native ? l.native : `${l.native}, ${l.label}`}
                  onPress={() => {
                    setLanguage(l.code)
                    onClose()
                  }}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.native}>{l.native}</Text>
                    {l.label !== l.native ? <Text style={styles.label}>{l.label}</Text> : null}
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.45)' },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E7E5E4',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: font.bold, color: '#111111' },
  sub: { fontSize: 14, fontFamily: font.regular, color: '#6B7280', marginTop: 4, marginBottom: 8 },
  list: { marginTop: 4 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { flex: 1 },
  native: { fontSize: 17, fontFamily: font.semibold, color: '#111111' },
  label: { fontSize: 13, fontFamily: font.regular, color: '#6B7280' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D6D3D1',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: { borderWidth: 7, borderColor: brand.orange },
})
