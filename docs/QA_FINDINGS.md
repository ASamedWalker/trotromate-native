# Troski QA Findings — feature audit, errors, fixes

Companion to `docs/FEATURE_TRACKER.csv` (96 features, user stories + expected
behaviour). This logs every error surfaced by the code audit, its severity, and
disposition. Phase order: spec → test/document → fix logistical/UX → re-test.

## ✅ Re-audit pass 2 (2026-06-22) — fixed this pass (tsc-clean)

Full re-sweep of all 96 features via 6 parallel area audits against current code.

| ID | Bug found | Fix |
|----|-----------|-----|
| W1 | Wallet flashed blank "quiet" empty-state for seconds on open, then flipped to funded | Seed balance+tx from `walletCache` on mount + `hydrated` skeleton guard; cache only written on confirmed balance (no clobber on partial response) |
| RW7 | `fetchLeaderboard` had NO `.order()` → ranks assigned by unsorted DB order (WRONG ranks shown) | Added `.order('weekly_points', { ascending: false })` |
| R2 | "Verify" button on signup OTP screen was a dead no-op (`onPress={() => {}}`) | Extracted `submitOtp`; button now triggers verification with loading guard |
| R4 | Profile save error was swallowed — advanced to PIN even if the DB write failed | `throw error` → Alert → return; only advances on success |
| R6 | Survey "Go to Home" had no double-submit guard (could fire `completeOnboarding` repeatedly) | `submitting` state + disabled button + label |
| B1 | Checkout "Pay" was enabled while wallet balance still loading/unknown → silent overdraw path | Pay disabled ("Checking balance…") until balance resolves (`waitingBalance`) |
| W12 | MoMo top-up phone accepted any 9+ chars (bad numbers reach backend) | Validate Ghana mobile format `^0?[25]\d{8}$` |
| RP1 | Fare report had no upper bound (₵500 accepted client-side) | Bound 0.01–200 (matches backend MAX_FARE) |
| RP4 | Train delay minutes unbounded | Bound 1–1440 |
| N1 | Notifications fetched once → stale | `useRefreshOnFocus(['notifications'])` refetch on focus (realtime still deferred) |
| BU1 | Bulletins loaded once → stale | `useFocusEffect` refetch on focus (realtime still deferred) |
| P3 | Reel video kept decoding in background (battery + data) | `useFocusEffect` pauses player on blur/unmount |

New file: `lib/services/walletCache.ts` (wallet snapshot cache).

### Still open after pass 2 (deferred — backend/native/by-design)
- S3a/S3b: scan-to-pay still never debits + bus code not passed confirm→pin (whole scan flow is a UI mock; needs `/api/scan-pay` + expo-camera). DEFERRED.
- Ride rating has no offline queue + `051_ride_ratings.sql` migration still unrun → ratings silently lost. DEFERRED (run migration; add to offline-queue).
- G4 post-trip fare submit is fire-and-forget with no retry/queue — by design today.
- routes/detail arrival bell state-only; train "On Time"/Unsplash hero hardcoded (no telemetry); traffic "Flowing" static — DEFERRED (need live data).
- Realtime subscriptions for comments/activity/notifications — DEFERRED (backend channels).
- i18n: ~5 screens (Pulse/Profile/Activity/Notif/Bulletin) still English — owner scope = critical screens only.
- RW4 referral count not refetched on pull-refresh (stale until remount) — minor, documented.

## ✅ Fixed pass 1 (frontend logistical/UX, verified tsc-clean)

| ID | Bug | Fix |
|----|-----|-----|
| A3 | Resend OTP (login) only reset the 60s timer — never re-sent the code | `auth/verify` now calls `signInWithPhone(phone)` on Resend |
| R2 | Same resend no-op on the signup OTP screen | `register/verify` Resend now calls `signInWithPhone` |
| R1 | Signup accepted any/blank/malformed email | `register/phone` validates email format (if provided) before Continue |
| R4 | "Terms & Condition" / "Privacy Policy" links on review screen were non-functional (styled text, no handler) | Wired `onPress` → `/terms` and `/privacy` |
| P4 | Creator profile XP bar used a hardcoded threshold array `[0,50,150,...]` that didn't match the real tier definitions (wrong %/“to next level”) | Now derives from `LEVELS` `min_points`/`max_points`; handles top-tier (Infinity) → "MAX" / "Top tier reached" |

## ⏳ Deferred — backend / native rebuild required (not a frontend fix)

| ID | Issue | Why deferred |
|----|-------|--------------|
| S3 | Scan-to-pay never calls `createBooking` — no wallet debit, no real ticket; PIN accepts any 6 digits | Needs a `/api/scan-pay` (or reuse bookings/create) + live camera (expo-camera, native rebuild). Whole scan flow is a UI mock today. |
| S2 | Scan/confirm bus details + balance are hardcoded mock | Needs `GET /api/buses/{code}` lookup |
| L6 | Route-detail arrival bell sets state only — no notification scheduled, lost on close | Needs real bus GPS + notification wiring |
| W13 | Bank-transfer account numbers are placeholders | Needs backend per-user virtual accounts |
| W14/biometric, W10 brightness | Activate only after native rebuild | expo-local-authentication / expo-brightness lazy-loaded |
| B1 driver, S2 | checkout driver card + reviews are mock | No real driver pool (`driver_profiles` ~empty) |
| T1/T3 | Train "On Time"/delay is hardcoded; train hero photos are Unsplash | No live train telemetry; needs Ghana rail imagery |
| Notifications/Bulletin (N1, BU1) | Fetched once, no realtime subscription | Backend realtime channel |

## 🟡 Accepted / low-priority (documented, no change)

- W3: Active Pass shows only the first pass though it can say "N passes" (single-pass UX is fine for v1).
- W9: transaction-detail Copy is tappable when reference is "—" but the handler already no-ops.
- B3: processing animation is a fixed 2.3s (not tied to real API latency) — acceptable for the demo-paced flow.
- RW8: tier-up and 7-day-streak share one AsyncStorage "celebrated" key (only one confetti per mount) — minor.
- SET1: theme toggle is a deliberate no-op (dark mode disabled until tested) — by design.
- R5: registration PIN stored in AsyncStorage while the wallet PIN uses SecureStore — registration PIN is a low-value gate; wallet spend (the money path) correctly uses SecureStore.
- Reels keep playing in background (battery) — optimisation, not a bug.

## Notes on testing method
Stories were verified against the actual code (control flow, API calls, nav,
validation). Money/booking/wallet flows were additionally exercised live on the
simulator earlier this session (top-up → book → ticket → cancel/refund all
confirmed). Pure-UI and community screens were audited statically.
