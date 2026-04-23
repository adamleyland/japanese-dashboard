grant select on table public.audiobook_chapters to anon, authenticated;

alter table public.audiobook_chapters enable row level security;

drop policy if exists "audiobook_chapters_public_read" on public.audiobook_chapters;

create policy "audiobook_chapters_public_read"
on public.audiobook_chapters
for select
to anon, authenticated
using (true);
