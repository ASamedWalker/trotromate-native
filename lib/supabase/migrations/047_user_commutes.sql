-- ============================================================
-- 047: User Commutes — server-synced commute routes
-- Used by: onboarding "Set Your Commute", morning push, SmartCommuteCard
-- ============================================================

create table if not exists public.user_commutes (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  route_id uuid references routes(id),
  from_location text not null,
  to_location text not null,
  label text not null default 'Morning commute',
  commute_type text not null default 'morning'
    check (commute_type in ('morning', 'evening', 'custom')),
  is_primary boolean not null default true,
  notify_enabled boolean not null default true,
  notify_time time not null default '06:15',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup for push Edge Function + per-user queries
create index idx_user_commutes_device
  on public.user_commutes(device_id);

create index idx_user_commutes_notify
  on public.user_commutes(device_id, notify_enabled)
  where notify_enabled = true;

-- RLS — open read/write keyed by device_id (no auth yet)
alter table public.user_commutes enable row level security;

create policy "anyone_can_read_own_commutes"
  on public.user_commutes for select using (true);

create policy "anyone_can_insert_commutes"
  on public.user_commutes for insert with check (true);

create policy "anyone_can_update_own_commutes"
  on public.user_commutes for update using (true);

create policy "anyone_can_delete_own_commutes"
  on public.user_commutes for delete using (true);
