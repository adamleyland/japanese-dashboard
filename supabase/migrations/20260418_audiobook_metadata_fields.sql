alter table public.audiobooks
  add column if not exists narrator text,
  add column if not exists publisher text,
  add column if not exists series text,
  add column if not exists part text,
  add column if not exists published_date date;

comment on column public.audiobooks.narrator is 'Primary audiobook narrator derived from file metadata when available.';
comment on column public.audiobooks.publisher is 'Audiobook publisher/imprint derived from file metadata when available.';
comment on column public.audiobooks.series is 'Series or collection name derived from file metadata when available.';
comment on column public.audiobooks.part is 'Part, volume, or disc designation derived from file metadata when available.';
comment on column public.audiobooks.published_date is 'Published/release date derived from file metadata when available.';

create table if not exists public.audiobook_chapters (
  id bigserial primary key,
  audiobook_id bigint not null references public.audiobooks(id) on delete cascade,
  title text not null,
  start_seconds integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audiobook_chapters_audiobook_id_idx
  on public.audiobook_chapters (audiobook_id, start_seconds);

comment on table public.audiobook_chapters is 'Future-ready chapter table for imported audiobook chapter markers.';
