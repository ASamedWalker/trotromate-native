# Backend Spec — Active Passes (Wallet)

For the **troski.me** (PWA/Next API) repo. The mobile app's Wallet "Active Pass"
card is now wired to consume this; until the endpoint returns `passes`, the card
is hidden (honest empty state). Frontend contract lives in
`lib/services/tickets.ts`.

## 1. Endpoint
Prefer **extending the existing** wallet endpoint so passes load with
balance/transactions in one authenticated round-trip:

```
GET /api/wallet/balance?auth_user_id=<uuid>
→ { balance, transactions, passes: ActivePass[] }
```

(Or a sibling `GET /api/wallet/passes?auth_user_id=<uuid> → ActivePass[]` if you
prefer separation. The app reads `data.passes`; a sibling endpoint just needs a
second fetch.)

## 2. ActivePass shape (must match the app)
```ts
interface ActivePass {
  trip_code: string        // e.g. "TRO-25LM-WP67"
  route_label: string      // "Madina → Circle"
  van_plate: string | null // "GR-4582-50"
  fare: number             // 8
  currency: string         // "GHS"
  status: 'active'         // only active are returned
  expires_at: string | null // ISO; app hides expired defensively too
}
```

## 3. Resolution logic
1. Resolve the wallet from `auth_user_id` (same mapping already used for
   `balance`). **`buyer_wallet_id` is the authoritative join** — not
   `auth_user_id` on the ticket (that column is null on legacy/WhatsApp rows).
2. Query:
   ```sql
   select trip_code, route_label, van_plate, fare, currency, status, expires_at
   from tickets
   where buyer_wallet_id = :wallet_id
     and status = 'active'
     and (expires_at is null or expires_at > now())
   order by expires_at asc nulls last;
   ```
3. Return the array as `passes` (empty array if none).

## 4. Also: stamp identity on app-issued tickets
When the booking/ticketing flow issues a ticket for an **app** user, set
`auth_user_id` on the ticket row (currently null). Not required for this read
path (it uses `buyer_wallet_id`), but it makes per-user queries, analytics, and
any future direct reads correct.

## 5. SECURITY — tighten `tickets` RLS (do this regardless)
Right now the **anon key can SELECT every row in `tickets`** (trip_code, route,
fare, and `booked_by_phone` PII for all users). Lock it down:
- Revoke anon SELECT on `tickets`.
- Reads should go through this server endpoint (service role), or be restricted
  by RLS to `auth_user_id = auth.uid()` for authenticated users.
- Same audit for `bookings` / `wallet_transactions`.

## 6. Done-when
- `GET /api/wallet/balance?auth_user_id=<a user with an active ticket>` returns a
  non-empty `passes` array → the app's Active Pass card renders automatically.
- Anon `SELECT * from tickets` no longer returns other users' rows.
