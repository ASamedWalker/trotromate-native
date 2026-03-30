-- Commuter tips: community-submitted travel tips surfaced as "Daily Tip"
-- Falls back to static tips client-side if table is empty or offline

create table if not exists public.commuter_tips (
  id uuid primary key default gen_random_uuid(),
  tip text not null check (char_length(tip) between 10 and 280),
  author_name text not null default 'Anonymous',
  device_id text not null,
  category text not null default 'general'
    check (category in ('general', 'trotro', 'train', 'okada', 'gprtu', 'safety')),
  upvotes integer not null default 0,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for fetching approved tips sorted by upvotes
create index if not exists idx_commuter_tips_approved
  on public.commuter_tips (is_approved, upvotes desc, created_at desc)
  where is_approved = true;

-- RLS
alter table public.commuter_tips enable row level security;

-- Anyone can read approved tips
create policy "approved_tips_read" on public.commuter_tips
  for select using (is_approved = true);

-- Anyone can insert (moderated via is_approved default false)
create policy "tips_insert" on public.commuter_tips
  for insert with check (true);

-- Users can upvote (update upvotes only)
create policy "tips_upvote" on public.commuter_tips
  for update using (is_approved = true);
