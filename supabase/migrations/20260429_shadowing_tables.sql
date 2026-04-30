alter table public.profiles
  add column if not exists shadowing_goal numeric;

create table if not exists public.shadowing_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  total_cards integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shadowing_decks_user_created_at_idx
  on public.shadowing_decks (user_id, created_at desc);

create table if not exists public.shadowing_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.shadowing_decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  original_note_id text,
  original_card_id text,
  original_order integer not null default 0,
  expression text,
  reading text,
  sentence_kana text,
  sentence_english text,
  sentence_audio_url text,
  vocabulary_kanji text,
  vocabulary_furigana text,
  vocabulary_kana text,
  vocabulary_english text,
  vocabulary_audio_url text,
  vocabulary_pos text,
  sentence_clozed text,
  core_index integer,
  optimized_voc_index integer,
  optimized_sent_index integer,
  tags text,
  notes text,
  raw_fields jsonb not null default '{}'::jsonb
);

create index if not exists shadowing_cards_deck_order_idx
  on public.shadowing_cards (deck_id, original_order);

create index if not exists shadowing_cards_user_deck_idx
  on public.shadowing_cards (user_id, deck_id);

create table if not exists public.shadowing_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid references public.shadowing_decks (id) on delete set null,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shadowing_sessions_user_created_at_idx
  on public.shadowing_sessions (user_id, created_at desc);

grant select, insert, update on table public.shadowing_decks to authenticated;
grant select, insert, update on table public.shadowing_cards to authenticated;
grant select, insert on table public.shadowing_sessions to authenticated;

alter table public.shadowing_decks enable row level security;
alter table public.shadowing_cards enable row level security;
alter table public.shadowing_sessions enable row level security;

drop policy if exists "shadowing_decks_select_own" on public.shadowing_decks;
drop policy if exists "shadowing_decks_insert_own" on public.shadowing_decks;
drop policy if exists "shadowing_decks_update_own" on public.shadowing_decks;
drop policy if exists "shadowing_cards_select_own" on public.shadowing_cards;
drop policy if exists "shadowing_cards_insert_own" on public.shadowing_cards;
drop policy if exists "shadowing_cards_update_own" on public.shadowing_cards;
drop policy if exists "shadowing_sessions_select_own" on public.shadowing_sessions;
drop policy if exists "shadowing_sessions_insert_own" on public.shadowing_sessions;

create policy "shadowing_decks_select_own"
on public.shadowing_decks
for select
to authenticated
using (auth.uid() = user_id);

create policy "shadowing_decks_insert_own"
on public.shadowing_decks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "shadowing_decks_update_own"
on public.shadowing_decks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "shadowing_cards_select_own"
on public.shadowing_cards
for select
to authenticated
using (auth.uid() = user_id);

create policy "shadowing_cards_insert_own"
on public.shadowing_cards
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "shadowing_cards_update_own"
on public.shadowing_cards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "shadowing_sessions_select_own"
on public.shadowing_sessions
for select
to authenticated
using (auth.uid() = user_id);

create policy "shadowing_sessions_insert_own"
on public.shadowing_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shadowing-audio',
  'shadowing-audio',
  false,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/flac'
  ]
)
on conflict (id) do nothing;
