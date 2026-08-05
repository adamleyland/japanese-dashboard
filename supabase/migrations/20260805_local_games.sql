create table if not exists public.local_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_game_id text not null,
  game_name text not null,
  cover_image_url text,
  metadata_provider text not null default 'client',
  metadata jsonb not null default '{}'::jsonb,
  total_playtime_seconds bigint not null default 0,
  last_played_at timestamptz,
  platforms text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_game_id)
);

create index if not exists local_games_user_last_played_at_idx
  on public.local_games (user_id, last_played_at desc);

create table if not exists public.local_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null references public.local_games (id) on delete cascade,
  client_session_id text not null,
  platform text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now(),
  check (ended_at > started_at),
  unique (user_id, client_session_id)
);

create index if not exists local_game_sessions_game_started_at_idx
  on public.local_game_sessions (game_id, started_at desc);

create or replace function public.refresh_local_game_rollup()
returns trigger
language plpgsql
security definer
set search_path = public
as $local_game_rollup$
begin
  update public.local_games
  set
    total_playtime_seconds = total_playtime_seconds + new.duration_seconds,
    last_played_at = case
      when last_played_at is null or new.ended_at > last_played_at then new.ended_at
      else last_played_at
    end,
    platforms = case
      when new.platform = any(platforms) then platforms
      else array_append(platforms, new.platform)
    end,
    updated_at = now()
  where id = new.game_id and user_id = new.user_id;

  return new;
end;
$local_game_rollup$;

drop trigger if exists local_game_sessions_refresh_rollup on public.local_game_sessions;
create trigger local_game_sessions_refresh_rollup
after insert on public.local_game_sessions
for each row execute function public.refresh_local_game_rollup();

grant select, insert, update on table public.local_games to authenticated;
grant select, insert on table public.local_game_sessions to authenticated;

alter table public.local_games enable row level security;
alter table public.local_game_sessions enable row level security;

drop policy if exists "local_games_select_own" on public.local_games;
drop policy if exists "local_games_insert_own" on public.local_games;
drop policy if exists "local_games_update_own" on public.local_games;
drop policy if exists "local_game_sessions_select_own" on public.local_game_sessions;
drop policy if exists "local_game_sessions_insert_own" on public.local_game_sessions;

create policy "local_games_select_own"
on public.local_games for select to authenticated
using (auth.uid() = user_id);

create policy "local_games_insert_own"
on public.local_games for insert to authenticated
with check (auth.uid() = user_id);

create policy "local_games_update_own"
on public.local_games for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "local_game_sessions_select_own"
on public.local_game_sessions for select to authenticated
using (auth.uid() = user_id);

create policy "local_game_sessions_insert_own"
on public.local_game_sessions for insert to authenticated
with check (auth.uid() = user_id);
