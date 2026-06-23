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

### Confirm Booking — real bus/driver data (Trotro Pro)
- **Gate**: owner provides the **Trotro Pro** driver app (drivers register per bus) + its backend.
- **Why**: `app/booking/checkout.tsx` only has real From/To + Bus Fare. Mock today: bays (Bay 2 / Kejetia Market), Departs "In 5 mins", Duration "2 hr 30 mins", Seats "24 Seater", Bus Type "STC Coach", Bus Code "TRSK 235", driver "Mr John Kwame" + reviews (`DRIVER`/`REVIEWS` consts).
- **Build**: fetch the assigned vehicle + driver for the route/booking (`GET /api/buses/{code}` or `/api/routes/{id}/vehicles`); replace the hardcoded detail rows + driver card. Same lookup unblocks scan-to-pay S2/S3.
- **Files**: `app/booking/checkout.tsx`, `app/scan/confirm.tsx`, backend.

### Per-drop-off fares along a corridor (GPRTU + crowdsourced) ⭐ owner priority
- **Model (owner, 2026-06-23)**: fares are charged by **alight/drop-off point**, not one flat corridor fare. A corridor (e.g. 37 Military → Madina) has intermediate drop-offs, each with its own fare from the origin. Two fare sources: **GPRTU official** (union-set) + **crowdsourced** (riders post the fare they paid from their boarding point to their drop-off). Buses charge the same.
- **Gaps today**:
  - `route_stops` has ordered stops (name, order, distance-from-origin) but **no fare**.
  - `routes` are point-pairs so per-drop-off fares exist *as separate rows* (37→Lapaz 7.50, 37→Adenta 15.00) but aren't linked as ordered drop-offs on one corridor.
  - `fare_reports` store only `route_id + reported_fare` — **drop-off granularity is lost** (the report screen's from/to collapses to a route_id).
- **Phased build**:
  1. **Capture drop-off in reports (cheap, do first)**: add `to_stop_id` / alight to `fare_reports`; update `report/fare.tsx` to pick a drop-off; start accumulating real per-stop crowdsourced data now, before GPRTU data arrives.
  2. **Per-stop fare store**: `route_stops.official_fare` + `avg_reported_fare`, OR a `route_segment_fares(route_id, to_stop_order, official_fare, avg_reported_fare, report_count)` view/table. Fare = origin → drop-off.
  3. **GPRTU official import**: data-entry/import path for the union's official fare per drop-off ("find out the fares at each drop-off").
  4. **App**: alight picker on route detail + GO Mode → pick drop-off → show fare-to-stop; checkout charges fare-to-drop-off (replaces flat corridor fare passed today).
- **Gate**: DB migration (anon can't DDL) + the GPRTU fare data + owner sign-off on schema (route_stops column vs segment table).
- **Files**: backend migrations, `app/report/fare.tsx`, `lib/services/routes.ts`, `app/routes/detail.tsx`, `app/booking/checkout.tsx`, GO Mode alight picker (`app/trip/[routeId].tsx`).

### Multi-leg (transfer) journeys book as a single ticket
- **Gate**: backend multi-leg booking/ticketing (and Trotro Pro vehicle data per leg).
- **Why**: when no direct route exists the planner builds a transfer (legA+legB); fare is now correct end-to-end (full journey total), but only `legs[0].route_id` is carried, so the booking mints ONE ticket for leg 0 even though the rider takes 2+ trotros. Detail/checkout label it Madina→Taifa but it's structurally leg-0's route.
- **Build**: carry all legs to checkout; create a ticket per leg (or a journey with leg tickets); show the transfer hub + per-leg fares in the breakdown.
- **Files**: `lib/services/route-planner.ts`, `app/routes/detail.tsx`, `app/booking/checkout.tsx`, backend.

### Booking tax — service-fee model + GRA e-VAT (owner decision)
- **Done**: VAT-correct breakdown in checkout (Bus Fare VAT-exempt; service fee taxable, 15% VAT + 2.5% NHIL + 2.5% GETFund ≈ 20%, tax-inclusive). See [[trotromate-resume]] VAT note.
- **Open**: (1) decide service fee — flat GH₵0.25 vs a % of fare; (2) **GRA e-VAT e-invoicing**: taxable invoices must transmit to the GRA VSDC before issue (VAT Act 2025) — backend integration for go-live.
- **Files**: `app/booking/checkout.tsx` (fee model), backend (e-invoicing).

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
