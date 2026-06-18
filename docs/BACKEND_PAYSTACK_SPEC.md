# Backend Spec — Paystack wallet top-up + webhook (troski.me)

Reference handlers for the **troski.me** Next API. Powers wallet top-up (MoMo,
Ghana) and credits the Supabase ledger on confirmation. Pairs with the booking
RPC (migration 052): the same webhook also calls `confirm_booking()` for the
async MoMo booking path.

## Environment (set on troski.me / Vercel — NEVER in the Expo app)
```
PAYSTACK_SECRET_KEY=sk_test_…     # server only; rotate the one shared in chat
PAYSTACK_PUBLIC_KEY=pk_test_…     # only if the app uses Paystack inline
SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…       # to write the ledger + call the RPCs
```
Test mode: amounts in **pesewas** (GH₵ × 100). MoMo test OTP = `123456`.
Provider slugs (Ghana): `mtn`, `atl` (AirtelTigo), and Vodafone→Telecel is
historically `vod` — **VERIFY tgo→vod** in your dashboard.

## 1) POST /api/wallet/topup  — start a MoMo charge
```ts
// app momo.tsx already POSTs { auth_user_id, amount, provider, phone }
export async function POST(req: Request) {
  const { auth_user_id, amount, provider, phone } = await req.json()
  const email = await emailForUser(auth_user_id) // any stable email works in test

  const slug = ({ mtn: 'mtn', atl: 'atl', tgo: 'vod' } as const)[provider] ?? 'mtn' // VERIFY

  const res = await fetch('https://api.paystack.co/charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amount) * 100), // pesewas
      currency: 'GHS',
      mobile_money: { phone, provider: slug },
      metadata: { auth_user_id, purpose: 'wallet_topup' },
    }),
  })
  const data = await res.json()
  // data.data.reference is the charge ref; data.data.status may be
  // 'send_otp' | 'pay_offline' | 'success'. Return it so the app can prompt
  // for OTP / show "approve on your phone". DO NOT credit here — wait for the
  // webhook. Persist reference→auth_user_id (pending) for reconciliation.
  return Response.json({ reference: data?.data?.reference, status: data?.data?.status })
}
```

(If `status === 'send_otp'`, the app submits the OTP via
`POST https://api.paystack.co/charge/submit_otp { otp, reference }`. Test OTP
`123456`.)

## 2) POST /api/webhooks/paystack  — confirm + credit (the part that matters)
```ts
import crypto from 'crypto'

export async function POST(req: Request) {
  const raw = await req.text() // RAW body — needed for the signature
  const sig = req.headers.get('x-paystack-signature') || ''
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(raw)
    .digest('hex')
  if (sig !== expected) return new Response('bad signature', { status: 401 })

  const evt = JSON.parse(raw)
  if (evt.event !== 'charge.success') return new Response('ignored', { status: 200 })

  const ref = evt.data.reference
  const authUserId = evt.data.metadata?.auth_user_id
  const amountGhs = evt.data.amount / 100

  // Canonical schema (migration 053): the wallet IS the user (auth_user_id);
  // balance = sum(wallet_transactions.amount). No separate wallet id to resolve.
  // IDEMPOTENCY: unique index on provider_ref — a repeated charge.success must
  // not double-credit (ignore on conflict).
  await sb.from('wallet_transactions').insert({
    auth_user_id: authUserId,
    amount: amountGhs,            // credit (+)
    type: 'topup',
    provider: 'paystack',
    provider_ref: ref,           // unique → idempotent
    status: 'success',
  }) // ignore on conflict (provider_ref)

  // If this charge was for a booking (metadata.booking_id), issue the ticket:
  if (evt.data.metadata?.booking_id) {
    await sb.rpc('confirm_booking', {
      p_booking_id: evt.data.metadata.booking_id,
      p_provider_ref: ref,
    })
  }
  return new Response('ok', { status: 200 })
}
```

## Security / correctness checklist
- **Verify the signature** on every webhook (HMAC-SHA512 of the raw body with the
  secret). Reject mismatches — never trust an unverified webhook to credit money.
- **Idempotency**: unique `provider_ref` on `wallet_transactions`; a repeated
  `charge.success` must not double-credit.
- **Never credit in `/topup`** — only the webhook (server-confirmed) credits.
- **Secret stays server-side.** The app only ever calls your endpoints.
- Respond `200` quickly; do heavy work async if needed (Paystack retries non-2xx).

## Test run
1. App → `/api/wallet/topup` (amount, provider mtn, test phone).
2. Submit OTP `123456` if `send_otp`.
3. Paystack fires `charge.success` → webhook verifies → credits
   `wallet_transactions` → app's `/api/wallet/balance` reflects the new balance.
4. Booking MoMo path: same webhook calls `confirm_booking` → ticket issued.

⚠️ Blocked on the real `wallet_transactions` columns (and the booking-RPC fix) —
see the VERIFY notes. Run the info-schema query to confirm columns.
