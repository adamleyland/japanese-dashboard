alter table public.achievement_games
  add column if not exists definition_provider text,
  add column if not exists definition_game_id text,
  add column if not exists tracking_mode text not null default 'provider',
  add column if not exists last_sync_error text;

create index if not exists achievement_games_definition_idx
  on public.achievement_games (user_id, definition_provider, definition_game_id);

create table if not exists public.achievement_unlock_events (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  unlocked_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (achievement_id, unlocked_at)
);

create index if not exists achievement_unlock_events_user_date_idx
  on public.achievement_unlock_events (user_id, unlocked_at desc);

grant select on public.achievement_unlock_events to authenticated;
alter table public.achievement_unlock_events enable row level security;

create policy "achievement_unlock_events_own" on public.achievement_unlock_events
  for select to authenticated using (auth.uid() = user_id);
