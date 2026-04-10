-- ============================================================
-- 048: View-based streaks — track daily check-ins (app opens)
-- Separate from report-based streaks (current_streak).
-- Opening the app and viewing your commute = a streak day.
-- ============================================================

-- Daily check-in log (one per device per day)
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  checkin_date date not null default current_date,
  route_id uuid references routes(id),
  source text not null default 'app_open'
    check (source in ('app_open', 'commute_view', 'fare_view', 'report')),
  created_at timestamptz not null default now(),
  unique(device_id, checkin_date)
);

create index idx_daily_checkins_device_date
  on public.daily_checkins(device_id, checkin_date desc);

alter table public.daily_checkins enable row level security;

create policy "anyone_can_read_own_checkins"
  on public.daily_checkins for select using (true);

create policy "anyone_can_insert_checkins"
  on public.daily_checkins for insert with check (true);

-- Add view-based streak fields to contributor_profiles
alter table public.contributor_profiles
  add column if not exists view_streak integer not null default 0,
  add column if not exists longest_view_streak integer not null default 0,
  add column if not exists last_checkin_date date;

-- Seed view_streak from existing report streaks so active users don't start at 0
update public.contributor_profiles
set view_streak = current_streak,
    longest_view_streak = longest_streak,
    last_checkin_date = last_report_date::date
where current_streak > 0
  and last_report_date is not null;

-- ============================================================
-- RPC: record_checkin — atomic check-in + streak calculation
-- Called once per app open (idempotent per day)
-- ============================================================
create or replace function public.record_checkin(
  p_device_id text,
  p_route_id uuid default null,
  p_source text default 'app_open'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_profile_id uuid;
  v_today date := current_date;
  v_yesterday date := current_date - 1;
  v_old_streak int;
  v_new_streak int;
  v_longest int;
  v_last_checkin date;
  v_is_new boolean;
begin
  -- Get existing profile
  select id, view_streak, longest_view_streak, last_checkin_date
  into v_profile_id, v_old_streak, v_longest, v_last_checkin
  from public.contributor_profiles
  where device_id = p_device_id;

  -- No profile = no-op (profile created on first app launch)
  if v_profile_id is null then
    return jsonb_build_object('streak', 0, 'is_new_day', false);
  end if;

  -- Already checked in today
  if v_last_checkin = v_today then
    return jsonb_build_object('streak', v_old_streak, 'is_new_day', false);
  end if;

  -- Idempotent insert (unique constraint handles dupes)
  insert into public.daily_checkins (device_id, checkin_date, route_id, source)
  values (p_device_id, v_today, p_route_id, p_source)
  on conflict (device_id, checkin_date) do nothing;

  -- Calculate new streak
  if v_last_checkin = v_yesterday then
    v_new_streak := coalesce(v_old_streak, 0) + 1;
  else
    v_new_streak := 1;
  end if;

  -- Update profile
  update public.contributor_profiles
  set view_streak = v_new_streak,
      longest_view_streak = greatest(coalesce(v_longest, 0), v_new_streak),
      last_checkin_date = v_today,
      updated_at = now()
  where id = v_profile_id;

  return jsonb_build_object(
    'streak', v_new_streak,
    'is_new_day', true
  );
end;
$$;
