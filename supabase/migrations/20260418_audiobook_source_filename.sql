alter table public.audiobooks
  add column if not exists source_filename text;

create unique index if not exists audiobooks_source_filename_unique_idx
  on public.audiobooks (source_filename)
  where source_filename is not null;

comment on column public.audiobooks.source_filename is 'Original audiobook filename used for idempotent local sync imports.';
