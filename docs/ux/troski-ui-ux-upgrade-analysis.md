# Troski — UI/UX Upgrade Analysis

**Date:** 2026-07-07 · **Author:** Fable (UX judgment) on 3 read-only code-audit passes covering every consumer surface
**Labels:** `[code]` code observation (file:line) · `[inf]` inference · `[hyp]` hypothesis — no runtime/device testing performed; all findings are static-code-based unless noted.
**Scope:** analysis only. No code was changed. Companion: `troski-ui-ux-upgrade-tracker.md` (per-issue tracker), `../strategy/troski-market-strategy-analysis.md`.

---

## 1. Current app UX architecture

- Expo + expo-router; 5-tab shell (Home, Lines, Wallet, Pulse, Rewards) + ~40 stack screens `[code]` (`app/_layout.tsx:180-199`).
- Two parallel information architectures for the same job: Home quick actions → `routes/search` (planner) vs Lines tab (browse) vs `ExploreMap` (map-first, **62KB orphan component imported by nothing** `[code]` — dead code carrying 4 P0/P1-grade issues of its own).
- Onboarding is a hard auth wall: `OnboardingFlow.tsx:117-127` only exits to register/login — **no guest path to a fare answer**, despite the data layer being deviceId-anonymous-ready `[code]` (`lib/hooks/useDeviceId.ts`). This is the single biggest funnel defect: the marketing claim "no sign-up needed" (troski.me) is contradicted by the app `[code+fact]`.
- Offline architecture exists and is good: global `OfflineBanner` (`_layout.tsx:178`), real offline queue (`lib/services/offline-queue.ts`) — but per-screen adoption is inconsistent (§9).
- GO Mode singleton engine, Data Saver pattern, ticket offline QR = genuinely strong architectural pieces `[code]`.

## 2. Current design system

- Uber Base-derived tokens (24px padding, 16px card radius, #FF4D1C brand, #FAFAF9 bg) + Baloo 2 via `font.*` tokens `[code]` (`lib/theme.ts`, CLAUDE.md).
- **Adoption is split-brain**: entire auth/register/onboarding funnel has 61 `fontWeight` styles and 0 `fontFamily` — first-run renders system font, not the brand `[code]` (cluster-3 grep).
- 12 `lineHeight` pairs below the 1.3× Baloo floor (clipping risk the repo itself documents) — auth titles 28/34, OnboardingFlow 30/36 `[code]`.
- Dark mode disabled globally (`_layout.tsx:139`) — correct for sun readability `[inf]`; but dead dark-mode branches remain (`wallet.tsx:23`, `TrotroDarkTheme`).
- Currency has **3–4 simultaneous formats**: `GH₵` (37 uses), bare `₵` (~22), `GHS` (37), `formatGHS` util (36) — e.g. `momo.tsx:49` says "min GHS 1" on a screen otherwise using GH₵; `detail.tsx:647` uses `₵` `[code]`.
- Sub-12px ALL-CAPS microtext is the de-facto house style for status/labels (9–11px across wallet, home, cards) — hostile to sunlight and older eyes `[code]` (§5).

## 3. Core user flows (as-built)

| Flow | Taps to answer | Verdict |
|---|---|---|
| Fare lookup (core job) | Home → Plan a Trip → type From → type To → 1.2s forced debounce → plan card → detail = **5+ interactions, fare not on suggestion rows** `[code]` (`search.tsx:195-205`) | Too slow for the #1 job; no fare-first shortcut `[inf]` |
| Route browse | Lines → route card → detail | OK; `[id].tsx` is the honest template (44pt fare hero, freshness line `[code]` `[id].tsx:174-186`) |
| Queue check | Home quick action → queue/status | Good screen; but map surfaces contradict it (§6) |
| Train | Lines → Train segment | Board is honest ("SCHEDULE" chip); Home train cards are not (§8) |
| Top-up | Wallet → Add Money → MoMo | Solid until the confirmation gap (checkmark before money lands `[code]` `WalletTopUpAnimation.tsx:96-103`) |
| Booking | route → Go Now → checkout → PIN → receipt | Sticky pay bar + shortfall top-up = best pattern in app `[code]` (`checkout.tsx:390-417`); poisoned by fallbacks (§8) |
| First run | Install → onboarding → **forced register/login** → home | Blocks the fare answer behind OTP `[code]` — kills the acquisition promise |

## 4. Mobile usability issues

- **Dead/inert controls on money surfaces**: "Use Promo Code" no onPress (`checkout.tsx:344-347`), payment "+" (`checkout.tsx:365`), "VIEW ALL" plain text (`wallet.tsx:436`), "View all reports" (`[id].tsx:348-351`), Home location row Pressable with chevron but no handler (`index.tsx:173-179`), stations "Nearest" tab with `getDistance → null` (`stations/index.tsx:214-216`) `[code]`.
- **Sub-44pt targets**: "SEE ALL" 10px text-only (`wallet.tsx:319`), cancel-refund ~25pt (`wallet.tsx:302-309`), momo back no hitSlop (`momo.tsx:110`), map station dots 7–14px circles (`stations/index.tsx`), Saver chip borderline (`trip:1026`), Copy 38pt (`bank-transfer.tsx:173`) `[code]`.
- **One-handed**: checkout/event CTAs correctly sticky-bottom; Home stacks all CTAs top-half `[code]` — acceptable, not ideal `[inf]`.
- OTP inputs lack `textContentType="oneTimeCode"`/`autoComplete="sms-otp"` — no SMS autofill, hand-typing on first run `[code]` (cluster-3).
- Gender = free-text input with "Select gender" placeholder (`register/profile.tsx:57`) `[code]`.
- 1s `setInterval` re-render of the whole train screen (`train/index.tsx:271-275`) — battery cost `[code]`.

## 5. Outdoor readability issues

Context: light theme on #FAFAF9 is right for sun `[inf]`; the grays and sizes are not:
- `#D1D5DB` text on white ≈ 1.6:1 (`search.tsx:493`, `detail.tsx:935,1142`) — fails WCAG at any level `[code]`.
- `#a8a29e` on #FAFAF9 ≈ 2.5:1 (`wallet.tsx:410,627`, `lines.tsx:104`) `[code]`.
- `#9CA3AF` at 11px for the *legally relevant* ad disclosure (`event/[placementId].tsx:173`) `[code]`.
- 9–10px status/date/label text throughout wallet (`txStatus` 9px `wallet.tsx:560`), SOON badges 9px, SPONSORED 9px `[code]`.
- `rgba(255,255,255,0.7)` 11px on arbitrary poster gradients — unguaranteed contrast (`WhatsOnAccra.tsx:210-236`); "Wallet balance" 0.75-alpha on orange ≈ 2.9:1 (`index.tsx:239`) `[code]`.
- Rule of thumb for the fix pass: ≥12px minimum, ≥4.5:1 for text, secondary gray floor = #6B7280 on white, nothing lighter `[inf]`.

## 6. Station/terminal use-case issues

The station context (standing in noise/sun, one hand, hurry) is where honesty gaps bite hardest:
- **Stale-as-fresh queue colors**: map dots color by `queue_stats[0].current_status` with zero age gating (`stations/index.tsx:44-47`, `ExploreMap.tsx:387-411,478-480`) — a 3-day-old red renders like a live red. `queue/status.tsx:37-50` proves the correct pattern exists (stale greyed, labeled, sunk) `[code]`. **P0**.
- Queue state is color-only on maps, no legend (`stations/index.tsx:28-34`) `[code]`.
- "Best pick" ignores freshness (`stations/index.tsx:117-131`) `[code]`.
- "Nearest" sort doesn't use location (above) `[code]`.
- Bookman/operator reality: no operator-facing surface exists (§ admin note, §16) — queue data quality depends on riders alone `[inf]`.

## 7. Accessibility issues

- **~3.5% coverage: 15 `accessibilityLabel|Role` hits vs ~424 touchables** (380 TouchableOpacity + 44 Pressable) `[code]` (cluster-3 grep).
- Zero a11y props in: routes/detail (2,000 lines), train/*, trip/*, stations, queue, terminals, fare report, ExploreMap, NearbyLines, all scan/*, all wallet subscreens `[code]`.
- Color-only encodings: traffic colors, queue dots, "Paid" green, queueColor recoloring a *duration* number (`NearbyLines.tsx:237-241`) `[code]`.
- Consent checkbox without checkbox role/state (`OnboardingFlow.tsx:196`); segment tabs without selected state (`lines.tsx:42-53`); radios without radio semantics (`fund.tsx:80-102`, checkout) `[code]`.
- QR ticket has no accessibilityLabel (conductor-facing moment) (`ticket.tsx`) `[code]`.

## 8. Trust/credibility issues (the most serious category)

**P0 — fabricated data presented as real:**
1. Scan-to-pay end-to-end fiction: static scan frame with camera instructions (`scan/index.tsx:13-46`), fake balances "GH₵ 2,500.00" (`scan/confirm.tsx:12-13`), fake bus quote (`confirm.tsx:44-60`), **any 6-digit PIN succeeds** (`scan/pin.tsx:23-27`, bypassing the real PinModal), landing on a fake paid receipt ("Victor Mensah", typo "Kumsasi") (`receipt.tsx:17-24`). Home gates entry, but routes are live for deep links `[code]`.
2. Checkout fare fallback `?? 25.0` — user can be **debited a hardcoded fare** when route data is missing (`checkout.tsx:108`); placeholder route names as booking targets (`checkout.tsx:41-42`) `[code]`.
3. ExploreMap `LIVE_VEHICLE_FARE = 8` — real ticket purchase at a made-up flat GH₵8 (`ExploreMap.tsx:76,1275`) — mitigated only by the component being dead code `[code]`.
4. Mock buses with fabricated plates/drivers + green "Live" pills whenever no real vehicles (`detail.tsx:143-164,893-899`); hardcoded stop timeline "Now at Market Square · updates live" (`detail.tsx:283-291,986-992`); unconditional "Live" dot + render-time timestamp on Real-Time Pulse (`detail.tsx:751-753,829-831`); hardcoded "Station Busyness: Not busy 20%" (`detail.tsx:761-777`) `[code]`.
5. GO Mode silently switches to a **timer simulation** when >50km from route — moves the marker, fakes station progress, auto-completes the trip and **awards real points** (`trip/[routeId].tsx:496-580`) — also a rewards-farming vector `[code]`.
6. Copyable fake bank account numbers with transfer instructions (`bank-transfer.tsx:16-25,59`) + fabricated "2 minutes to reflect / GH₵0.25 charge" SLA (`:109`) — screen routable even though fund.tsx gates it `[code]`.
7. "Go Cashless, Get 5% Back" promo with no backing system (`wallet.tsx:359-375`) — unfulfillable money promise `[code]`.
8. Home NearbyLines train cards show green "LIVE" from wall-clock schedule math (`NearbyLines.tsx:312-317`, `train-search.ts:96-98`) — the exact pattern the train board was already fixed for; train index in-transit green pulse "At {station}" same class (`train/index.tsx:604-618`) `[code]`.
9. Offline traffic renders as green "Light" (favorable claim with zero data) (`detail.tsx:167-176,788-799`) `[code]`.

**P1 trust:** MoMo option on checkout silently charges wallet instead (`checkout.tsx:148` + createBooking ignores payment); "LIVE SYNC READY" decorative fiction (`wallet.tsx:194-236`); receipt QR secretly completes the trip on tap (`receipt.tsx:150-156`); safety-sheet Support/Emergency buttons are "coming soon" alerts inside a safety feature (`receipt.tsx:223-231`); crowdsourced average labeled "official fare" when GPRTU-verified flag set (`[id].tsx:91,175-177`); static "GPRTU Bulletins" styled as live authority feed (`[id].tsx:424-443`); okada/pragya fares invented via 1.3×/1.5× multipliers without estimate labels (`detail.tsx:66-69`); topup checkmark before money lands (`WalletTopUpAnimation.tsx:96-103`); failed txs visually identical to succeeded on wallet preview (`wallet.tsx:334-336`) `[code]`.

**Security-adjacent:** 4-digit payment PIN stored **plaintext in AsyncStorage** while SecureStore is already a dependency (`register/pin.tsx:7,13,49`) `[code]` — P0 security; Mapbox public token hardcoded in 5 files (rotation risk) `[code]`.

## 9. Loading / empty / error / offline state gaps

- **Systemic error-as-empty**: 37× `.catch(() => {})` + 108 bare `catch {}` `[code]`. Offline users are told data *doesn't exist*: "wallet is quiet" with real balance (`wallet.tsx:81-82,409`), Home GH₵ 0.00 for funded wallets (`index.tsx:97-100,139`), "No tickets yet" while holding cached tickets (`tickets.tsx:30-34,90`), "No transactions yet" (`transactions.tsx:54-56`), "Route not found" (`[id].tsx:80-88`), "Line not found" (`[lineId].tsx:244-252`), "No queue reports yet" (`queue/status.tsx:27-31`), "No terminals yet" (`terminals/index.tsx:24-28`), Pulse feed has **no error state at all** (`useTales.ts:7`) `[code]`.
- Bare spinners without text/skeleton on ~8 screens while a good Skeleton system exists (`Skeleton.tsx` vs `terminals:81`, `[lineId]:237`, `pick-location:193`, `transactions:104`) `[code]`.
- ExploreMap placeholder blocks touches forever on dead connection (`ExploreMap.tsx:951-957`) `[code]` (dead code, but if revived).
- Positive patterns to standardize: ticket.tsx (cached, offline QR, brightness), GO Mode offline badge (`trip:780-786`), queue/status staleness handling, `detail.tsx` fare freshness lines `[code]`.

## 10. Recommended design direction

One sentence: **"Honest utility, readable in sunlight, answerable in two taps."** `[inf — recommendation]`
1. **Truth system**: every data point renders with source + age or not at all. Introduce one shared `<FreshnessBadge source age/>` and one `<LiveDot/>` that is *only* allowed when a realtime channel is actually connected. Kill every hardcoded "Live"/mock.
2. **Fare-first surfaces**: fare becomes the dominant number on Home cards (currently 11px `NearbyLines.tsx:270,525`); a "Fare check" quick path (From/To → number) targeting ≤2 interactions; station autocomplete on fare report to protect data quality (`fare.tsx:186-193`).
3. **Offline honesty**: one shared error/empty/offline triad component; every fetch failure distinguishes "couldn't load — retry" from "none yet". Cache-first on money surfaces (Home balance seeds from wallet cache like wallet.tsx does).
4. **Guest-first onboarding**: "Explore fares" path bypassing auth (data layer already supports deviceId); auth deferred to first money/social action.
5. **Sunlight pass**: 12px floor, #6B7280 gray floor, contrast-audit ad/poster overlays.
6. **Brand completion**: Baloo pass on auth/register/onboarding (fix the 12 lineHeight pairs in the same PR); single currency formatter everywhere.
7. **Ghanaian trust cues**: GH₵ consistency; GPRTU/official badges only when actually verified; "rate the line, never the mate" preserved; Twi/Ga/Pidgin — treat via the planned AI translation layer, do NOT hand-wire more screens (owner decision on record `[code]` memory/docs).

## 11. Recommended UI libraries (only if useful)

- **None required for the core fixes** — the design system, Skeleton, OfflineBanner, PinModal, haptics are all in place; the work is adoption + honesty, not new deps `[inf]`.
- Worth considering, later, narrowly:
  - `@shopify/flash-list` — only if Pulse/transactions lists show measurable jank (drop-in FlatList replacement, no design impact).
  - `expo-image` is already used ([id].tsx) — extend for poster caching in WhatsOnAccra instead of ImageBackground.
  - `react-native-svg` already present (gauge) — reuse for a proper FlipDigit animation; no new lib.

## 12. Libraries NOT recommended, with reasons

- **UI kits (NativeBase/Tamagui/gluestack/react-native-paper)**: would fight the established Uber-Base token system, add bundle weight on low-end Androids, and force a visual re-audit of every screen — the problem is consistency, not components `[inf]`.
- **lottie-react-native**: native dep → dev-client rebuild; the owner already deliberately avoided it for the top-up animation `[code]` (CLAUDE.md) — keep that decision.
- **reanimated-heavy animation kits**: repo has a documented Android ban on Animated.View-in-ScrollView `[code]`; more animation surface = more risk for zero fare-answer value.
- **i18n frameworks (i18next etc.)**: `lib/i18n` scaffold exists and the plan of record is an AI translation layer — swapping frameworks now is churn `[code+inf]`.
- **RN accessibility helper libs**: labels/roles are 1-line props; a lib adds nothing.

## 13. Implementation phases (proposal — needs owner approval; several touch protected areas)

- **Phase A — Trust P0s (small diffs, big stakes; touches payments → explicit approval needed):** gate/remove scan flow routes; remove checkout `?? 25.0` + placeholder names (fail loudly instead); delete/flag bank-transfer fake accounts; remove "5% Back" promo; kill mock vehicles/stop-timeline/"Live" pills in detail.tsx; gate GO Mode simulation behind `__DEV__`; PIN → SecureStore migration; fix Home train "LIVE".
- **Phase B — Offline/error honesty:** shared ErrorState/EmptyState/OfflineState triad; cache-first Home balance; adopt on the 9 error-as-empty screens; Pulse feed error state.
- **Phase C — Fare-first + readability:** Home card fare prominence; fare-check quick path; station autocomplete on fare report; 12px/contrast sweep; currency unification via formatGHS.
- **Phase D — Funnel + brand:** guest path through onboarding; OTP autofill; Baloo+lineHeight pass on auth/register; dead-code removal (ExploreMap 62KB, dark-mode branches).
- **Phase E — Accessibility baseline:** roles/labels on the ~40 highest-traffic controls (tabs, back buttons, pay bar, PIN pad, QR, toggles); selected/checked states on segments/radios/checkboxes.
- Sequencing rationale: A protects money trust before any growth push; B/C serve the strategy wedge (fare truth); D unlocks acquisition; E is continuous `[inf]`.

## 14. Files likely involved

Phase A: `app/scan/*` (3), `app/booking/checkout.tsx`, `app/booking/receipt.tsx`, `app/wallet/bank-transfer.tsx`, `app/(tabs)/wallet.tsx`, `app/routes/detail.tsx`, `app/trip/[routeId].tsx`, `components/NearbyLines.tsx`, `lib/utils/train-search.ts`, `app/register/pin.tsx` (+ read paths of `troski_user_pin`), `app/train/index.tsx`.
Phase B: `components/` (new `StateViews.tsx`), `app/(tabs)/index.tsx`, `app/wallet/tickets.tsx`, `app/wallet/transactions.tsx`, `app/routes/[id].tsx`, `app/train/[lineId].tsx`, `app/queue/status.tsx`, `app/terminals/index.tsx`, `lib/hooks/useTales.ts` + `components/TalesScreen.tsx`.
Phase C: `components/NearbyLines.tsx`, `app/routes/search.tsx`, `app/report/fare.tsx`, `lib/utils/currency.ts` adoption sweep, contrast sweep across cluster files.
Phase D: `components/OnboardingFlow.tsx`, `app/_layout.tsx` (redirect), `app/auth/*`, `app/register/*`, delete `components/ExploreMap.tsx` (verify truly unimported first).
Phase E: prop-only edits across ~20 files.

## 15. Files NOT to touch (without separate explicit approval)

- `lib/services/booking*`, `app/api`-facing service calls, `lib/services/paystack`-adjacent code, wallet debit/credit logic — **payments** (protected).
- `lib/supabase/*`, migrations — **database** (protected).
- `lib/hooks/useAuth.ts`, OTP/session logic — **auth** (protected; UI-only changes to auth screens are Phase D, logic untouched).
- `lib/hooks/useLocation.ts` permission logic, `usePushNotifications.ts` — **location/notifications** (protected; the push-at-mount timing issue is noted, fix requires approval).
- `app.config.js`, `eas.json`, store metadata — **production config** (protected).
- `lib/hooks/useTrip.ts` singleton internals (GO Mode engine) — only the simulation *gating* in `trip/[routeId].tsx`, not the engine.
- Internal `tale*` naming (documented do-not-rename `[code]` CLAUDE.md).

## 16. Verification plan

- Per phase: `tsc --noEmit` + eslint (both currently clean baselines).
- Phase A: manual repro on simulator — attempt scan deep link (must dead-end honestly), checkout with missing params (must error, not GH₵25), airplane-mode Home (must show cached/“couldn’t load”, not GH₵0.00), GO Mode >50km (must refuse, not simulate), PIN migration (old AsyncStorage PIN still unlocks once, then lives in SecureStore).
- Phase B: airplane-mode sweep of the 9 screens — each must show retryable error, not empty.
- Phase C: screenshot audit at 100%/200% font scale; contrast checks (≥4.5:1) on changed styles; fare visible on Home cards without tap.
- Phase E: VoiceOver/TalkBack pass on tab bar, pay bar, PIN pad.
- Device matrix: one low-end Android (≤2GB RAM) mandatory — the target user's hardware `[inf]`.
- Feature tracker: log each fix into `docs/FEATURE_TRACKER.csv` per house QA convention, and `troski-ui-ux-upgrade-tracker.md` statuses.

---

### Admin/operator screens note
Trotro Pro (driver/fleet app) lives in a separate repo (`troski-pro`) and was out of audit scope; no operator surface exists in this app. Requirements capture for bookman/station-master tools belongs to the strategy 90-day plan (union pilot toolkit), not this audit `[inf]`.

### WhatsApp/community note
Only one wa.me flow exists (SOS emergency share — solid, with call fallback `[code]` `SOSButton.tsx:60-70`). `useAuth.ts:65` references WhatsApp bookings with no in-app surface — either build the surface or drop the copy `[code]`. Pulse feed lacks an error state (§9).
