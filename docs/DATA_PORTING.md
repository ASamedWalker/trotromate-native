# Data Porting Strategy — Mock → Real

Living plan for moving the app off mock/placeholder data. Updated 2026-06-16.

## TL;DR
The mock footprint is **not** spread across the whole app. Routes, fares, train
schedules, rewards, wallet balance/transactions, and the newly built **Queue
Status** + **Terminals** screens are already real data. The remaining mock
clusters in three places, and one of them (**booking**) is the keystone that
unblocks the others:

1. **Booking flow** — checkout/processing/receipt/arrived (driver, ticket, fare)
2. **Wallet "Active Pass"** — a ticket/pass, which booking produces
3. **Deferred Figma screens** — Terminal Bay Status, Traffic Status

## Inventory

| Screen / area | Today | Real source | Gap |
|---|---|---|---|
| Routes list + detail (fares) | ✅ real | `routes` + `route_fare_stats` | none |
| Train schedules + timeline | ✅ real | `TRAIN_SCHEDULES` + `train_lines` | none (static schedule, by design) |
| Queue Status (new) | ✅ real | `queue_reports` | none |
| Terminals list (new) | ✅ real | `stations` + `routes` + `queue_reports` + GPS | none |
| Rewards (coins/streak/history) | ✅ real | `contributor_profiles` + `points_history` | none |
| Wallet balance + transactions | ✅ real | `/api/wallet/balance` | none |
| Fare / queue / incident / train reports | ✅ real | `*_reports` tables | none |
| **Booking — checkout** | ❌ mock | `DRIVER`, `REVIEWS`, `VERIFY_ITEMS` | **booking backend** |
| **Booking — receipt** | ❌ mock | `TICKET` (ref, QR, seat, fare, KSH→KSI) | **booking backend** |
| **Booking — arrived** | ⚠️ mock on booking path | `DRIVER`, `STATS` (GO path is real) | **booking backend** |
| **Wallet — Active Pass** | ❌ mock | `Madina → Circle`, 12 trips, expiry | **passes model (from booking)** |
| Terminal detail — Bay Status | ❌ not built | bays/seats/departs/pay | **terminal-ops backend** (hardest) |
| Traffic Status | ❌ not built | `/api/traffic/*` (Google Routes) | mostly **frontend** (API exists) |
| `POPULAR_STATIONS` (driver, plan) | ⚠️ static | could derive from `usePopularRoutes` | optional, low priority |

## Database snapshot (2026-06-16, anon-key probe)
Real data is healthier than assumed, and a **booking/ticket schema already
exists**:

| Table | Rows | Note |
|---|---|---|
| contributor_profiles | 1,666 | real users |
| routes / route_stops / stations / transport_stops | 293 / 561 / 98 / 2,387 | full graph |
| fare_reports | 292 | crowdsourced fares |
| points_history / contributor_badges / badges | 569 / 155 / 10 | rewards live |
| completed_trips | 62 | GO trips |
| traffic_cache | 168 | **Google traffic cached — backs Traffic Status** |
| train_lines / train_stations / train_reports | 3 / 22 / 4 | trains |
| queue_reports | 20 | queues (older) |
| **tickets** | **12** | real schema, see below |
| **bookings** | 0 | table exists, empty |
| **wallet_transactions** | 0 | table exists, empty |
| ride_ratings | 3 | ⚠️ our 3 test rows — cleanup SQL still un-run |
| driver_profiles / driver_trips / safety_ratings | 1 / 0 / 0 | no real driver pool |
| vehicle_positions | 8 | live GPS sparse (Terminals "live" rarely fires) |
| passes / terminals / terminal_bays / wallets | — | **do not exist** |

**`tickets` columns:** `id, trip_code, route_label, van_plate, fare, currency,
status (active/used/expired), expires_at, used_at, buyer_wallet_id,
wallet_transaction_id, fleet_transaction_id, booking_id, booked_by_phone,
booking_source (app/whatsapp), auth_user_id, created_at`.

Sample: `TRK-367G · Madina → Circle · GHS 8 · expired · whatsapp`. The wallet
"Active Pass" mock (`Madina → Circle`, 12 trips) is literally modelled on these.

**Implications (revise the phases):**
- **Active Pass = real now.** It's `tickets WHERE status='active'` for the user
  — table + data exist, no backend. A "pass" is not a separate model; it's an
  active ticket (single trip_code, not a trips-left counter — drop the "12 TRIPS
  LEFT" framing or back it with a real multi-use field if one is added).
- Identity: users are keyed by **`auth_user_id`**; tickets join via
  `buyer_wallet_id` / `auth_user_id`. To read a user's pass we need their wallet
  id (from the wallet endpoint) or `auth_user_id` populated on new tickets
  (currently null on the legacy/test rows).
- **Receipt** can *read* a real ticket; only ticket *creation* (debit wallet +
  issue ticket atomically) still needs a backend endpoint.
- **Traffic Status** has 168 cached rows to render today.

## Backend reality
The app talks to a PWA/Next API (troski.me). Endpoints that **exist today**:
`/api/wallet/balance`, `/api/wallet/topup`, `/api/traffic/{routeId}`,
`/api/traffic/summary`, `/api/addresses`, plus Expo push. **No booking, ticket,
pass, or terminal-ops endpoints exist yet.** Backend work happens in that repo;
the mobile side is mostly waiting on **data contracts**, not UI — the booking
screens were already built to *receive* real data.

## Strategy — phased by dependency

### Phase 0 — Data contracts (do first, cheap, unblocks parallel work)
Agree the shapes before building either side, so frontend + backend move in
parallel:
- `booking` (create → assign vehicle/driver → status), `ticket`
  (ref, qr_payload, seat, fare, from/to, status), `pass` (route, trips_left,
  expires_at), and later `terminal_bay`.
Write them as TypeScript types in `lib/types` + matching Supabase
tables/migrations. Frontend can wire against the types with a stub immediately.

### Phase 1 — Port what needs NO new backend (quick wins)
- **Active Pass**: stop showing the fake `Madina → Circle` pass. Either hide the
  card when the user has no pass (honest empty state) or back it by the passes
  table once Phase 2 lands. Lowest effort, removes the most visible mock.
- **`POPULAR_STATIONS`**: derive from `usePopularRoutes()` instead of the static
  array (optional polish).
- **Traffic Status screen**: build it against the existing `/api/traffic/summary`
  (Google Routes) — this is the one "deferred Figma" screen that's mostly
  frontend, since the data API already exists.

### Phase 2 — Booking backend (the keystone)
Design `bookings` + `tickets` tables + `/api/booking` (create, get, cancel).
Then wire the existing screens to real data:
- checkout: real driver/vehicle assignment (or "searching…" until assigned)
- receipt: real ticket (ref, QR payload, seat, fare) — replaces `TICKET`
- arrived: real ride stats + driver on the booking path
Ratings already persist against this flow (`ride_ratings`), so the trust loop
closes automatically once bookings are real.

### Phase 3 — Passes (falls out of booking)
A multi-trip pass is just a booking variant → wire wallet **Active Pass** to the
passes table. No new concept once Phase 2 exists.

### Phase 4 — Terminal Bay Status (hardest, needs a live ops feed)
Bay/seat/departs/pay data has no source today and isn't crowdsourceable like
queues. Needs a terminal-operations partnership (GPRTU / terminal operators) or
a staff-facing input app. Treat as a separate initiative; keep the terminal
detail deferred until that data exists rather than shipping mock bays.

## Recommended order
**Phase 0 contracts → Phase 1 quick wins (Active Pass honesty + Traffic Status)
→ Phase 2 booking backend → Phase 3 passes.** Phase 4 is a parallel
business/data track, not a frontend task.
