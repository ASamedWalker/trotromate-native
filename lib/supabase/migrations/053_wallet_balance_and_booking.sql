-- ============================================================
-- 053: Canonical wallet + booking model (supersedes draft 052)
--
-- Decision (owner, 2026-06-18): the wallet balance is NOT a stored field and
-- NOT in troski.me — it is DERIVED from public.wallet_transactions in Supabase
-- (sum of signed amounts). The only wallet table is wallet_transactions. The old
-- in-app balance was a mockup.
--
-- Because wallet_transactions / bookings / fleet_transactions are EMPTY (0 rows)
-- and the old data was mock, we DEFINE their schema here instead of guessing.
-- `tickets` (12 real rows) is left intact and reused.
--
-- A user's wallet == their auth_user_id (no separate wallet-account table).
-- Balance = sum(amount where status='success'). Credits +, debits -.
-- ============================================================

-- Remove the broken 052 function overloads (different arg lists would otherwise
-- linger alongside the new ones).
drop function if exists public.create_booking(uuid,uuid,uuid,text,text,numeric,numeric,text);
drop function if exists public.confirm_booking(uuid,uuid,text);

-- ---------- wallet_transactions (recreate; empty, no data loss) ----------
drop table if exists public.wallet_transactions cascade;
create table public.wallet_transactions (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  amount       numeric(12,2) not null,                 -- + credit, - debit
  type         text not null check (type in ('topup','booking_debit','refund','adjustment')),
  provider     text,                                   -- 'paystack', etc.
  provider_ref text,                                   -- charge ref; unique → idempotent credits
  description  text,
  status       text not null default 'success' check (status in ('pending','success','failed')),
  created_at   timestamptz not null default now()
);
create index idx_wtx_user on public.wallet_transactions(auth_user_id);
create unique index uq_wtx_provider_ref on public.wallet_transactions(provider_ref) where provider_ref is not null;

-- ---------- bookings (recreate; empty, no data loss) ----------
drop table if exists public.bookings cascade;
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null,
  route_id       uuid references public.routes(id),
  from_location  text not null,
  to_location    text not null,
  fare           numeric(12,2) not null,
  service_fee    numeric(12,2) not null default 0,
  payment_method text not null check (payment_method in ('wallet','momo')),
  status         text not null default 'pending' check (status in ('pending','paid','cancelled')),
  created_at     timestamptz not null default now()
);
create index idx_bookings_user on public.bookings(auth_user_id);

-- ---------- balance (derived) ----------
create or replace function public.get_wallet_balance(p_auth_user_id uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)
  from public.wallet_transactions
  where auth_user_id = p_auth_user_id and status = 'success';
$$;

-- ---------- create_booking: atomic debit + booking + ticket ----------
create or replace function public.create_booking(
  p_auth_user_id uuid,
  p_route_id     uuid,
  p_from         text,
  p_to           text,
  p_fare         numeric,
  p_service_fee  numeric,
  p_payment      text                       -- 'wallet' | 'momo'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total   numeric := coalesce(p_fare,0) + coalesce(p_service_fee,0);
  v_balance numeric;
  v_booking uuid;
  v_txn     uuid;
  v_code    text;
  v_status  text := case when p_payment = 'wallet' then 'paid' else 'pending' end;
begin
  if p_payment not in ('wallet','momo') then
    raise exception 'bad_payment_method' using errcode = 'P0001';
  end if;

  -- Serialize per user so two taps can't double-spend the same balance.
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));

  if p_payment = 'wallet' then
    v_balance := get_wallet_balance(p_auth_user_id);
    if v_balance < v_total then
      raise exception 'insufficient_funds' using errcode = 'P0001';
    end if;
    insert into public.wallet_transactions(auth_user_id, amount, type, description, status)
      values (p_auth_user_id, -v_total, 'booking_debit', p_from || ' → ' || p_to, 'success')
      returning id into v_txn;
  end if;

  insert into public.bookings(auth_user_id, route_id, from_location, to_location, fare, service_fee, payment_method, status)
    values (p_auth_user_id, p_route_id, p_from, p_to, p_fare, p_service_fee, p_payment, v_status)
    returning id into v_booking;

  if p_payment = 'wallet' then
    v_code := 'TRO-' || upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4));
    insert into public.tickets(trip_code, route_label, van_plate, fare, currency, status,
                               buyer_wallet_id, wallet_transaction_id, booking_id,
                               auth_user_id, booking_source, expires_at)
      values (v_code, p_from || ' → ' || p_to, null, p_fare, 'GHS', 'active',
              p_auth_user_id, v_txn, v_booking,
              p_auth_user_id, 'app', now() + interval '2 hours');
  end if;

  return jsonb_build_object(
    'booking_id', v_booking,
    'status', v_status,
    'ticket', (select to_jsonb(t) from public.tickets t where t.booking_id = v_booking)
  );
end;
$$;

-- ---------- confirm_booking: issue ticket for the async MoMo path ----------
create or replace function public.confirm_booking(
  p_booking_id uuid,
  p_provider_ref text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype; v_code text;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode='P0001'; end if;
  if v_b.status = 'paid' then  -- idempotent
    return (select to_jsonb(t) from public.tickets t where t.booking_id = p_booking_id);
  end if;

  update public.bookings set status = 'paid' where id = p_booking_id;
  v_code := 'TRO-' || upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4));
  insert into public.tickets(trip_code, route_label, fare, currency, status,
                             buyer_wallet_id, fleet_transaction_id, booking_id,
                             auth_user_id, booking_source, expires_at)
    values (v_code, v_b.from_location || ' → ' || v_b.to_location, v_b.fare, 'GHS', 'active',
            v_b.auth_user_id, p_provider_ref, p_booking_id,
            v_b.auth_user_id, 'app', now() + interval '2 hours');

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'paid',
    'ticket', (select to_jsonb(t) from public.tickets t where t.booking_id = p_booking_id));
end;
$$;

-- ---------- RLS: users read their own rows; all writes are server-side ----------
alter table public.wallet_transactions enable row level security;
alter table public.bookings enable row level security;

create policy "read own wallet tx" on public.wallet_transactions
  for select using (auth.uid() = auth_user_id);
create policy "read own bookings" on public.bookings
  for select using (auth.uid() = auth_user_id);
-- no insert/update/delete policies → only the service role (and the SECURITY
-- DEFINER functions) can write. Clients can never mint money or tickets.

-- ---------- Grants: money functions are service-role ONLY ----------
-- revoke from PUBLIC too (the default grant) — this was the hole in 052.
revoke all on function public.create_booking(uuid,uuid,text,text,numeric,numeric,text) from public;
revoke all on function public.confirm_booking(uuid,text) from public;
revoke all on function public.get_wallet_balance(uuid) from public;
