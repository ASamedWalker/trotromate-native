# troski.me API — drop-in endpoint reference

Single reference for the four endpoints the mobile app needs from the troski.me
(Next) backend to take wallet + booking off mock. All read/write the **Supabase**
ledger (migration 053) via the **service role**. Mirrors the contracts the app
already calls (`lib/services/booking.ts`, `lib/services/tickets.ts`,
`app/(tabs)/wallet.tsx`, `app/wallet/momo.tsx`).

## Model recap (migration 053)
- Wallet **is the user** (`auth_user_id`). No wallet-account table.
- **Balance = `get_wallet_balance(auth_user_id)`** = `sum(wallet_transactions.amount where status='success')`.
- Credits (+) from topups; debits (−) from bookings. Amounts in **GH₵** (decimal).
- `create_booking()` / `confirm_booking()` / `get_wallet_balance()` are
  **service-role only** — never callable from the app/anon.

## Shared setup
```ts
import { createClient } from '@supabase/supabase-js'
// service role — server only; bypasses RLS to read/write the ledger + call RPCs
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
```
```
env (troski.me / Vercel — NEVER in the Expo bundle):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  PAYSTACK_SECRET_KEY=sk_test_…   (rotate the one shared in chat)
  PAYSTACK_PUBLIC_KEY=pk_test_…   (only if app uses inline)
```
Paystack: amounts in **pesewas** (GH₵ × 100). Test MoMo OTP `123456`.
Provider slugs: `mtn`, `atl`, and Vodafone→Telecel historically `vod` (VERIFY `tgo→vod`).

---

## 1) GET /api/wallet/balance?auth_user_id=…
Returns balance + transactions + active passes. (Replaces the mock that returns 66.)
```ts
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('auth_user_id')
  if (!id) return Response.json({ error: 'Invalid user' }, { status: 400 })
  const { data: balance } = await sb.rpc('get_wallet_balance', { p_auth_user_id: id })
  const [{ data: transactions }, { data: passes }] = await Promise.all([
    sb.from('wallet_transactions').select('*').eq('auth_user_id', id).order('created_at', { ascending: false }),
    sb.from('tickets').select('trip_code, route_label, van_plate, fare, currency, status, expires_at')
      .eq('auth_user_id', id).eq('status', 'active'),
  ])
  return Response.json({ balance: balance ?? 0, transactions: transactions ?? [], passes: passes ?? [] })
}
```

## 2) POST /api/wallet/topup
Starts a Paystack MoMo charge. **Credits nothing here** — the webhook does, after success.
```ts
export async function POST(req: Request) {
  const { auth_user_id, amount, provider, phone } = await req.json()
  const slug = ({ mtn: 'mtn', atl: 'atl', tgo: 'vod' } as const)[provider] ?? 'mtn' // VERIFY
  const res = await fetch('https://api.paystack.co/charge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: await emailForUser(auth_user_id),       // any stable email in test
      amount: Math.round(Number(amount) * 100),       // pesewas
      currency: 'GHS',
      mobile_money: { phone, provider: slug },
      metadata: { auth_user_id, purpose: 'wallet_topup' },
    }),
  })
  const data = await res.json()
  // status: 'send_otp' | 'pay_offline' | 'success'. Persist reference→auth_user_id (pending).
  return Response.json({ reference: data?.data?.reference, status: data?.data?.status })
}
// send_otp → app posts to https://api.paystack.co/charge/submit_otp { otp, reference } (test OTP 123456)
```

## 3) POST /api/webhooks/paystack
Verifies signature → credits the wallet (idempotent) → issues a booking ticket if applicable.
```ts
import crypto from 'crypto'
export async function POST(req: Request) {
  const raw = await req.text()                                   // RAW body for the signature
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex')
  if (req.headers.get('x-paystack-signature') !== expected) return new Response('bad signature', { status: 401 })

  const evt = JSON.parse(raw)
  if (evt.event !== 'charge.success') return new Response('ignored', { status: 200 })

  const ref = evt.data.reference
  const authUserId = evt.data.metadata?.auth_user_id
  const amountGhs = evt.data.amount / 100

  // idempotent: unique index on wallet_transactions.provider_ref
  await sb.from('wallet_transactions').insert({
    auth_user_id: authUserId, amount: amountGhs, type: 'topup',
    provider: 'paystack', provider_ref: ref, status: 'success',
  })

  if (evt.data.metadata?.booking_id) {
    await sb.rpc('confirm_booking', { p_booking_id: evt.data.metadata.booking_id, p_provider_ref: ref })
  }
  return new Response('ok', { status: 200 })   // 2xx fast; Paystack retries non-2xx
}
```

## 4) POST /api/booking
Atomic debit + booking + ticket via the RPC. (App calls this; see `lib/services/booking.ts`.)
```ts
export async function POST(req: Request) {
  const b = await req.json() // { auth_user_id, route_id, from_location, to_location, fare, service_fee, payment_method, momo_provider? }

  if (b.payment_method === 'wallet') {
    const { data, error } = await sb.rpc('create_booking', {
      p_auth_user_id: b.auth_user_id, p_route_id: b.route_id,
      p_from: b.from_location, p_to: b.to_location,
      p_fare: b.fare, p_service_fee: b.service_fee, p_payment: 'wallet',
    })
    if (error?.message?.includes('insufficient_funds')) {
      const balance = await sb.rpc('get_wallet_balance', { p_auth_user_id: b.auth_user_id })
      return Response.json({ error: 'insufficient_funds', balance: balance.data, required: b.fare + b.service_fee }, { status: 402 })
    }
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json(data)   // { booking_id, status:'paid', ticket:{…} }
  }

  // MoMo: create a pending booking, then charge; ticket issues on the webhook.
  const { data } = await sb.rpc('create_booking', {
    p_auth_user_id: b.auth_user_id, p_route_id: b.route_id,
    p_from: b.from_location, p_to: b.to_location,
    p_fare: b.fare, p_service_fee: b.service_fee, p_payment: 'momo',
  })
  const charge = await fetch('https://api.paystack.co/charge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: await emailForUser(b.auth_user_id),
      amount: Math.round((b.fare + b.service_fee) * 100), currency: 'GHS',
      mobile_money: { phone: b.phone, provider: ({ mtn:'mtn', atl:'atl', tgo:'vod' } as any)[b.momo_provider] },
      metadata: { auth_user_id: b.auth_user_id, booking_id: data.booking_id, purpose: 'booking' },
    }),
  }).then(r => r.json())
  return Response.json({ status: 'momo_pending', booking_id: data.booking_id, reference: charge?.data?.reference }, { status: 409 })
}
```

## Security checklist
- Service-role key + Paystack secret are **server-only**. Never in the app.
- **Verify** every Paystack webhook signature. Reject mismatches.
- **Idempotency**: unique `provider_ref` on `wallet_transactions`.
- Credit **only** on webhook (server-confirmed), never in `/topup` or the app.
- `create_booking`/`confirm_booking`/`get_wallet_balance` stay revoked from
  public/anon/authenticated — only this server (service role) calls them.

## Go-live order
1. `/api/wallet/balance` → `get_wallet_balance` (fixes the stuck "66" → real 0).
2. `/api/wallet/topup` + `/api/webhooks/paystack` (Paystack test) → add money works.
3. `/api/booking` → `create_booking` → booking issues a real ticket + debit.
