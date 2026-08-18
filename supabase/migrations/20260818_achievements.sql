-- Provider-neutral achievement cache. Source clients only ever write through the
-- dashboard API; local integrations are read-only with respect to game files.
create table if not exists public.achievement_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('steam', 'xbox', 'local', 'manual')),
  provider_game_id text not null,
  game_name text not null,
  platform text,
  cover_artwork_url text,
  source_game_key text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_game_id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  achievement_game_id uuid not null references public.achievement_games (id) on delete cascade,
  provider_achievement_id text not null,
  name text not null,
  description text,
  icon_url text,
  icon_locked_url text,
  unlocked boolean not null default false,
  unlocked_at timestamptz,
  rarity_percentage numeric,
  gamerscore integer,
  progress_current numeric,
  progress_target numeric,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (achievement_game_id, provider_achievement_id)
);

create index if not exists achievement_games_user_provider_idx on public.achievement_games (user_id, provider);
create index if not exists achievements_game_unlocked_idx on public.achievements (achievement_game_id, unlocked desc);

grant select, insert, update, delete on public.achievement_games, public.achievements to authenticated;
alter table public.achievement_games enable row level security;
alter table public.achievements enable row level security;

create policy "achievement_games_own" on public.achievement_games for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "achievements_own" on public.achievements for all to authenticated
  using (exists (select 1 from public.achievement_games g where g.id = achievement_game_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.achievement_games g where g.id = achievement_game_id and g.user_id = auth.uid()));
