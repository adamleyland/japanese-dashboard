-- tracking_events RLS setup
-- Run after creating public.tracking_events.

alter table public.tracking_events enable row level security;

create policy "tracking_events_select_own"
on public.tracking_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "tracking_events_insert_own"
on public.tracking_events
for insert
to authenticated
with check (auth.uid() = user_id);
