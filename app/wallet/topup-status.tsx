import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect, type Href } from 'expo-router'
import { X, Smartphone, Clock, ChevronDown, ChevronUp, CheckCircle2, XCircle, Check, Info, MessageCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { HeroText } from '@/components/HeroText'
import { Button } from '@/components/ui'
import { ui, space, radius, type, font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { SUPPORT_WHATSAPP } from '@/lib/config/support'
import {
  fetchTopupStatus, NO_PROMPT_HELP, NETWORK_NAME, shortGHS, maskPhone, formatElapsed,
} from '@/lib/services/topup'

// Amber = "waiting". Never green until the provider confirms the credit (TU1).
const WAIT = '#B45309'
const WAIT_SOFT = '#FFFBEB'
const GIVE_UP_MS = 60 * 60_000
const SLOW_AFTER_MS = 3 * 60 * 1000
const POLL_MS = 5000
const POLL_SLOW_MS = 20000

type Phase =
  | { kind: 'pending' }
  | { kind: 'credited'; amount: number; newBalance: number | null; at: Date }
  | { kind: 'failed'; confirmedByPaystack: boolean }

/**
 * The top-up after the MoMo prompt is sent: pending (approve on your phone) →
 * credited (only once the server reports status success) or failed.
 * Opened from the MoMo form (replace) and from the Wallet tab's pending strip.
 */
export default function TopUpStatusScreen() {
  const router = useRouter()
  const { user } = useAuthContext()
  const params = useLocalSearchParams<{
    reference?: string; amount?: string; phone?: string; provider?: string; startedAt?: string; return?: string; pops?: string
  }>()
  const reference = params.reference ?? ''
  const amount = Number(params.amount) || 0
  const provider = params.provider ?? ''
  const network = NETWORK_NAME[provider] ?? 'MoMo'
  const returnTo = params.return
  const startedAtRef = useRef<number>(0)
  if (!startedAtRef.current) {
    const t = params.startedAt ? new Date(params.startedAt).getTime() : NaN
    startedAtRef.current = isFinite(t) ? Math.min(t, Date.now()) : Date.now()
  }

  const [phase, setPhase] = useState<Phase>({ kind: 'pending' })
  const [now, setNow] = useState(Date.now())
  const [helpOpen, setHelpOpen] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const elapsed = now - startedAtRef.current
  const slow = elapsed >= SLOW_AFTER_MS

  // Real elapsed timer (no fake progress) while pending.
  useEffect(() => {
    if (phase.kind !== 'pending') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase.kind])

  // Poll the top-up status while this screen is focused and still pending:
  // every 5s, every 20s after 3 min. One request at a time (the next tick is
  // scheduled only after the previous one settles); stops on blur/unmount.
  const phaseRef = useRef(phase.kind)
  phaseRef.current = phase.kind
  useFocusEffect(useCallback(() => {
    if (!user?.id || !reference || phaseRef.current !== 'pending') return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (stopped) return
      try {
        const st = await fetchTopupStatus(user.id, reference)
        if (stopped) return
        if (st.state === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setPhase({ kind: 'credited', amount: st.amount ?? amount, newBalance: st.newBalance, at: new Date() })
          return
        }
        if (st.state === 'failed') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          // status 'failed' is only set from Paystack (webhook charge.failed, verify, or a rejected charge).
          setPhase({ kind: 'failed', confirmedByPaystack: true })
          return
        }
      } catch { /* network blip: try again next tick */ }
      if (stopped) return
      // Give up after an hour (pending top-ups older than that leave the Wallet strip too).
      if (Date.now() - startedAtRef.current >= GIVE_UP_MS) { setGaveUp(true); return }
      const late = Date.now() - startedAtRef.current >= SLOW_AFTER_MS
      timer = setTimeout(tick, late ? POLL_SLOW_MS : POLL_MS)
    }
    tick()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [user?.id, reference]))

  // Check-mark pop on credit (core Animated, native driver).
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (phase.kind === 'credited') {
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start()
    }
  }, [phase.kind, pop])

  const goWallet = () => {
    if (router.canDismiss()) router.dismissAll()
    router.navigate('/wallet' as Href)
  }
  // Back to checkout: `pops` screens sit between it and here (fund → momo-replaced-by-this = 2;
  // opened straight from checkout's waiting row = 1).
  const pops = Math.max(1, Math.min(3, Number(params.pops) || 2))
  const goCheckout = () => {
    if (router.canDismiss()) router.dismiss(pops)
    else goWallet()
  }
  const leave = () => (returnTo === 'checkout' ? goCheckout() : goWallet())
  const retry = () => {
    router.replace({
      pathname: '/wallet/momo',
      params: { provider, amount: String(amount), ...(returnTo ? { return: returnTo, pops: String(pops) } : {}) },
    } as never)
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.iconBtn} />
        <Text style={s.headerTitle}>Top up</Text>
        <TouchableOpacity onPress={leave} hitSlop={8} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Close">
          <X size={24} color={ui.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {phase.kind === 'pending' && (
          <>
            <View style={[s.bigIcon, { backgroundColor: WAIT_SOFT }]}>
              <Smartphone size={34} color={WAIT} />
            </View>
            <HeroText size={26} style={s.title} accessibilityRole="header">
              Approve {shortGHS(amount)} on your phone
            </HeroText>
            <Text style={s.body}>
              We sent a prompt to {params.phone ? maskPhone(params.phone) : 'your MoMo number'} ({network}). Enter your MoMo PIN there.
              Your balance updates when {network} confirms. Usually under a minute.
            </Text>

            <View style={s.waitPill} accessibilityLiveRegion="polite">
              <Clock size={16} color={WAIT} />
              <Text style={s.waitText}>Waiting for {network}… {formatElapsed(elapsed)}</Text>
            </View>
            {slow && (
              <Text style={s.slowText}>{gaveUp
                ? "We couldn't confirm this top-up yet. Check your wallet history later, or contact support with the reference below."
                : "Still waiting. MoMo can be slow. We'll update your wallet when it lands."}</Text>
            )}

            <TouchableOpacity
              onPress={() => setHelpOpen((o) => !o)}
              style={s.helpHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: helpOpen }}
            >
              <Text style={s.helpTitle}>No prompt?</Text>
              {helpOpen ? <ChevronUp size={18} color={ui.textSecondary} /> : <ChevronDown size={18} color={ui.textSecondary} />}
            </TouchableOpacity>
            {helpOpen && <Text style={s.helpBody}>{NO_PROMPT_HELP}</Text>}
          </>
        )}

        {phase.kind === 'credited' && (
          <>
            <Animated.View style={[s.bigIcon, { backgroundColor: ui.successSoft, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: pop }]}>
              <CheckCircle2 size={40} color={ui.success} />
            </Animated.View>
            <HeroText size={36} style={[s.title, { color: ui.success }]} accessibilityRole="header">
              +GH₵{(phase.kind === 'credited' ? phase.amount : amount).toFixed(2)}
            </HeroText>
            <Text style={s.lead}>Added to your wallet</Text>
            {phase.newBalance != null && (
              <Text style={s.body}>New balance {formatGHS(phase.newBalance)}</Text>
            )}
            <Text style={s.ref} selectable>
              Ref {reference} · {phase.at.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </>
        )}

        {phase.kind === 'failed' && (
          <>
            <View style={[s.bigIcon, { backgroundColor: ui.dangerSoft }]}>
              <XCircle size={38} color={ui.danger} />
            </View>
            <HeroText size={26} style={s.title} accessibilityRole="header">{"Top-up didn't go through"}</HeroText>
            <Text style={s.body}>
              {`${network} didn't complete it. The prompt may have been declined or timed out, the PIN may have been wrong, or there wasn't enough MoMo balance.`}
            </Text>
            <View style={s.moneyBox}>
              {phase.confirmedByPaystack ? (
                <>
                  <View style={s.moneyRow}>
                    <Check size={16} color={ui.text} />
                    <Text style={s.moneyText}>No money left your MoMo.</Text>
                  </View>
                  <Text style={s.ref} selectable>Confirmed by Paystack · ref {reference}</Text>
                </>
              ) : (
                <View style={s.moneyRow}>
                  <Info size={16} color={ui.text} />
                  <Text style={s.moneyText} selectable>If money left, it will be returned. Ref {reference}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {phase.kind === 'pending' && (
          <>
            <Button label="Done, I've approved" onPress={leave} />
            <Button label="Cancel and try again" variant="ghost" onPress={retry} />
          </>
        )}
        {phase.kind === 'credited' && (
          returnTo === 'checkout' ? (
            <>
              <Button label="Back to booking" onPress={goCheckout} />
              <Button label="Done" variant="ghost" onPress={goWallet} />
            </>
          ) : (
            <Button label="Done" onPress={goWallet} />
          )
        )}
        {phase.kind === 'failed' && (
          <>
            <Button label="Try again" onPress={retry} />
            {SUPPORT_WHATSAPP ? (
              <>
                <Button
                  label="Get help on WhatsApp"
                  icon={MessageCircle}
                  variant="outline"
                  onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Top-up help, ref ${reference}`)}`).catch(() => {})}
                />
                <Text style={s.helpNumber} selectable>WhatsApp +{SUPPORT_WHATSAPP}</Text>
              </>
            ) : null}
            <Button label="Done" variant="ghost" onPress={leave} />
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.headline, fontFamily: font.bold, color: ui.text },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xl, alignItems: 'center' },

  bigIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  title: { color: ui.text, textAlign: 'center', letterSpacing: -0.4 },
  lead: { ...type.headline, color: ui.text, textAlign: 'center', marginTop: space.xs },
  body: { ...type.body, color: ui.textSecondary, textAlign: 'center', marginTop: space.sm },

  waitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xl,
    backgroundColor: WAIT_SOFT, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  waitText: { ...type.labelStrong, color: WAIT, fontVariant: ['tabular-nums'] },
  slowText: { ...type.label, color: WAIT, textAlign: 'center', marginTop: space.md },

  helpHead: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: space.xl,
  },
  helpTitle: { ...type.labelStrong, color: ui.text },
  helpBody: { ...type.label, color: ui.textSecondary, textAlign: 'center' },

  moneyBox: {
    alignSelf: 'stretch', marginTop: space.xl, padding: space.lg, gap: 6,
    backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1, borderColor: ui.hairline,
  },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  moneyText: { ...type.bodyMedium, fontFamily: font.semibold, color: ui.text, flexShrink: 1 },
  ref: { ...type.caption, color: ui.textSecondary, textAlign: 'center', marginTop: space.md },
  helpNumber: { ...type.caption, color: ui.textSecondary, textAlign: 'center' },

  footer: { paddingHorizontal: space.gutter, paddingBottom: space.lg, paddingTop: space.sm, gap: space.sm },
})
