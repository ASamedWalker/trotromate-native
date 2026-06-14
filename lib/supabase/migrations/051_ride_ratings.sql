-- ============================================================
-- 051: Ride ratings — persist post-trip stars + tags
-- Sources: /booking/arrived (booking demo + GO Mode arrival).
-- Feeds: route_rating_stats view → per-line reliability score
-- on Lines cards (last piece of the trust loop).
-- ============================================================

create table if not exists public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  -- Null for the booking demo path (no real route attached yet);
  -- GO Mode always passes the ridden route.
  route_id uuid references routes(id),
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  trip_type text not null default 'booking'
    check (trip_type in ('go', 'booking')),
  -- Same attribution pattern as fare_reports.reporter_id:
  -- uuid-typed, accepts the undashed hex deviceId.
  reporter_id uuid,
  created_at timestamptz not null default now()
);

create index idx_ride_ratings_route
  on public.ride_ratings(route_id)
  where route_id is not null;

-- RLS — open read/insert keyed by device (no auth yet, matches 047)
alter table public.ride_ratings enable row level security;

create policy "anyone_can_read_ratings"
  on public.ride_ratings for select using (true);

create policy "anyone_can_insert_ratings"
  on public.ride_ratings for insert with check (true);

-- Per-route reliability stats (mirrors route_fare_stats shape)
create or replace view public.route_rating_stats as
select
  route_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*)::int as rating_count,
  max(created_at) as last_rated_at
from public.ride_ratings
where route_id is not null
group by route_id;
