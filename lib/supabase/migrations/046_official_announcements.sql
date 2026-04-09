-- 046: Official Announcements (Transport Pulse)
-- Broadcast channel for GPRTU/GRDA to publish announcements directly to Troski commuters.
-- NOT a news aggregator — only first-party content from transport authorities.
-- Entry point is dormant until partnerships sign; screen lives in preview builds only.

create table if not exists public.official_announcements (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('GPRTU', 'GRDA', 'GRA', 'MMTL', 'MOT', 'TROSKI')),
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 10 and 4000),
  category text not null check (category in (
    'fare_update',
    'strike',
    'route_change',
    'policy',
    'public_notice',
    'insights'
  )),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  attachment_url text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_official_announcements_feed
  on public.official_announcements (is_published, published_at desc)
  where is_published = true;

create index if not exists idx_official_announcements_category
  on public.official_announcements (category, published_at desc)
  where is_published = true;

-- RLS: read-only for everyone, writes via service role only (admin-seeded)
alter table public.official_announcements enable row level security;

create policy "announcements_public_read" on public.official_announcements
  for select using (
    is_published = true
    and (expires_at is null or expires_at > now())
  );
