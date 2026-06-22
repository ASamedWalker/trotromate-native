# Troski — Deferred Backlog

Work surfaced by the feature audits (`docs/FEATURE_TRACKER.csv` +
`docs/QA_FINDINGS.md`) that was intentionally NOT fixed in the frontend
logistical/UX passes because it needs a backend endpoint, a native rebuild, a
DB migration, live third-party data, or an owner decision.

Ordered by value within each blocker group. Each item lists the gate, the build
steps, and the files to touch.

---

## 🔴 P0 — Money / data-integrity (do first)

### S3 + S2 — Scan-to-pay is a UI mock (no debit, no ticket)
- **Gate**: backend `/api/scan-pay` (or reuse `/api/bookings/create`) + a bus lookup `GET /api/buses/{code}`; live camera (`expo-camera`, native rebuild).
- **Why P0**: `scan/pin.tsx` accepts ANY 6 digits and routes straight to the receipt — no wallet debit, no real ticket. Looks like a payment, isn't one.
- **Build order**:
  1. Backend: `GET /api/buses/{code}` → real bus/route/fare (replaces hardcoded "STC Coach / GH₵25.25" in `scan/confirm.tsx`).
  2. Backend: `POST /api/scan-pay {auth_user_id, pin, bus_code, amount}` → verify PIN, debit wallet, mint ticket (mirror `bookings/create`).
  3. `scan/confirm.tsx`: pass `{bus_code, amount, route_label}` as params to `scan/pin` (currently lost — `router.push('/scan/pin')` sends nothing).
  4. `scan/pin.tsx`: replace the "any 6 digits succeeds" block with the real `/api/scan-pay` call + error handling.
  5. `scan/index.tsx`: swap the `ScanFrame` placeholder for `CameraView` + `onBarcodeScanned` → `/scan/confirm?code=`. Add `NSCameraUsageDescription`. Native rebuild `CI=1 npx expo run:ios`.
- **Files**: `app/scan/{index,confirm,pin}.tsx`, backend repo.

### Ride rating — silently lost (no offline queue + migration unrun)
- **Gate**: run `lib/supabase/migrations/051_ride_ratings.sql` in Supabase SQL editor (anon key can't do DDL). Then add rating to the offline queue.
- **Why P0**: `arrived.tsx` submits stars fire-and-forget with `.catch(()=>{})`. If the table is missing or the user is offline, the rating is gone with no feedback.
- **Build order**:
  1. Run migration `051` (creates `ride_ratings` + `route_rating_stats` view).
  2. Add `'rating'` type to `QueuedReportType` in `lib/services/offline-queue.ts`; enqueue in `processQueue`.
  3. `lib/services/ratings.ts`: NetInfo check before insert → enqueue when offline, return success-ish to UI; toast "Rating saved".
- **Files**: backend migration, `lib/services/{ratings,offline-queue}.ts`, `app/booking/arrived.tsx`.

### W13 — Bank-transfer account numbers are placeholders
- **Gate**: backend must issue real per-user virtual accounts + reconcile inbound transfers (GH₵0.25 charge, ~2 min reflect).
- **Build**: replace static partner-bank list + placeholder account in `wallet/bank-transfer.tsx` with a `GET /api/wallet/virtual-account` fetch.
- **Files**: `app/wallet/bank-transfer.tsx`, backend.

---

## 🟠 P1 — Native rebuild required

### W14 — Wallet PIN biometric (+ W10 brightness boost)
- **Gate**: `expo-local-authentication` + `expo-brightness` are lazy-required inside try/catch; inert until a dev-client rebuild bundles the native modules.
- **Build**: `CI=1 npx expo run:ios` (and `:android`); then biometric unlock in `components/PinModal.tsx` and the ticket-QR brightness boost in `wallet/ticket.tsx` go live. No code change needed beyond the rebuild — verify the lazy requires resolve.
- **Files**: native build only.

### G4 — Post-trip fare submit fire-and-forget
- **Gate**: none hard — currently by-design. Promote when offline queue (P0 rating work) lands.
- **Build**: route `updateTripFare` + `awardPointsForTrip` failures through the same offline queue; user feedback on failure.
- **Files**: `app/trip/[routeId].tsx`, `lib/services/{trips,offline-queue}.ts`.

---

## 🟡 P2 — Live data / realtime (need a data source or backend channel)

### L6 — Route-detail arrival bell (state-only)
- **Gate**: real bus GPS + notification scheduling.
- **Build**: bell registers a watch (bus + stop) → backend push when near; reuse `usePushNotifications` + `lib/services/liveActivity.ts`. Persist toggle (AsyncStorage) so it survives close.
- **Files**: `app/routes/detail.tsx`.

### T1 + T3 — Train "On Time" hardcoded, Unsplash hero photos, static FlipDigit
- **Gate**: live train telemetry (none today); Ghana rail imagery.
- **Build**: (1) show "Scheduled" + report age instead of fake green "On Time"/"LIVE"; (2) animate `FlipDigit` (renders static Text today); (3) replace Unsplash heroes in `train/[lineId].tsx` with owned imagery + `onError` gradient fallback; (4) currency consistency through the GH₵ util.
- **Files**: `app/train/{index,[lineId]}.tsx`.

### Realtime subscriptions — notifications / activity / comments
- **Gate**: backend Supabase realtime channels.
- **Note**: N1 + BU1 now refetch-on-focus (good enough for v1). True push/live-update still needs channels on `official_announcements`, notifications, `tale_comments`.
- **Files**: `lib/hooks/{useNotifications,useActivity,useComments}.ts`.

### Traffic "Flowing" label static
- **Gate**: real-time busyness freshness.
- **Build**: add `lastUpdated` badge; vary label by level instead of hardcoded "Flowing".
- **Files**: `app/traffic/status.tsx`.

---

## 🟢 P3 — Polish / scope decisions

### W10 — Offline ticket QR empty-cache edge
- If cache empty + no param → "No active ticket" even when backend has one. Fetch by id when param missing before falling back.
- **Files**: `app/wallet/ticket.tsx`.

### RW4 — Referral count stale on pull-refresh
- Count fetched once on mount; not re-fetched in `onRefresh`. Move fetch into a `useCallback` called from refresh.
- **Files**: `app/(tabs)/rewards.tsx`.

### i18n coverage — ~5 screens still English-only
- Pulse / Profile / Activity / Notifications / Bulletin not wired to `useLanguage()`.
- **Owner decision (current)**: critical screens only; broaden later, ideally alongside the planned AI native-speaker localization layer.
- **Files**: `lib/i18n/strings.ts`, the 5 screens.

---

_Last updated 2026-06-22 after re-audit pass 2. Statuses in `FEATURE_TRACKER.csv`; bug detail in `QA_FINDINGS.md`._
