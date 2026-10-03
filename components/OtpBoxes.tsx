import { forwardRef } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { font } from '@/lib/theme'

const BRAND = '#FF4D1C'

/**
 * Six code boxes backed by ONE hidden input (auth/verify, register/verify).
 *
 * The old six separate TextInputs moved focus box to box: fast typing landed
 * keys in a box before focus moved and digits were lost, and iOS SMS autofill
 * (all 6 digits at once into one maxLength-1 box) kept only the last digit.
 * One input holds the whole code, so focus never moves and autofill/paste
 * just work. The boxes only display it; tapping them focuses the input.
 */
export const OtpBoxes = forwardRef<TextInput, {
  value: string
  onChange: (code: string) => void
  length?: number
  autoFocus?: boolean
  /** false while the code is being verified */
  editable?: boolean
}>(function OtpBoxes({ value, onChange, length = 6, autoFocus, editable = true }, ref) {
  const focusInput = () => {
    if (ref && typeof ref === 'object') ref.current?.focus()
  }
  return (
    <Pressable onPress={focusInput} accessible={false} style={s.row}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? ''
        const active = i === Math.min(value.length, length - 1)
        return (
          <View
            key={i}
            style={[s.cell, digit ? s.cellFilled : active ? s.cellActive : null]}
            // the input below is the one accessible element (announces the code)
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Text style={s.digit}>{digit}</Text>
          </View>
        )
      })}
      <TextInput
        ref={ref}
        value={value}
        // no maxLength: an autofill/paste like "123 456" must reach the
        // digit filter whole before it's cut to length
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        editable={editable}
        autoFocus={autoFocus}
        selectionColor="transparent"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        caretHidden
        style={s.hiddenInput}
        accessibilityLabel={`Verification code, ${length} digits`}
      />
    </Pressable>
  )
})

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 32 },
  cell: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  cellFilled: { borderColor: BRAND, backgroundColor: '#FFF8F5' },
  cellActive: { borderColor: '#0A0A0A' },
  digit: { fontSize: 24, fontFamily: font.bold, color: '#0A0A0A' },
  // Covers the boxes so taps reach it; invisible but still focusable (opacity 0
  // inputs can't receive iOS autofill on some versions, so 0.011).
  hiddenInput: { position: 'absolute', top: 0, bottom: 0, left: 24, right: 24, opacity: 0.011, color: 'transparent' },
})
