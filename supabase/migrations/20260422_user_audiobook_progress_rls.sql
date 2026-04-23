grant select, insert, update on table public.user_audiobook_progress to authenticated;

alter table public.user_audiobook_progress enable row level security;

drop policy if exists "user_audiobook_progress_select_own" on public.user_audiobook_progress;
drop policy if exists "user_audiobook_progress_insert_own" on public.user_audiobook_progress;
drop policy if exists "user_audiobook_progress_update_own" on public.user_audiobook_progress;

create policy "user_audiobook_progress_select_own"
on public.user_audiobook_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "user_audiobook_progress_insert_own"
on public.user_audiobook_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_audiobook_progress_update_own"
on public.user_audiobook_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
