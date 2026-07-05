# Troski Native — Mobile UX Audit (2026-07-05)

Auditor: fable-architect (design strategist / product-quality judge). Audit-only; no repo changes.
Evidence base: repo code inspection + 15 live screenshots (iPhone 15 Pro, logged in, simulator location = San Francisco).
Owner decisions in CLAUDE.md (Pulse naming, no money framing on Rewards, dark mode disabled, GO Mode entry rules, internal `tale*` naming) are treated as constraints, not findings. QA pass of 2026-07-04 defects are excluded.

## 1. Current app architecture (brief)
- Expo SDK 54 + expo-router file routing. 5-tab floating pill nav (`app/(tabs)/_layout.tsx`, custom `FloatingTabBar`): Home / Lines / Wallet / Pulse / Rewards; hidden tab routes (activity, report, profile, routes, train) reachable by navigation.
- Feature stacks outside tabs: `app/routes/*` (search, detail map), `app/queue/status.tsx`, `app/terminals/`, `app/stations/`, `app/train/`, `app/wallet/*` (fund, momo, bank-transfer), `app/report/*`, `app/trip/*` (GO Mode), `app/scan/*`, auth/register.
- Data: Supabase (routes, `route_fare_stats`, queue reports, tales), Mapbox custom style, module-singleton trip store (`lib/hooks/useTrip.ts`), offline queue in `lib/hooks/useOfflineQueue.ts` surfaced via `AppContext` (`isOnline`, `pendingReports`).
- Onboarding IS wired: `OnboardingFlow` rendered from `app/_layout.tsx:154`.

## 2. Current styling/design system (what exists, where it's violated)
Exists: `lib/theme.ts` — palette `c.*`, `font.*` (Baloo 2 weights), `glass`, `shadow` presets, `themed(isDark)` helper. CLAUDE.md defines Uber Base tokens (24px padding, #FF4D1C brand, #9CA3AF secondary, #FAFAF9 bg, 16px cards).
Violations / drift observed:
- **Hardcoded hex instead of tokens**: `#9CA3AF` appears 137 times across app/components (grep count) rather than a single `textSecondary` token; shadows re-declared inline in `app/(tabs)/index.tsx:35-36` instead of `shadow.*` presets.
- **Two competing accent systems**: brand orange #FF4D1C (Home, Lines, Wallet) vs amber #f59e0b family (Stations explorer, 08-stations.png; theme `themed().primary = c.amber500`). `themed()` still returns amber as "primary", so any screen using the helper diverges from the Uber Base brand accent.
- **`themed(isDark)` + `useColorScheme` still threaded through components** (OfflineBanner, tab bar) even though dark mode is globally disabled — dead branches, and the tab bar carries a dark style that can never render. Not user-facing; note only.
- Lines tab has not received the Uber Base pass (CLAUDE.md backlog confirms); 01-lines.png shows a tinted pink section background, red display-size prices, and ALL-CAPS 10px labels that don't match Home/Wallet.
- Register/auth/onboarding titles render system font (fontWeight without fontFamily) — acknowledged as intentional-until-pass in CLAUDE.md; excluded.

## 3. Core rider/user flows
1. **Plan a trip**: Home "Where to?" → `routes/search.tsx` (from/to, saved places, nearby stations) → route card → `routes/detail.tsx` full-screen map + sheets (transport picker → buses → stop timeline).
2. **Browse lines/fares**: Lines tab (`(tabs)/routes.tsx` rendered inside lines) — search, mode chips, fare cards from `route_fare_stats`.
3. **Queue check**: Home "Queue Status" → `queue/status.tsx` (summary counts + per-station cards + Report a Queue).
4. **Pay/top-up**: Wallet → Add Money → `wallet/fund` → MoMo (live) / bank transfer (FE-only).
5. **Ride companion**: booking receipt → GO Mode (`trip/[routeId]`), Data Saver variant, alight alarm, arrival handoff.
6. **Contribute**: Report hub (`(tabs)/report.tsx`) → fare/queue/incident/tale/train reports → Rewards coins/tiers.
7. **Train**: Lines → Train segment → departure board → `train/[lineId]`.

## 4. Public commuter UX issues
- **Lines default sort surfaces intercity routes first** (01-lines.png: Accra→Tamale GH₵240, Accra→Ho GH₵80 above the fold; all "No reports yet"). A hurried Accra commuter must scroll past long-distance corridors to find their daily route. No proximity/popularity ordering visible in `(tabs)/routes.tsx:80-113` (filter only, no relevance sort).
- **Red display-size prices** on Lines cards read as alerts/errors; fare is neutral info. `routes.tsx:173-176` colors fare with route accent (red for trotro).
- **"No reports yet" everywhere with no CTA** (01-lines, 08-stations): dead-end empty states on the core value loop; should deep-link to Report Fare / Report Queue (+pts) to close the crowdsourcing loop.
- **Notifications feed (14) is 61d-old preview announcements** with no read state or age grouping — feels abandoned rather than live. Low priority.
- **Settings Appearance selector (10-settings.png) offers System/Light/Dark but is a no-op** (dark disabled by owner decision). A control that does nothing erodes trust. Keep dark disabled; hide the selector or badge it "Coming soon".

## 5. Station/terminal UX issues
- **Absurd distances rendered verbatim**: 07-terminals.png shows "12336 km" pills; 05-search.png "Nearby stations … 12277.1 km". No sanity clamp in `app/terminals/index.tsx:117-120` / `app/routes/search.tsx:90-92`. Real-world trigger: GPS drift, permissions granted but no fix, traveler abroad. Distances >~100 km from a Ghana station should hide the pill (the data is noise, and it screams "this app isn't for here").
- 08-stations.png: station cards show three grey meter bars that read as a stuck skeleton next to "No reports yet" — ambiguous loading-vs-empty affordance.
- Amber "Navigate" button uses white text on #f59e0b (~2.2:1) — see §9.

## 6. Queue status UX issues
- **Stale data presented as current**: 06-queue.png — every station is "Stale · 26–150d ago" yet keeps saturated "Very Long/Long" pills and full progress bars, and the header summary "4 Busy / 4 Near Full" is computed from those stale reports (`queue/status.tsx:32-37`). A commuter in a hurry reads the pill color, not the 12px stale line. Stale entries should grey the pill/bar and be excluded from (or footnoted in) summary counts. The stale flag/red text already exists (`status.tsx:116-117`) — good honesty foundation, wrong visual hierarchy.
- **Hero header**: back chevron and status-bar time sit over a busy photo with no scrim band (06-queue.png top) — poor glare readability; "Across all stations" subtitle is light-on-photo.
- "0 Live Now" in green is correct honesty; keep.

## 7. Fare/route discovery UX issues
- Fare confidence exists on cards (dot + label, `routes.tsx:186-193`) — good. But with zero reports the giant fare number still shows an authoritative "GH₵ 240.00 Per Seat"; source ambiguity (official? crowdsourced? seeded?) undermines trust. When `route_fare_stats` has no reports, prefix "Est." or mute the price.
- Currency notation inconsistent across train surfaces (₵10 in 09-train vs GH₵ elsewhere) — already on the owner's train backlog (CLAUDE.md item 3); endorsed, route through the currency util.
- Search (05) works well structurally (saved places, swap button, nearby) — main defect is the distance noise above.

## 8. Map/location UX issues
- **Header location is raw reverse-geocode with no Ghana awareness** (`(tabs)/index.tsx:90-109`): shows "San Francisco, US" (00-current.png). Default state is 'Accra, GH' but any fix overwrites it. For a Ghana-only product, an out-of-Ghana or low-accuracy fix should fall back to "Accra, GH" (or hide the row) rather than proudly displaying a foreign city. Also the Mapbox token is hardcoded in the fetch URL at `index.tsx:98` — move to config (read-only observation; public token, low severity).
- Search "Current location — San Francisco, California" (05): same root cause.
- `useLocation` caches last fix (good) but exposes no accuracy/plausibility gate; consumers each render distance raw.
- routes/detail map itself (3-layer line, animated draw) is strong; no findings beyond contrast of thin labels (not actionable without a map-style change — out of scope).

## 9. Outdoor readability issues (contrast estimates, WCAG ratio)
| Surface | Colors | Est. ratio | Verdict |
|---|---|---|---|
| Secondary text | #9CA3AF on #FAFAF9 | **~2.4:1** | Fails AA (4.5:1); 137 hardcoded uses. In harsh sun this text disappears. |
| Tab bar inactive icon+label | rgba(0,0,0,0.3) on white, 10px label | **~2.1:1** | Fails badly; 10px bold compounds it (`(tabs)/_layout.tsx:73,81,148`). |
| Stations "Navigate" btn | white on #f59e0b | **~2.2:1** | Fails; use stone900 text on amber (≈8:1) or amber700 bg. |
| Brand CTA | white on #FF4D1C, bold ≥16px | ~3.3:1 | Passes AA large-text only — acceptable for buttons; do not use for body text. |
| Queue "stale" red | #dc2626 on white 12px | ~4.5:1 | Borderline OK. |
| Home quick-card sublabels | #9CA3AF "Directions/Nearby/Status" | ~2.4:1 | Same token issue. |
Recommendation: change the secondary-text token to **#6B7280 (~4.6:1)** app-wide via one theme constant, with owner sign-off since #9CA3AF is written into the CLAUDE.md token table. This is the single highest-leverage outdoor-readability change.

## 10. Accessibility issues
- **One `accessibilityLabel` in the entire app** (grep count = 1); zero `accessibilityRole` found. Screen-reader users cannot use the custom tab bar: `FloatingTabBar` Pressables (`_layout.tsx:65-88`) have no role="tab", no label, no selected state.
- Icon-only controls without labels: header bell (00), wallet eye toggle (00/02), back chevrons, train reminder bells, search swap button.
- Touch targets: tab items are fine (flex + padding). Suspect <44pt: wallet eye (header, 02), Lines "All Regions" chip, terminals distance pills are non-interactive (OK). 73 `hitSlop` usages show the pattern exists — audit the header icon buttons and add hitSlop/labels in one pass.
- 10px tab labels and 10-11px ALL-CAPS meta ("PER SEAT", "URBAN MOBILITY") sit below comfortable legibility for low-vision users in glare; 11-12px floor recommended.

## 11. Loading/empty/error/offline state gaps
- **`OfflineBanner` exists but renders only inside `ExploreMap` (`components/ExploreMap.tsx:492`)**. `AppContext` already exposes global `isOnline` + `pendingReports` (`lib/contexts/AppContext.tsx:38`). For an audience where data costs money and coverage drops, offline/sync state must be visible on every screen — mount it once above the tab navigator in `app/_layout.tsx`. This is the cheapest high-trust win in the audit.
- Skeletons exist (`components/Skeleton.tsx`) but only 6 screens use them. Wallet shows a large blank void between "Recent Transactions"/SEE ALL and the first (occluded) card while loading (02-wallet.png); queue list and search results have no skeletons.
- Empty states lack next actions (§4). Rewards/queue/lines "no reports" should CTA into the report flows.
- Error states: not directly observable in screenshots; `AppErrorBoundary` exists at root — adequate.

## 12. Recommended mobile design direction
Stay the course on Uber Base — the bones are genuinely good. Home, Wallet, Rewards, and the Fund flow already read as a coherent, modern, mobile-native product: white cards on #FAFAF9, one loud brand orange, Baloo 2 giving it a warm, Ghanaian-friendly voice that stock Uber lacks. The work is not redesign; it is **finishing and enforcing** — bring Lines and Stations onto the same token set, collapse the amber-vs-orange dual accent (amber can remain the Stations/Train "official transit" sub-brand if deliberate, but `themed().primary` should stop claiming amber is the app primary), and stop hand-rolling shadows and greys per screen.

The one deliberate evolution I recommend is an **outdoor-first contrast tune**: darken the secondary-text token, lift tab-bar inactive states, and keep white-on-color text to bold ≥16px only. This costs nothing visually — Uber's own Base palette uses gray-600-class secondary text — and it is the difference between readable and invisible on a sunny Kaneshie roadside. Pair it with honesty-of-data patterns the app already half-implements: stale queue reports greyed, "Scheduled" instead of fake "LIVE", estimated fares marked "Est.". Trust is this product's moat; the UI should never look more confident than its data.

Finally, treat the floating pill nav as a first-class layout constraint. It is a signature element worth keeping, but every scrollable screen needs a shared bottom-clearance constant, and every screen with a photo hero needs a status-bar scrim. Small, mechanical, batchable — no new patterns, no new dependencies.

## 13. Recommended libraries, if any, with reasons
**None new.** Every finding is fixable with what is installed (react-native-safe-area-context, existing Skeleton, AppContext network state, lucide, RN Animated). Adding dependencies would violate the small-diff constraint for zero capability gain.

## 14. Libraries NOT recommended, with reasons
- **NativeWind/Tailwind or Tamagui/restyle**: full styling-system migration; enormous diff, no commuter-facing benefit; token discipline solves the same problem.
- **react-native-paper / gluestack (component kits)**: would fight the established Uber Base look; heavy.
- **lottie-react-native**: already deliberately avoided (native dep, dev-client rebuild) — CLAUDE.md documents the path if ever wanted.
- **@react-native-community/netinfo direct adoption per-screen**: unnecessary; `AppContext.isOnline` already centralizes it.
- **FlashList**: lists here are short (≤~100 rows); FlatList is fine; perf not an observed problem.
- **react-native-svg-charts or similar**: no new data-viz need.

## 15. Risk score by area (0-5)
| Area | Risk |
|---|---|
| Bottom-padding/occlusion + safe-area fixes | 0 |
| Global OfflineBanner mount | 1 |
| Skeletons + empty-state CTAs | 1 |
| Tab bar contrast + a11y roles/labels | 1 |
| Stations amber button contrast | 1 |
| Settings appearance selector cleanup | 1 |
| Distance clamp + location fallback | 2 |
| Secondary-text token change (design-system, owner sign-off) | 2 |
| Queue staleness de-emphasis + summary counts | 2 |
| Lines sort + fare "Est." marking | 2 |
| Train honesty batch (owner's own backlog) | 2 |

## 16. Implementation phases (small batches, each independently shippable)
1. **P1 — Occlusion & safe area (risk 0-1)**: shared `TAB_BAR_CLEARANCE` bottom padding for wallet/report/profile (+verify rewards); `edges={['top','bottom']}` or top padding for `train/index.tsx:423`; scrim band on queue hero.
2. **P2 — Offline & loading (risk 1)**: mount `OfflineBanner` globally in `app/_layout.tsx`; Skeletons for wallet transactions + queue list; fix wallet dead-space.
3. **P3 — Contrast & a11y (risk 1-2)**: tab bar inactive → rgba(0,0,0,0.45), label 11px; a11y role/label/state on tabs + header icon buttons; stations Navigate button text color; THEN (separate commit, owner sign-off) secondary token #9CA3AF → #6B7280 via one constant.
4. **P4 — Location honesty (risk 2)**: `formatDistance` clamp (hide >100km); Home header + search "current location" fallback to "Accra, GH" when fix is out-of-Ghana bounds.
5. **P5 — Queue truthfulness (risk 2)**: grey pill/bar for stale entries; exclude stale from Busy/Near Full counts (label "recent reports").
6. **P6 — Lines & fares polish (risk 2)**: relevance sort (nearby/popular first); "Est." prefix when 0 reports; neutral fare color; empty-state CTAs → report flows.
7. **P7 — Train honesty batch (risk 2, endorses owner backlog)**: "Scheduled" chip, currency util, "Trains" title.
8. **P8 — Settings cleanup (risk 1)**: hide/no-op-badge the Appearance selector.

## 17. Files likely involved
`app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/wallet.tsx`, `app/(tabs)/report.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/routes.tsx`, `app/(tabs)/rewards.tsx` (verify), `app/_layout.tsx` (OfflineBanner mount only), `app/queue/status.tsx`, `app/terminals/index.tsx`, `app/routes/search.tsx`, `app/train/index.tsx`, `app/stations/*` (Navigate button), `app/settings/*` (appearance block), `lib/theme.ts`, `lib/utils/distance.ts`, `components/OfflineBanner.tsx`, `components/Skeleton.tsx`.

## 18. Files NOT to touch
- Payment/wallet backend surfaces: `app/wallet/momo.tsx`, `app/wallet/bank-transfer.tsx` payment logic, `POST /api/wallet/topup` calls, PIN/scan flows (`app/scan/*`), booking debit logic.
- Auth: `app/auth/*`, `app/register/*`, `lib/hooks/useAuth.ts`, Supabase auth config.
- Database/migrations: `lib/supabase/*`, any table/RPC/service write paths (`lib/services/*` business logic).
- Location permissions & GO Mode engine: `lib/hooks/useTrip.ts`, `lib/services/tripChannel.ts`, permission request flows in `useLocation.ts` (display-layer fallback only — do not change permission or watcher logic).
- Notification logic: `lib/services/trainReminders.ts`, `usePushNotifications`, notification pref keys.
- Production config: `app.config.js`, EAS/runtimeVersion, Mapbox style ID.
- Owner-decision surfaces: Rewards money framing, Pulse/tale naming, dark-mode enablement, GO entries on route pages.

## 19. Verification plan
Per batch: `npx tsc --noEmit` (typecheck) + `npx expo lint` if configured; re-capture the affected screenshots at the same routes and diff against `/scratchpad/uiux/*.png` baselines.
Eyeball per phase:
- P1: wallet/report/profile/rewards scrolled to bottom — last card fully visible above pill nav; train header clear of clock; queue hero back button legible.
- P2: airplane-mode the simulator → grey "You're offline" banner on Home/Lines/Wallet; wallet shows skeleton rows, not void.
- P3: tab bar inactive labels readable at arm's length in bright screen sim (max brightness); VoiceOver announces "Home, tab, selected"; secondary text spot-check on Home/Lines/Search.
- P4: with SF sim location — header says "Accra, GH", no km pills; with Accra custom location (5.556,-0.196) — real distances return.
- P5: stale stations show grey pills; summary counts only include fresh reports.
- P6: Lines first screenful = plausible Accra commuter corridors; zero-report fares show "Est.".
- P7/P8: train board shows "Scheduled" when no live data; settings shows no dead controls.
Android spot-check (mid-range device/emulator) for P1/P3: floating bar clearance and Baloo lineHeight clipping (respect the 1.3× rule; omit lineHeight when unsure).
