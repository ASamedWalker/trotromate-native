-- ============================================================
-- 052: Booking RPC — atomic "debit wallet + issue ticket"
--
-- DRAFT for the backend owner. bookings / tickets / wallet_transactions are
-- backend-owned tables (created outside this repo). `tickets` columns below are
-- VERIFIED from live rows; `bookings` and `wallet_transactions` columns are
-- ASSUMPTIONS marked `-- VERIFY:` — confirm against the real schema before
-- running. Do NOT blind-push.
--
-- Design (see docs/BACKEND_BOOKING_SPEC.md):
--  * Atomicity lives in ONE Postgres function = one transaction. Wallet debit,
--    booking row, and ticket are all-or-nothing.
--  * Identity→wallet is resolved by the CALLER (the /api/wallet/* layer already
--    maps auth_user_id→wallet for balance), then passed in as p_buyer_wallet_id.
--    That avoids guessing where the wallet account lives.
--  * Wallet path is synchronous + atomic. MoMo path creates a pending booking
--    and issues the ticket later via confirm_booking() from the payment webhook.
-- ============================================================

create or replace function public.create_booking(
  p_auth_user_id   uuid,
  p_buyer_wallet_id uuid,      -- resolved by the caller (Next /api layer)
  p_route_id       uuid,
  p_from           text,
  p_to             text,
  p_fare           numeric,
  p_service_fee    numeric,
  p_payment        text        -- 'wallet' | 'momo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- ---- Wallet path: lock the ledger, check funds, debit (all in this txn) ----
  if p_payment = 'wallet' then
    -- VERIFY: wallet_transactions has (wallet_id uuid, amount numeric signed:
    -- credits +, debits -). Lock this wallet's rows to prevent double-spend.
    perform 1 from public.wallet_transactions
      where wallet_id = p_buyer_wallet_id for update;

    select coalesce(sum(amount), 0) into v_balance
      from public.wallet_transactions
      where wallet_id = p_buyer_wallet_id;

    if v_balance < v_total then
      raise exception 'insufficient_funds' using errcode = 'P0001';
    end if;

    insert into public.wallet_transactions (wallet_id, amount, type, description)  -- VERIFY columns
      values (p_buyer_wallet_id, -v_total, 'booking_debit', p_from || ' → ' || p_to)
      returning id into v_txn;
  end if;

  -- ---- Booking row ----
  -- VERIFY: bookings columns (auth_user_id, route_id, from_location,
  -- to_location, fare, service_fee, payment_method, status).
  insert into public.bookings (
    auth_user_id, route_id, from_location, to_location,
    fare, service_fee, payment_method, status
  ) values (
    p_auth_user_id, p_route_id, p_from, p_to,
    p_fare, p_service_fee, p_payment, v_status
  ) returning id into v_booking;

  -- ---- Ticket (only when actually paid; momo issues later) ----
  if p_payment = 'wallet' then
    v_code := 'TRO-' || upper(substr(md5(random()::text), 1, 4))
                     || '-' || upper(substr(md5(random()::text), 1, 4));
    -- tickets columns VERIFIED from live data.
    insert into public.tickets (
      trip_code, route_label, van_plate, fare, currency, status,
      buyer_wallet_id, wallet_transaction_id, booking_id,
      auth_user_id, booking_source, expires_at
    ) values (
      v_code, p_from || ' → ' || p_to, null, p_fare, 'GHS', 'active',
      p_buyer_wallet_id, v_txn, v_booking,
      p_auth_user_id, 'app', now() + interval '2 hours'
    );
  end if;

  return jsonb_build_object(
    'booking_id', v_booking,
    'status', v_status,
    'ticket', (
      select to_jsonb(t) from public.tickets t where t.booking_id = v_booking
    )
  );
end;
$$;

-- ---- MoMo confirmation: issue the ticket once the provider webhook fires ----
create or replace function public.confirm_booking(
  p_booking_id uuid,
  p_buyer_wallet_id uuid,
  p_fleet_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings%rowtype;
  v_code text;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found' using errcode='P0001'; end if;
  if v_b.status = 'paid' then
    -- idempotent: already confirmed, return existing ticket
    return (select to_jsonb(t) from public.tickets t where t.booking_id = p_booking_id);
  end if;

  update public.bookings set status = 'paid' where id = p_booking_id;

  v_code := 'TRO-' || upper(substr(md5(random()::text), 1, 4))
                   || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into public.tickets (
    trip_code, route_label, fare, currency, status,
    buyer_wallet_id, fleet_transaction_id, booking_id,
    auth_user_id, booking_source, expires_at
  ) values (
    v_code, v_b.from_location || ' → ' || v_b.to_location, v_b.fare, 'GHS', 'active',
    p_buyer_wallet_id, p_fleet_transaction_id, p_booking_id,
    v_b.auth_user_id, 'app', now() + interval '2 hours'
  );

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'paid',
    'ticket', (select to_jsonb(t) from public.tickets t where t.booking_id = p_booking_id));
end;
$$;

-- Callable only by the service role (the /api layer), never anon/auth directly,
-- so balance/debit logic can't be invoked client-side.
revoke all on function public.create_booking(uuid,uuid,uuid,text,text,numeric,numeric,text) from anon, authenticated;
revoke all on function public.confirm_booking(uuid,uuid,text) from anon, authenticated;
