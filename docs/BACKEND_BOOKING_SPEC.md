# Backend Spec — Booking & Ticketing (Phase 2 keystone)

For the **troski.me** (PWA/Next API) repo. Unblocks the mobile booking flow
(`checkout → processing → receipt`) which is built to receive real data. Tables
`bookings`, `tickets`, `wallet_transactions` already exist in Supabase (tickets
has 12 rows; bookings/wallet_transactions empty). Frontend contract lives in
`lib/services/booking.ts`.

## The one endpoint that matters
A single **atomic** create-booking call that debits the wallet and issues a
ticket, or fails cleanly with no side effects.

```
POST /api/booking
body: {
  auth_user_id: string,
  route_id: string,
  from_location: string,
  to_location: string,
  fare: number,            // GH₵, the real route fare the app showed
  service_fee: number,     // platform fee shown at checkout
  payment_method: 'wallet' | 'momo',
  momo_provider?: 'mtn' | 'atl' | 'tgo',   // when payment_method='momo'
}
→ 200 {
  booking_id: string,
  ticket: {
    trip_code: string,         // "TRO-XXXX-XXXX"
    route_label: string,       // "Kaneshie → Kumasi"
    van_plate: string | null,  // null until a vehicle is assigned
    fare: number,
    currency: 'GHS',
    status: 'active',
    expires_at: string | null, // ISO
    qr_payload: string,        // what the QR encodes (default: trip_code)
  }
}
→ 402 { error: 'insufficient_funds', balance, required }   // wallet path
→ 409 { error: 'momo_pending', booking_id }                // momo: await USSD approval
```

## Atomicity (must be a single DB transaction)
1. Resolve wallet from `auth_user_id` (same mapping as `/api/wallet/balance`).
2. **Wallet path:** check balance ≥ fare+service_fee → insert `wallet_transactions`
   (debit) → insert `bookings` → insert `tickets` (status `active`,
   `booking_source='app'`, `auth_user_id` set, `buyer_wallet_id`,
   `wallet_transaction_id`, `booking_id`, `expires_at`). Commit. If any step
   fails, roll back entirely — never issue a ticket without a matching debit.
3. **MoMo path:** create `bookings` as `pending`, trigger the USSD charge via the
   payment aggregator (Hubtel/Paystack/Flutterwave — TBD), and only issue the
   ticket on the provider's success webhook. Return 409 `momo_pending`; the app
   polls / gets pushed the ticket when it clears.

## Tables (confirm/extend — they already exist)
- **tickets** (existing): `trip_code, route_label, van_plate, fare, currency,
  status (active|used|expired), expires_at, used_at, buyer_wallet_id,
  wallet_transaction_id, fleet_transaction_id, booking_id, booked_by_phone,
  booking_source, auth_user_id, created_at`. ✅ matches the app.
- **bookings** (exists, empty): expected `id, auth_user_id, route_id,
  from_location, to_location, fare, service_fee, payment_method, status
  (pending|paid|cancelled), created_at`. Confirm columns.
- **wallet_transactions** (exists, empty): debit/credit ledger; a booking debit
  links to the ticket via `wallet_transaction_id`.

## Driver / vehicle
`driver_profiles` has 1 row — there is **no real driver pool**. So:
- `van_plate` stays `null` until a vehicle is actually assigned; the app shows
  "Vehicle being assigned" rather than a fake driver.
- The checkout **driver card + reviews are still mock** (`app/booking/checkout.tsx`)
  and stay deferred until a driver/fleet model exists. Don't block booking on it.

## Security / RLS (do alongside)
- `tickets`, `bookings`, `wallet_transactions` must **not** be anon-readable
  (see BACKEND_PASSES_SPEC.md — tickets is currently wide open incl. phone PII).
  All reads go through authenticated endpoints; writes happen server-side only.

## Done-when
- `POST /api/booking` (wallet path, funded user) returns a real ticket; the app's
  receipt renders it (trip_code, route, fare, expiry, QR) with zero mock.
- Wallet balance drops by fare+fee; `tickets`/`bookings`/`wallet_transactions`
  rows created and linked.
- Insufficient funds returns 402 and issues nothing.

## How to build it (decided)
Atomicity lives in **one Postgres function**, wrapped by the existing Next API.
- **`create_booking()` RPC** — draft in `lib/supabase/migrations/052_booking_rpc.sql`.
  Single transaction: lock the wallet ledger → check funds → debit
  `wallet_transactions` → insert `bookings` → insert `tickets`. All-or-nothing.
  `confirm_booking()` issues the ticket for the async MoMo path from the webhook.
- **`/api/booking` Next route** (troski.me) — authenticates, resolves
  `auth_user_id → buyer_wallet_id` (it already does this for balance), then calls
  the RPC with the **service role** (the RPC is revoked from anon/authenticated).
  Keeps the payment-gateway secret server-side; the app keeps calling
  `/api/booking` (no client change).
- **Why RPC, not client inserts:** a crash mid-flow must never leave a ticket
  without a debit. Only a DB transaction guarantees that; the function is that
  transaction.

⚠️ **Before running 052:** `bookings` + `wallet_transactions` are backend-owned;
their columns in the migration are `-- VERIFY:` assumptions. Confirm the real
column names (and that balance = `sum(wallet_transactions.amount)` in Supabase,
not troski.me's own DB) before deploying. `tickets` columns are verified.

## Frontend status (this repo)
- `lib/services/booking.ts` — typed `createBooking()` against the contract above.
- checkout passes `route_id` + the **real route fare** (no more hardcoded 25.0).
- Wiring `confirm → createBooking → receipt(real ticket)` is a fast follow once
  the endpoint exists; until then checkout runs the existing demo flow.
